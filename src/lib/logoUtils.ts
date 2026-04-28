import type { LogoOrMarkEntry } from '@/types/extraction';

export function hexLuminance(hex: string): number {
  if (hex.length !== 7) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function svgIsLight(markup: string): boolean {
  const re = /(?:fill|stroke)=["']([^"']+)["']/gi;
  let m: RegExpMatchArray | null;
  while ((m = re.exec(markup)) !== null) {
    const v = m[1].trim().toLowerCase();
    if (v === 'none' || v === 'transparent' || v === 'currentcolor') continue;
    if (v.startsWith('#')) {
      const expanded =
        v.length === 4
          ? '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
          : v;
      if (hexLuminance(expanded) < 0.35) return false;
    }
  }
  return true;
}

export function logoNeedsDarkBg(logo: LogoOrMarkEntry, pageBgDark: boolean): boolean {
  if (logo.kind === 'svg-inline' && logo.inlineSvgPreview) {
    return svgIsLight(logo.inlineSvgPreview);
  }
  return pageBgDark;
}
