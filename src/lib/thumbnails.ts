import type { ImageryEntry, ImageryRole, LogoOrMarkEntry, ThumbnailEntry } from '@/types/extraction';

/** Hard caps for serverless safety (payload size + time). */
export const THUMB_MAX_COUNT = 24;
export const THUMB_MAX_BYTES_PER_IMAGE = 2 * 1024 * 1024;
/** Raised with THUMB_MAX_EDGE so we still return up to THUMB_MAX_COUNT previews. */
export const THUMB_MAX_TOTAL_BASE64_CHARS = 3_200_000;
export const THUMB_FETCH_TIMEOUT_MS = 5000;
/** Long edge cap for server thumbnails (full asset URL in imagery is unchanged). */
export const THUMB_MAX_EDGE = 960;
export const THUMB_PARALLEL = 4;
const JPEG_QUALITY = 88;

type Candidate = { url: string; role: ThumbnailEntry['role'] };

function isRasterUrl(url: string): boolean {
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.svg')) return false;
  return /\.(jpe?g|png|gif|webp|avif|bmp|ico)(\?|$)/i.test(url) || !/\.[a-z0-9]{2,4}(\?|$)/i.test(lower);
}

function buildCandidates(
  imagery: ImageryEntry[],
  logos: LogoOrMarkEntry[]
): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const push = (url: string | undefined, role: ThumbnailEntry['role']) => {
    if (!url || !isRasterUrl(url) || seen.has(url)) return;
    seen.add(url);
    out.push({ url, role });
  };

  for (const l of logos) {
    if (l.kind === 'raster' && l.url) push(l.url, 'logo-asset');
  }

  const roleOrder: Record<ImageryRole, number> = {
    primaryLogo: 0,
    secondaryLogo: 1,
    background: 2,
    misc: 3,
    decorative: 4,
  };
  const sorted = [...imagery].sort(
    (a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
  );

  for (const img of sorted) {
    push(img.url, img.role);
  }

  return out;
}

async function fetchWithLimit(
  url: string,
  signal: AbortSignal,
  referer?: string
): Promise<ArrayBuffer | null> {
  const headers: Record<string, string> = {
    Accept: 'image/*,*/*;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  if (referer) {
    headers.Referer = referer;
  }

  const res = await fetch(url, {
    signal,
    redirect: 'follow',
    headers,
  });
  if (!res.ok) return null;
  const len = res.headers.get('content-length');
  if (len && parseInt(len, 10) > THUMB_MAX_BYTES_PER_IMAGE) return null;

  const buf = await res.arrayBuffer();
  if (buf.byteLength > THUMB_MAX_BYTES_PER_IMAGE) return null;
  return buf;
}

async function toJpegDataUrl(
  buffer: ArrayBuffer
): Promise<{ dataUrl: string; metaW?: number; metaH?: number } | null> {
  const sharp = (await import('sharp')).default;
  const input = Buffer.from(buffer);
  const meta = await sharp(input).metadata();
  const metaW = meta.width;
  const metaH = meta.height;
  const jpeg = await sharp(input)
    .rotate()
    .resize({
      width: THUMB_MAX_EDGE,
      height: THUMB_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
    .toBuffer();
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  return { dataUrl, metaW, metaH };
}

/**
 * Fetches and downsizes a limited set of raster images; failures are skipped.
 */
export async function generateThumbnails(
  imagery: ImageryEntry[],
  logos: LogoOrMarkEntry[],
  refererPageUrl?: string
): Promise<ThumbnailEntry[]> {
  const candidates = buildCandidates(imagery, logos).slice(0, THUMB_MAX_COUNT * 2);
  const results: ThumbnailEntry[] = [];
  let totalBase64 = 0;
  const referer = refererPageUrl?.trim();

  const processOne = async (c: Candidate): Promise<ThumbnailEntry | null> => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), THUMB_FETCH_TIMEOUT_MS);
    try {
      const buf = await fetchWithLimit(c.url, controller.signal, referer);
      if (!buf) return null;
      const converted = await toJpegDataUrl(buf);
      if (!converted) return null;
      if (totalBase64 + converted.dataUrl.length > THUMB_MAX_TOTAL_BASE64_CHARS) return null;
      totalBase64 += converted.dataUrl.length;
      return {
        url: c.url,
        role: c.role,
        dataUrl: converted.dataUrl,
        sourceWidth: converted.metaW,
        sourceHeight: converted.metaH,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };

  for (let i = 0; i < candidates.length && results.length < THUMB_MAX_COUNT; i += THUMB_PARALLEL) {
    const chunk = candidates.slice(i, i + THUMB_PARALLEL);
    const settled = await Promise.all(chunk.map(processOne));
    for (const s of settled) {
      if (s && results.length < THUMB_MAX_COUNT) results.push(s);
    }
  }

  return results;
}
