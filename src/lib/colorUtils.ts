import { ColorEntry } from '@/types/colors';

export function rgbToHex(rgb: string): string | null {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (!match) return null;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  return (
    '#' +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function normalizeColor(cssColor: string): string | null {
  if (!cssColor || cssColor === 'transparent' || cssColor === 'none') return null;
  if (cssColor === 'rgba(0, 0, 0, 0)') return null;

  if (cssColor.startsWith('rgb')) return rgbToHex(cssColor);

  if (cssColor.startsWith('#')) {
    return cssColor.length === 4
      ? '#' +
          cssColor
            .slice(1)
            .split('')
            .map((c) => c + c)
            .join('')
            .toUpperCase()
      : cssColor.toUpperCase();
  }

  return null;
}

export function isColorMeaningful(hex: string | null): boolean {
  return !!hex;
}

export function deduplicateColors(entries: ColorEntry[]): ColorEntry[] {
  const seen = new Map<string, ColorEntry>();
  for (const entry of entries) {
    if (!seen.has(entry.hex)) {
      seen.set(entry.hex, entry);
    }
  }
  return Array.from(seen.values());
}
