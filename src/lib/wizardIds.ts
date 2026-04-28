import type { LogoOrMarkEntry, SemanticColorEntry } from '@/types/extraction';

/** Stable id for a scraped logo row (survives filtering / reordering). */
export function logoEntryId(l: LogoOrMarkEntry): string {
  if (l.url) return `logo::${l.url}`;
  const snip = (l.inlineSvgPreview ?? '').slice(0, 96);
  let h = 0;
  for (let i = 0; i < snip.length; i++) h = (h * 31 + snip.charCodeAt(i)) | 0;
  return `logo::${l.kind}::${l.selectorHint}::${h}`;
}

export function fontId(familyStack: string): string {
  return familyStack.replace(/\s+/g, ' ').trim();
}

/** Normalize to `#RRGGBB` for stable deduping (handles 3-digit and 8-digit hex). */
export function normalizeColorHex(hex: string): string {
  let h = hex.trim().toUpperCase();
  if (!h.startsWith('#')) h = `#${h}`;
  if (h.length === 4) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  if (h.length === 9) return h.slice(0, 7);
  return h;
}

/** Wizard selection id for colors: one id per distinct hex value. */
export function colorSelectionId(hex: string): string {
  return `color::${normalizeColorHex(hex)}`;
}

/** Legacy per-row id (not used for selection after hex dedupe). */
export function colorId(entry: SemanticColorEntry): string {
  return `${entry.role}::${entry.hex}::${entry.property}::${entry.source}`;
}

export function imageId(index: number): string {
  return `img-${index}`;
}
