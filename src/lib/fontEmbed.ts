import type { EmbeddedFontFormat, FontEntry } from '@/types/extraction';
import type { RawFontFace } from '@/lib/fontClassifier';
import { familyLooselyMatches, firstNamedFamily } from '@/lib/fontClassifier';

const FONT_FETCH_TIMEOUT_MS = 12_000;
const FONT_MAX_BYTES = 1.2 * 1024 * 1024;
const MAX_EMBEDDED_FONTS_TOTAL = 6;

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function guessFormat(url: string): EmbeddedFontFormat {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.woff2')) return 'woff2';
  if (path.endsWith('.woff')) return 'woff';
  if (path.endsWith('.ttf')) return 'ttf';
  if (path.endsWith('.otf')) return 'otf';
  return 'unknown';
}

function sortFontUrlsByPreference(urls: string[]): string[] {
  const score = (u: string) => {
    const l = u.split('?')[0].toLowerCase();
    if (l.endsWith('.woff2')) return 5;
    if (l.endsWith('.woff')) return 4;
    if (l.endsWith('.otf')) return 3;
    if (l.endsWith('.ttf')) return 2;
    return 1;
  };
  return [...new Set(urls)].sort((a, b) => score(b) - score(a));
}

async function fetchFontBuffer(url: string, referer: string): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FONT_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': CHROME_UA,
        Referer: referer,
        Accept: 'font/woff2,font/woff,application/font-woff2,application/font-woff,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;
    const len = res.headers.get('content-length');
    if (len && parseInt(len, 10) > FONT_MAX_BYTES) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > FONT_MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function bufferToDataUrl(buf: ArrayBuffer, format: EmbeddedFontFormat): string {
  const mime =
    format === 'woff2'
      ? 'font/woff2'
      : format === 'woff'
        ? 'font/woff'
        : format === 'ttf'
          ? 'font/ttf'
          : format === 'otf'
            ? 'font/otf'
            : 'application/octet-stream';
  const b64 = Buffer.from(buf).toString('base64');
  return `data:${mime};base64,${b64}`;
}

const WARN_NO_URLS =
  'No downloadable @font-face URL was captured (often blocked cross-origin CSS). The guide will use fallback fonts unless you add files.';
const WARN_NO_URLS_CDN =
  'Could not read or fetch @font-face files for this CDN font from the page. Use the host’s stylesheet in production; preview may substitute system fonts.';
const WARN_FETCH_FAILED =
  'Could not download this font from the site (blocked, timeout, or size limit). Preview may use fallbacks — upload a licensed file if you need an exact match.';

/**
 * Attempts to fetch one webfont file per stack from captured @font-face src URLs.
 */
export async function embedFontsForEntries(
  entries: FontEntry[],
  fontFaceRules: RawFontFace[],
  pageUrl: string,
  resolveUrl: (href: string, base: string) => string
): Promise<FontEntry[]> {
  let embeddedCount = 0;
  const out: FontEntry[] = [];

  for (const entry of entries) {
    const named = firstNamedFamily(entry.familyStack);
    if (!named) {
      out.push({ ...entry });
      continue;
    }

    const matching = fontFaceRules.filter((r) => familyLooselyMatches(r.family, named));
    const rawUrls = matching.flatMap((r) => r.srcUrls);
    const absolute = rawUrls
      .map((u) => {
        try {
          return resolveUrl(u, pageUrl);
        } catch {
          return null;
        }
      })
      .filter((u): u is string => !!u && u.startsWith('http'));

    if (absolute.length === 0) {
      const cdn = entry.classification === 'google' || entry.classification === 'adobe' || entry.classification === 'bunny';
      out.push({
        ...entry,
        embeddedFontWarning: cdn ? WARN_NO_URLS_CDN : WARN_NO_URLS,
      });
      continue;
    }

    if (embeddedCount >= MAX_EMBEDDED_FONTS_TOTAL) {
      out.push({
        ...entry,
        embeddedFontWarning:
          'Font download limit reached for this audit (size/safety cap); this family was not embedded.',
      });
      continue;
    }

    const ordered = sortFontUrlsByPreference(absolute);
    let embedded: FontEntry['embeddedFont'] | undefined;
    for (const u of ordered) {
      const fmt = guessFormat(u);
      const buf = await fetchFontBuffer(u, pageUrl);
      if (!buf) continue;
      const dataUrl = bufferToDataUrl(buf, fmt);
      embedded = { dataUrl, format: fmt, sourceUrl: u };
      embeddedCount++;
      break;
    }

    if (embedded) {
      out.push({
        ...entry,
        embeddedFont: embedded,
        embeddedFontWarning: undefined,
        needsUserFontUpload: false,
        userMessage: undefined,
      });
    } else {
      out.push({
        ...entry,
        embeddedFontWarning: WARN_FETCH_FAILED,
      });
    }
  }

  return out;
}
