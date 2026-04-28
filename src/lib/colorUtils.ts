import chroma from 'chroma-js';
import { ColorEntry } from '@/types/colors';

function clamp255(n: number): number {
  return Math.min(255, Math.max(0, n));
}

function tripletToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => clamp255(Math.round(v)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** Parse alpha after `/`; returns null if missing (fully opaque). */
function parseTrailingAlpha(inner: string): { body: string; alpha: number | null } {
  const slash = inner.indexOf('/');
  if (slash < 0) return { body: inner.trim(), alpha: null };
  const body = inner.slice(0, slash).trim();
  const raw = inner.slice(slash + 1).trim();
  if (!raw) return { body, alpha: null };
  if (raw.endsWith('%')) {
    const p = parseFloat(raw.slice(0, -1));
    if (Number.isNaN(p)) return { body, alpha: null };
    return { body, alpha: Math.min(1, Math.max(0, p / 100)) };
  }
  const a = parseFloat(raw);
  if (Number.isNaN(a)) return { body, alpha: null };
  return { body, alpha: Math.min(1, Math.max(0, a)) };
}

function splitColorArgs(body: string): string[] {
  const t = body.trim();
  if (t.includes(',')) {
    return t.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return t.split(/\s+/).filter(Boolean);
}

/**
 * CSS Color 4 rgb()/rgba(): comma or space syntax, %, optional `/` alpha,
 * and 0–1 channel scaling when all channels are in [0, 1].
 */
export function rgbToHex(rgb: string): string | null {
  const m = rgb.trim().match(/^rgba?\(\s*([\s\S]+)\)$/i);
  if (!m) return null;
  const { body, alpha } = parseTrailingAlpha(m[1]);
  if (alpha === 0) return null;

  const parts = splitColorArgs(body);
  if (parts.length < 3) return null;

  const a = parts[0];
  const b = parts[1];
  const c = parts[2];
  if (!a || !b || !c) return null;

  const parseChan = (s: string): { v: number; pct: boolean } | null => {
    if (s.endsWith('%')) {
      const n = parseFloat(s.slice(0, -1));
      if (Number.isNaN(n)) return null;
      return { v: n, pct: true };
    }
    const n = parseFloat(s);
    if (Number.isNaN(n)) return null;
    return { v: n, pct: false };
  };

  const ca = parseChan(a);
  const cb = parseChan(b);
  const cc = parseChan(c);
  if (!ca || !cb || !cc) return null;

  let r: number;
  let g: number;
  let bl: number;

  const anyPct = ca.pct || cb.pct || cc.pct;
  if (anyPct) {
    r = ca.pct ? (ca.v / 100) * 255 : ca.v;
    g = cb.pct ? (cb.v / 100) * 255 : cb.v;
    bl = cc.pct ? (cc.v / 100) * 255 : cc.v;
  } else {
    const vals = [ca.v, cb.v, cc.v];
    const use01 = vals.every((v) => v >= 0 && v <= 1);
    if (use01) {
      r = vals[0] * 255;
      g = vals[1] * 255;
      bl = vals[2] * 255;
    } else {
      r = vals[0];
      g = vals[1];
      bl = vals[2];
    }
  }

  return tripletToHex(r, g, bl);
}

function labToHex(lab: string): string | null {
  const s = lab.trim();
  if (!/^lab\(/i.test(s)) return null;
  try {
    const c = chroma(s);
    if (c.alpha() === 0) return null;
    return c.alpha(1).hex('rgb').toUpperCase();
  } catch {
    return null;
  }
}

function isInvisibleColor(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/\s+/g, ' ');
  if (t === 'transparent' || t === 'none') return true;
  if (t === 'rgba(0, 0, 0, 0)' || t === 'rgba(0,0,0,0)') return true;
  if (/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(t)) return true;
  if (/^rgba?\(\s*0\s+0\s+0\s*\/\s*0\s*\)$/.test(t)) return true;
  return false;
}

export function normalizeColor(cssColor: string): string | null {
  const s = cssColor.trim();
  if (!s || isInvisibleColor(s)) return null;

  if (s.startsWith('#')) {
    const body = s.slice(1).toUpperCase();
    if (body.length === 3) {
      return '#' + body.split('').map((c) => c + c).join('');
    }
    if (body.length === 6) return '#' + body;
    if (body.length === 8) return '#' + body.slice(0, 6);
    return null;
  }

  const lower = s.toLowerCase();
  if (lower.startsWith('rgb')) {
    return rgbToHex(s);
  }
  if (lower.startsWith('hsl')) {
    try {
      const c = chroma(s);
      if (c.alpha() === 0) return null;
      return c.alpha(1).hex('rgb').toUpperCase();
    } catch {
      return null;
    }
  }
  if (lower.startsWith('lab(')) {
    return labToHex(s);
  }
  if (lower.startsWith('lch(') || lower.startsWith('oklch(') || lower.startsWith('oklab(')) {
    try {
      const c = chroma(s);
      if (c.alpha() === 0) return null;
      return c.alpha(1).hex('rgb').toUpperCase();
    } catch {
      return null;
    }
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

export interface BrandColorHierarchy {
  primary: string | null;
  secondary: string | null;
  tertiary: string | null;
}

/**
 * Derives primary/secondary/tertiary brand colors from semantic color groups.
 * Priority: headerCta backgrounds → button backgrounds → link colors.
 * Near-white (lum > 0.85) and near-black (lum < 0.03) are excluded as these
 * are backgrounds/text, not brand accent colors.
 */
export function computeBrandColors(
  colorsByRole: Array<{ role: string; entries: { hex: string; property: string }[] }>
): BrandColorHierarchy {
  const candidates: string[] = [];
  const seen = new Set<string>();

  function addFromRole(role: string, bgFirst = true) {
    const group = colorsByRole.find((g) => g.role === role);
    if (!group) return;
    const entries = bgFirst
      ? [
          ...group.entries.filter((e) => e.property.includes('background')),
          ...group.entries.filter((e) => !e.property.includes('background')),
        ]
      : group.entries;
    for (const e of entries) {
      const hex = e.hex.toUpperCase();
      if (seen.has(hex)) continue;
      try {
        const lum = chroma(hex).luminance();
        if (lum <= 0.85 && lum >= 0.03) {
          seen.add(hex);
          candidates.push(hex);
        }
      } catch {
        // skip unparseable
      }
    }
  }

  addFromRole('headerCta', true);
  addFromRole('button', true);
  addFromRole('link', false);

  return {
    primary: candidates[0] ?? null,
    secondary: candidates[1] ?? null,
    tertiary: candidates[2] ?? null,
  };
}
