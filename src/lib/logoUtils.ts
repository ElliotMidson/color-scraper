import type { LogoOrMarkEntry } from '@/types/extraction';

export function hexLuminance(hex: string): number {
  if (hex.length !== 7) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function expandHex(v: string): string | null {
  if (v.length === 4) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  if (v.length === 7) return v;
  return null;
}

/** Scan SVG fill/stroke attributes and return min/max luminance of explicit colors. */
function svgLuminanceRange(markup: string): { min: number; max: number; found: boolean } {
  const re = /(?:fill|stroke)=["']([^"']+)["']/gi;
  let m: RegExpMatchArray | null;
  let min = 1;
  let max = 0;
  let found = false;

  while ((m = re.exec(markup)) !== null) {
    const v = m[1].trim().toLowerCase();
    if (v === 'none' || v === 'transparent' || v === 'currentcolor') continue;
    if (!v.startsWith('#')) continue;
    const hex = expandHex(v);
    if (!hex) continue;
    const lum = hexLuminance(hex);
    min = Math.min(min, lum);
    max = Math.max(max, lum);
    found = true;
  }

  return { min, max, found };
}

/**
 * Returns the background color the logo preview needs, or null if it's coloured
 * and looks fine on either surface.
 *
 * - All fills near-white (max lum > 0.80) → needs dark bg '#0c0a08'
 * - All fills near-black (max lum < 0.12) → needs light bg '#ffffff'
 * - Mixed / coloured → null (no special bg)
 */
export function getLogoBg(logo: LogoOrMarkEntry, pageBgDark: boolean): string | null {
  if (logo.kind === 'svg-inline' && logo.inlineSvgPreview) {
    const { min, max, found } = svgLuminanceRange(logo.inlineSvgPreview);
    if (!found) return null; // uses currentColor or is complex — leave as-is
    if (min > 0.80) return '#0c0a08'; // white/light logo → dark bg
    if (max < 0.12) return '#ffffff'; // black/dark logo → white bg
    return null;
  }
  // Raster / SVG-URL: use page bg as proxy
  return pageBgDark ? '#0c0a08' : null;
}
