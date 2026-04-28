import type { FontClassification, FontEntry } from '@/types/extraction';

const SYSTEM_KEYWORDS = new Set(
  [
    'serif',
    'sans-serif',
    'monospace',
    'system-ui',
    'ui-sans-serif',
    'ui-serif',
    'ui-monospace',
    '-apple-system',
    'blinkmacsystemfont',
    'arial',
    'helvetica',
    'helvetica neue',
    'georgia',
    'times',
    'times new roman',
    'cursive',
    'fantasy',
    'inherit',
    'initial',
    'unset',
    'default',
  ].map((s) => s.toLowerCase())
);

export type RawFontStack = { stack: string; sampleSelector: string };
export type RawFontFace = { family: string; srcUrls: string[] };

export function firstNamedFamily(stack: string): string | null {
  for (const part of stack.split(',')) {
    const raw = part.trim().replace(/^["']|["']$/g, '');
    const key = raw.toLowerCase();
    if (key && !SYSTEM_KEYWORDS.has(key)) return raw;
  }
  return null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function classifySrcUrls(srcUrls: string[]): {
  classification: FontClassification;
  needsUpload: boolean;
  evidence: string[];
} {
  const evidence: string[] = [];
  let google = false;
  let adobe = false;
  let bunny = false;
  let customHost = false;

  for (const u of srcUrls) {
    const h = hostOf(u);
    if (!h) continue;
    evidence.push(`@font-face src: ${h}`);
    if (h.includes('gstatic.com') || h.includes('fonts.googleapis.com')) google = true;
    else if (h.includes('typekit.net') || h.includes('use.typekit.net') || h.includes('adobefonts.com'))
      adobe = true;
    else if (h.includes('fonts.bunny.net')) bunny = true;
    else if (h.startsWith('http') || u.startsWith('//')) customHost = true;
  }

  if (google) return { classification: 'google', needsUpload: false, evidence };
  if (adobe) return { classification: 'adobe', needsUpload: false, evidence };
  if (bunny) return { classification: 'bunny', needsUpload: false, evidence };
  if (customHost) return { classification: 'custom-unknown', needsUpload: true, evidence };
  return { classification: 'custom-unknown', needsUpload: false, evidence };
}

export function familyLooselyMatches(faceFamily: string, named: string): boolean {
  const a = faceFamily.toLowerCase().replace(/["']/g, '');
  const b = named.toLowerCase().replace(/["']/g, '');
  return a === b || a.includes(b) || b.includes(a);
}

export function buildFontEntries(
  fontStacks: RawFontStack[],
  fontFaceRules: RawFontFace[],
  stylesheetHrefs: string[]
): FontEntry[] {
  const hasGoogleLink = stylesheetHrefs.some((h) => /fonts\.googleapis\.com/i.test(h));
  const hasAdobeLink = stylesheetHrefs.some(
    (h) => /typekit\.net|use\.typekit|adobefonts\.com/i.test(h)
  );
  const hasBunnyLink = stylesheetHrefs.some((h) => /fonts\.bunny\.net/i.test(h));

  const uniqueStacks = new Map<string, RawFontStack>();
  for (const fs of fontStacks) {
    const k = fs.stack.replace(/\s+/g, ' ').trim();
    if (!uniqueStacks.has(k)) uniqueStacks.set(k, fs);
  }

  const entries: FontEntry[] = [];

  for (const { stack, sampleSelector } of uniqueStacks.values()) {
    const named = firstNamedFamily(stack);
    const evidence: string[] = [];

    if (!named) {
      entries.push({
        familyStack: stack,
        usageSample: sampleSelector,
        classification: 'system',
        needsUserFontUpload: false,
        evidence: ['Stack uses only generic/system font keywords'],
      });
      continue;
    }

    let classification: FontClassification = 'custom-unknown';
    let needsUserFontUpload = false;

    const matchingFaces = fontFaceRules.filter((r) => familyLooselyMatches(r.family, named));
    const mergedUrls = matchingFaces.flatMap((r) => r.srcUrls);
    if (matchingFaces.length && mergedUrls.length) {
      const srcClass = classifySrcUrls(mergedUrls);
      classification = srcClass.classification;
      needsUserFontUpload = srcClass.needsUpload;
      evidence.push(...srcClass.evidence);
    } else if (hasGoogleLink) {
      classification = 'google';
      evidence.push('Linked stylesheet from fonts.googleapis.com');
    } else if (hasAdobeLink) {
      classification = 'adobe';
      evidence.push('Linked stylesheet from Adobe Fonts / Typekit');
    } else if (hasBunnyLink) {
      classification = 'bunny';
      evidence.push('Linked stylesheet from fonts.bunny.net');
    } else {
      classification = 'custom-unknown';
      needsUserFontUpload = true;
      evidence.push(
        'Named font family without readable @font-face or known CDN link — may be self-hosted or blocked by cross-origin stylesheets'
      );
    }

    const userMessage = needsUserFontUpload
      ? `Upload font files for “${named}” (or confirm a licensed webfont URL). We could not verify a Google/Adobe/Bunny host.`
      : undefined;

    entries.push({
      familyStack: stack,
      usageSample: sampleSelector,
      classification,
      needsUserFontUpload,
      userMessage,
      evidence,
    });
  }

  return entries;
}
