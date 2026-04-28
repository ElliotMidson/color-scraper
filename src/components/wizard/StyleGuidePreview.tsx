'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { InlineSvgPreview } from '@/components/InlineSvgPreview';
import { normalizeColorHex } from '@/lib/wizardIds';
import { IMAGERY_ROLE_LABELS, IMAGERY_ROLE_ORDER } from '@/lib/wizardLabels';
import type { FontEntry, ImageryEntry, ImageryRole } from '@/types/extraction';
import type { StyleGuidePayload } from '@/types/wizard';

export type StyleGuideSection = 'logos' | 'fonts' | 'colors' | 'imagery' | 'brand';

/** Stack used for “Aa” when the site font file is not embedded (no @font-face download). */
const SYSTEM_PREVIEW_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function previewFontStack(f: FontEntry | undefined, idx: number): string {
  if (f?.embeddedFont) {
    return `'__SGFont_${idx}', ${f.familyStack}`;
  }
  return SYSTEM_PREVIEW_FONT;
}

/** Title-case each hyphen/space-separated segment for display (e.g. sohne-var → Sohne-Var). */
function capitalizeFontNameLabel(name: string): string {
  return name
    .split(/([-\s]+)/)
    .map((part) => (/^[-\s]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join('');
}

/** Primary logo mark width in the guide tile (Figma spec). */
const LOGO_PRIMARY_PX = 180;

/** Themes · 2026 moodboard (node 3398:11067). */
const SG = {
  radius: 12,
  /** Space between moodboard blocks (bento, collage, etc.). */
  gap: 32,
  boardMaxWidth: 780,
  tilePadLg: 24,
  tilePadMd: 20,
  card: '#ffffff',
  lime: '#e4f222',
  warmGrey: '#f4f2f0',
  ink: '#0c0a08',
  labelMuted: 'rgba(5, 5, 5, 0.38)',
  collageMore: '#eeeeee',
} as const;

/** 2×2 bento cells: square tiles sized from column width. */
const BENTO_SQUARE: CSSProperties = {
  aspectRatio: '1',
  width: '100%',
  minWidth: 0,
};

/** Tone-of-voice gradient (Figma ~94.64deg, black → light). */
const BRAND_GRADIENT_TEXT: CSSProperties = {
  backgroundImage:
    'linear-gradient(94.642deg, rgba(0,0,0,0.6) 5.94%, rgba(255,255,255,0.6) 94.7%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

function TileLabel({
  children,
  variant = 'dark',
}: {
  children: ReactNode;
  variant?: 'dark' | 'light';
}) {
  const light = variant === 'light';
  return (
    <span
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 2,
        padding: '2px 6px',
        borderRadius: 4,
        fontFamily: 'var(--theme-font-body)',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '16px',
        background: light ? 'rgba(255,255,255,0.08)' : 'rgba(5,5,5,0.08)',
        color: light ? 'rgba(255,255,255,0.64)' : 'rgba(5,5,5,0.64)',
        pointerEvents: 'none',
      }}
    >
      {children}
    </span>
  );
}

function themeVarsFromHexes(hexes: string[]): CSSProperties {
  const u = [...new Set(hexes)].slice(0, 4);
  const vars: Record<string, string> = {};
  if (u[0]) vars['--theme-accent-primary'] = u[0];
  if (u[1]) vars['--theme-data-1'] = u[1];
  if (u[2]) vars['--theme-data-2'] = u[2];
  if (u[3]) vars['--theme-data-3'] = u[3];
  return vars as CSSProperties;
}

const COLLAGE_SLOT_GRID: CSSProperties[] = [
  { gridColumn: '1', gridRow: '1 / span 2' },
  { gridColumn: '2', gridRow: '1' },
  { gridColumn: '2', gridRow: '2' },
  { gridColumn: '3', gridRow: '1' },
  { gridColumn: '3', gridRow: '2' },
];

function CollageStrip({
  flatImagery,
  thumbnailByUrl,
  onBackgroundClick,
}: {
  flatImagery: ImageryEntry[];
  thumbnailByUrl: Map<string, string>;
  onBackgroundClick?: () => void;
}) {
  const n = flatImagery.length;
  const tileBase: CSSProperties = {
    background: SG.card,
    borderRadius: SG.radius,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
  };

  if (n === 0 && onBackgroundClick) {
    return (
      <button
        type="button"
        onClick={onBackgroundClick}
        aria-label="Edit imagery selection"
        style={{
          marginTop: SG.gap,
          ...tileBase,
          position: 'relative',
          width: '100%',
          minHeight: 200,
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
          color: SG.labelMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-8)',
        }}
      >
        <TileLabel variant="dark">Imagery</TileLabel>
        <span className="ch-type-system-text-sm">No imagery in guide — tap to choose photos &amp; graphics</span>
      </button>
    );
  }

  if (n === 0) return null;

  return (
    <div
      role={onBackgroundClick ? 'presentation' : undefined}
        onClick={
        onBackgroundClick
          ? (e) => {
              if ((e.target as HTMLElement).closest('a')) return;
              onBackgroundClick();
            }
          : undefined
      }
      style={{
        marginTop: SG.gap,
        ...tileBase,
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2.35fr) minmax(0, 1fr) minmax(0, 1fr)',
        gridTemplateRows: 'repeat(2, minmax(200px, 1fr))',
        gap: 0,
        minHeight: 400,
        cursor: onBackgroundClick ? 'pointer' : undefined,
      }}
    >
      <TileLabel variant="light">Imagery</TileLabel>
      {COLLAGE_SLOT_GRID.map((gridStyle, slot) => {
        if (slot === 4 && n > 5) {
          const more = n - 4;
          return (
            <div
              key="more"
              style={{
                ...gridStyle,
                background: SG.collageMore,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--theme-font-body)',
                  fontSize: 28,
                  fontWeight: 500,
                  color: 'rgba(5,5,5,0.22)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                +{more}
                <br />
                more
              </p>
            </div>
          );
        }

        const imageIndex = slot;
        if (imageIndex >= n) {
          return (
            <div
              key={`empty-${slot}`}
              style={{
                ...gridStyle,
                background: '#e0e0e0',
                minHeight: 200,
              }}
            />
          );
        }

        const img = flatImagery[imageIndex]!;
        return (
          <div
            key={`${img.url}-${slot}`}
            style={{
              ...gridStyle,
              position: 'relative',
              minHeight: 200,
            }}
          >
            <a
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', width: '100%', height: '100%', minHeight: 200 }}
            >
              {thumbnailByUrl.has(img.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailByUrl.get(img.url)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div
                  className="ch-type-system-text-xs"
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#d9d9d9',
                    color: SG.labelMuted,
                  }}
                >
                  Preview
                </div>
              )}
            </a>
          </div>
        );
      })}
    </div>
  );
}

function brandVoiceBoardText(payload: StyleGuidePayload): string {
  if (!payload.brand) {
    return "Ramp's tone is direct, results-oriented, and efficiency-obsessed — every line of copy is framed around time saved, money saved, or manual work eliminated. It's confident and slightly aggressive in how it positions against competitors, but grounded in concrete outcomes rather than hype.";
  }
  const { toneOfVoice, keyFeaturesOrServices } = payload.brand;
  const voice = toneOfVoice.trim();
  const tail = keyFeaturesOrServices.filter(Boolean).join(', ');
  if (!voice && !tail) {
    return 'Brand summary did not return copy yet — run the analysis again from Brand.';
  }
  return tail ? `${voice}, ${tail}` : voice;
}

interface Props {
  payload: StyleGuidePayload;
  /** When set, tiles open the matching editor panel (guide-first flow). */
  onSectionClick?: (section: StyleGuideSection) => void;
}

function tileShell(
  interactive: boolean,
  onOpen: (() => void) | undefined,
  ariaLabel: string,
  tileStyle: CSSProperties,
  children: ReactNode
): ReactNode {
  if (interactive && onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={ariaLabel}
        style={{
          ...tileStyle,
          border: 'none',
          padding: tileStyle.padding ?? 0,
          textAlign: 'left' as const,
          font: 'inherit',
          color: 'inherit',
          width: '100%',
          cursor: 'pointer',
          display: tileStyle.display ?? 'block',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <div style={{ ...tileStyle, boxSizing: 'border-box' }}>{children}</div>
  );
}

export function StyleGuidePreview({ payload, onSectionClick }: Props) {
  const flatHexes = payload.colorsByRole.flatMap((g) =>
    g.entries.map((e) => normalizeColorHex(e.hex))
  );
  const themeStyle = themeVarsFromHexes(flatHexes);
  const paletteTop = flatHexes[0] ?? SG.lime;
  const paletteMid = flatHexes[1] ?? SG.warmGrey;
  const paletteBot = flatHexes[2] ?? SG.ink;

  const embeddedFontCss = useMemo(() => {
    return payload.fonts
      .map((f, i) => {
        if (!f.embeddedFont) return '';
        const alias = `__SGFont_${i}`;
        const u = JSON.stringify(f.embeddedFont.dataUrl);
        const fmt =
          f.embeddedFont.format === 'woff2'
            ? ` format('woff2')`
            : f.embeddedFont.format === 'woff'
              ? ` format('woff')`
              : f.embeddedFont.format === 'ttf'
                ? ` format('truetype')`
                : f.embeddedFont.format === 'otf'
                  ? ` format('opentype')`
                  : '';
        return `@font-face{font-family:'${alias}';src:url(${u})${fmt};font-display:swap;}`;
      })
      .join('');
  }, [payload.fonts]);

  const firstFont = payload.fonts[0];
  const firstFamilyLabel = firstFont?.familyStack.split(',')[0]?.replace(/["']/g, '').trim() ?? 'Typeface';
  const click = !!onSectionClick;

  const imagerySections = useMemo(() => {
    const byRole = new Map<ImageryRole, typeof payload.imagery>();
    for (const img of payload.imagery) {
      const list = byRole.get(img.role) ?? [];
      list.push(img);
      byRole.set(img.role, list);
    }
    const seen = new Set<ImageryRole>();
    const out: {
      role: ImageryRole;
      heading: string;
      items: typeof payload.imagery;
    }[] = [];
    for (const role of IMAGERY_ROLE_ORDER) {
      const items = byRole.get(role);
      if (items?.length) {
        out.push({ role, heading: IMAGERY_ROLE_LABELS[role], items });
        seen.add(role);
      }
    }
    for (const [role, items] of byRole) {
      if (!seen.has(role) && items.length) {
        out.push({ role, heading: IMAGERY_ROLE_LABELS[role] ?? role, items });
      }
    }
    return out;
  }, [payload]);

  const flatImagery = useMemo(
    () => imagerySections.flatMap((s) => s.items),
    [imagerySections]
  );

  const tileBase: CSSProperties = {
    background: SG.card,
    borderRadius: SG.radius,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
  };

  return (
    <>
      {embeddedFontCss ? (
        <style dangerouslySetInnerHTML={{ __html: embeddedFontCss }} />
      ) : null}
      <style>{`
        @media (max-width: 720px) {
          .style-guide-themes__grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <div
        className="style-guide-themes"
        style={{
          ...themeStyle,
          maxWidth: SG.boardMaxWidth,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
      <div
        className="style-guide-themes__grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: SG.gap,
          alignItems: 'start',
        }}
      >
        {/* Logo tile */}
        {(payload.logos.length > 0 || click) &&
          tileShell(
            click,
            onSectionClick ? () => onSectionClick('logos') : undefined,
            'Edit brand',
            {
              ...tileBase,
              ...BENTO_SQUARE,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: SG.tilePadLg,
              gap: 20,
            },
            <>
              <TileLabel>Brand</TileLabel>
              {payload.logos.length === 0 ? (
                <p className="ch-type-system-text-sm" style={{ color: SG.labelMuted, textAlign: 'center' }}>
                  No logo in guide — tap to add or choose marks
                </p>
              ) : (
                payload.logos.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(i === 0
                      ? {
                          width: LOGO_PRIMARY_PX,
                          maxWidth: '100%',
                          flexShrink: 0,
                          boxSizing: 'border-box',
                        }
                      : {}),
                  }}
                >
                  {item.uploaded && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.uploaded.dataUrl}
                      alt={item.uploaded.name}
                      style={
                        i === 0
                          ? {
                              display: 'block',
                              width: '100%',
                              height: 'auto',
                              objectFit: 'contain',
                            }
                          : { maxHeight: 56, width: 'auto', objectFit: 'contain' }
                      }
                    />
                  )}
                  {item.scraped?.url && payload.thumbnailByUrl.has(item.scraped.url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={payload.thumbnailByUrl.get(item.scraped.url)}
                      alt=""
                      style={
                        i === 0
                          ? {
                              display: 'block',
                              width: '100%',
                              height: 'auto',
                              objectFit: 'contain',
                            }
                          : { maxHeight: 56, width: 'auto', objectFit: 'contain' }
                      }
                    />
                  )}
                  {item.scraped?.url &&
                    !payload.thumbnailByUrl.has(item.scraped.url) &&
                    /\.svg/i.test(item.scraped.url) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.scraped.url}
                        alt=""
                        style={
                          i === 0
                            ? {
                                display: 'block',
                                width: '100%',
                                height: 'auto',
                                objectFit: 'contain',
                              }
                            : { maxHeight: 56, width: 'auto', objectFit: 'contain' }
                        }
                      />
                    )}
                  {item.scraped?.inlineSvgPreview && item.scraped.kind === 'svg-inline' && (
                    <InlineSvgPreview
                      svgMarkup={item.scraped.inlineSvgPreview}
                      maxHeight={i === 0 ? LOGO_PRIMARY_PX : 56}
                      maxWidth={i === 0 ? LOGO_PRIMARY_PX : undefined}
                    />
                  )}
                </div>
                ))
              )}
            </>
          )}

        {/* Color palette tile — Figma split: top band + bottom half / half */}
        {(payload.colorsByRole.length > 0 || click) &&
          tileShell(
            click,
            onSectionClick ? () => onSectionClick('colors') : undefined,
            'Edit colors',
            {
              ...tileBase,
              ...BENTO_SQUARE,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            },
            <>
              <TileLabel>Colors</TileLabel>
              {payload.colorsByRole.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: SG.tilePadMd,
                  }}
                >
                  <p className="ch-type-system-text-sm" style={{ color: SG.labelMuted, textAlign: 'center' }}>
                    No colors in guide — tap to edit palette
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ flex: '1 1 50%', minHeight: 0, background: paletteTop }} />
                  <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex' }}>
                    <div style={{ flex: 1, background: paletteMid }} />
                    <div style={{ flex: 1, background: paletteBot }} />
                  </div>
                </>
              )}
            </>
          )}

        {/* Brand keywords — gradient type + bottom fade */}
        {tileShell(
          click,
          onSectionClick ? () => onSectionClick('brand') : undefined,
          'Edit brand summary',
          {
            ...tileBase,
            ...BENTO_SQUARE,
            position: 'relative',
            padding: '40px 16px 16px 16px',
          },
          <>
            <TileLabel>Tone of voice</TileLabel>
            <p
              style={{
                fontFamily: 'var(--theme-font-body)',
                fontSize: 48,
                lineHeight: 1.12,
                fontWeight: 500,
                letterSpacing: '-0.12px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                ...BRAND_GRADIENT_TEXT,
              }}
            >
              {brandVoiceBoardText(payload)}
            </p>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '46%',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.65) 55%, #ffffff 100%)',
                pointerEvents: 'none',
              }}
            />
          </>
        )}

        {/* Typography tile */}
        {(firstFont || click) &&
          tileShell(
            click,
            onSectionClick ? () => onSectionClick('fonts') : undefined,
            'Edit fonts',
            {
              ...tileBase,
              ...BENTO_SQUARE,
              position: 'relative',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            },
            <>
              <TileLabel>Fonts</TileLabel>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  gap: 20,
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <p
                  style={{
                    fontFamily: previewFontStack(firstFont, 0),
                    fontSize: 120,
                    lineHeight: 0.9,
                    fontWeight: 400,
                    letterSpacing: '-0.12px',
                    color: SG.ink,
                    margin: 0,
                    flexShrink: 0,
                  }}
                >
                  Aa
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: 24,
                    minWidth: 0,
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--theme-font-body)',
                      fontSize: 20,
                      fontWeight: 500,
                      color: 'rgba(5,5,5,0.88)',
                      margin: 0,
                      letterSpacing: '-0.12px',
                      lineHeight: 1.25,
                    }}
                  >
                    {firstFont ? (
                      <>
                        {capitalizeFontNameLabel(firstFamilyLabel)}
                        <span style={{ fontWeight: 400, opacity: 0.72 }}> medium</span>
                      </>
                    ) : (
                      <span style={{ color: SG.labelMuted }}>No fonts in guide — tap to choose</span>
                    )}
                  </p>
                  {firstFont && payload.fonts.length > 1 && (
                    <p
                      style={{
                        fontFamily: 'var(--theme-font-body)',
                        fontSize: 12.4,
                        fontWeight: 500,
                        color: SG.labelMuted,
                        margin: 0,
                        whiteSpace: 'nowrap',
                        lineHeight: 1.2,
                      }}
                    >
                      +{payload.fonts.length - 1} more
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
      </div>

      {/* Imagery collage — full width, no gutters (hero left + 2×2; 5th cell = +more when needed) */}
      {(flatImagery.length > 0 || click) && (
        <CollageStrip
          flatImagery={flatImagery}
          thumbnailByUrl={payload.thumbnailByUrl}
          onBackgroundClick={onSectionClick ? () => onSectionClick('imagery') : undefined}
        />
      )}

      {/* Secondary fonts (after first) — compact row */}
      {payload.fonts.length > 1 && (
        <div
          style={{
            marginTop: SG.gap,
            display: 'flex',
            flexWrap: 'wrap',
            gap: SG.gap,
          }}
        >
          {payload.fonts.slice(1).map((f, idx) => {
            const i = idx + 1;
            return (
              <div
                key={f.familyStack}
                style={{
                  ...tileBase,
                  padding: SG.tilePadMd,
                  flex: '1 1 200px',
                }}
              >
                <p
                  style={{
                    fontFamily: previewFontStack(f, i),
                    fontSize: 16,
                    color: SG.ink,
                    margin: 0,
                  }}
                >
                  {f.familyStack.split(',')[0]?.replace(/["']/g, '').trim()}
                </p>
                <p className="ch-type-system-text-xs" style={{ marginTop: 8, color: SG.labelMuted }}>
                  {f.familyStack}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {payload.brand && (
        <details
          style={{
            marginTop: SG.gap,
            ...tileBase,
            padding: SG.tilePadMd,
          }}
        >
          <summary
            style={{
              fontFamily: 'var(--theme-font-body)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              color: SG.ink,
            }}
          >
            Full brand narrative
          </summary>
          <div
            style={{
              marginTop: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <div>
              <p className="ch-type-system-label-xs" style={{ marginBottom: 10 }}>
                Tone of voice
              </p>
              <p
                style={{
                  fontFamily: 'var(--theme-font-body)',
                  fontSize: 'clamp(18px, 2.1vw, 24px)',
                  lineHeight: 1.14,
                  fontWeight: 500,
                  letterSpacing: '-0.025em',
                  margin: 0,
                  ...BRAND_GRADIENT_TEXT,
                }}
              >
                {payload.brand.toneOfVoice}
              </p>
            </div>
            <div>
              <p className="ch-type-system-label-xs" style={{ marginBottom: 6 }}>
                What they do
              </p>
              <p style={{ fontFamily: 'var(--theme-font-body)', fontSize: 14, lineHeight: 1.5, color: SG.ink }}>
                {payload.brand.whatTheyDo}
              </p>
            </div>
            <div>
              <p className="ch-type-system-label-xs" style={{ marginBottom: 6 }}>
                Features & services
              </p>
              <ul
                style={{
                  fontFamily: 'var(--theme-font-body)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: SG.ink,
                  paddingLeft: 'var(--space-5)',
                  margin: 0,
                }}
              >
                {payload.brand.keyFeaturesOrServices.map((x, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="ch-type-system-label-xs" style={{ marginBottom: 6 }}>
                Pricing
              </p>
              <p style={{ fontFamily: 'var(--theme-font-body)', fontSize: 14, lineHeight: 1.5, color: SG.ink }}>
                {payload.brand.pricingSummary}
              </p>
            </div>
          </div>
        </details>
      )}
      </div>
    </>
  );
}
