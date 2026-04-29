'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CaretRight, DownloadSimple, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import type {
  BrandAnalysisApiResponse,
  ImageryRole,
  SiteExtractionResult,
} from '@/types/extraction';
import type { LogoUploadId, UploadedLogo, WizardSelections } from '@/types/wizard';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from '@/types/wizard';
import { ColorSwatch } from '@/components/ColorSwatch';
import { buildStyleGuidePayload } from '@/lib/buildStyleGuidePayload';
import { downloadImageFromUrl } from '@/lib/imageDownload';
import { colorSelectionId, fontId, imageId, logoEntryId, normalizeColorHex } from '@/lib/wizardIds';
import { defaultSelectionsFromScrape } from '@/lib/wizardSelections';
import {
  FONT_BADGE,
  IMAGERY_ROLE_LABELS,
  IMAGERY_ROLE_ORDER,
  prioritizeButtonFirst,
  ROLE_LABELS,
  ROLE_ORDER,
} from '@/lib/wizardLabels';
import { ImagePreviewModal } from '@/components/ImagePreviewModal';
import { InlineSvgPreview } from '@/components/InlineSvgPreview';
import { StyleGuidePreview, type StyleGuideSection } from './StyleGuidePreview';
import { hexLuminance, getLogoBg } from '@/lib/logoUtils';

type GuidePanel = null | StyleGuideSection;
type Phase = 'url' | 'guide';

const PANEL_TITLES: Record<Exclude<GuidePanel, null>, string> = {
  logos: 'Brand',
  fonts: 'Fonts',
  colors: 'Colors',
  imagery: 'Imagery',
  brand: 'Tone of voice & brand',
};

function svgMarkupToDataUrl(markup: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

export function SiteAuditWizard() {
  const [phase, setPhase] = useState<Phase>('url');
  const [panel, setPanel] = useState<GuidePanel>(null);
  const [url, setUrl] = useState('');
  const [additionalPagesText, setAdditionalPagesText] = useState('');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [data, setData] = useState<SiteExtractionResult | null>(null);
  const [selections, setSelections] = useState<WizardSelections | null>(null);

  const [brand, setBrand] = useState<BrandAnalysisApiResponse | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [extraUrlsOpen, setExtraUrlsOpen] = useState(false);
  const [claudeApiKey, setClaudeApiKey] = useState('');

  const thumbByUrl = useMemo(
    () => (data ? new Map(data.thumbnails.map((t) => [t.url, t.dataUrl])) : new Map()),
    [data]
  );

  function normalizeUrl(raw: string): string {
    const t = raw.trim();
    if (!t) return t;
    if (/^https?:\/\//i.test(t)) return t;
    return `https://www.${t.replace(/^www\./i, '')}`;
  }

  async function runScrape() {
    setScrapeLoading(true);
    setScrapeError(null);
    try {
      const primary = normalizeUrl(url);
      const additionalImageryUrls = Array.from(
        new Set(
          additionalPagesText
            .split(/[\n,]+/)
            .map((line) => normalizeUrl(line.trim()))
            .filter((u) => u && u !== primary)
        )
      );

      const res = await fetch('/api/extract-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: primary, additionalImageryUrls }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Scrape failed');
      const result = json as SiteExtractionResult;
      setData(result);
      setSelections(defaultSelectionsFromScrape(result));
      setBrand(null);
      setBrandError(null);
      setPanel(null);
      setPhase('guide');
      if (claudeApiKey.trim()) {
        void runBrandAnalysis(result.url);
      }
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setScrapeLoading(false);
    }
  }

  const toggleLogoId = useCallback((id: string) => {
    setSelections((s) => {
      if (!s) return s;
      const next = new Set(s.keptLogoIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, keptLogoIds: next };
    });
  }, []);

  const toggleFontId = useCallback((id: string) => {
    setSelections((s) => {
      if (!s) return s;
      const next = new Set(s.keptFontIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, keptFontIds: next };
    });
  }, []);

  const toggleColorId = useCallback((id: string) => {
    setSelections((s) => {
      if (!s) return s;
      const next = new Set(s.keptColorIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, keptColorIds: next };
    });
  }, []);

  const toggleImageId = useCallback((id: string) => {
    setSelections((s) => {
      if (!s) return s;
      const next = new Set(s.keptImageIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, keptImageIds: next };
    });
  }, []);

  const onPickUploads = useCallback(
    async (files: FileList | null) => {
      if (!files || !selections) return;
      const list = Array.from(files);
      const room = MAX_UPLOAD_FILES - selections.uploadedLogos.length;
      if (room <= 0) return;
      const nextUploads: UploadedLogo[] = [...selections.uploadedLogos];
      const nextKept = new Set(selections.keptLogoIds);
      for (const file of list.slice(0, room)) {
        if (file.size > MAX_UPLOAD_BYTES) continue;
        try {
          const dataUrl = await readFileAsDataUrl(file);
          const id = `upload-${crypto.randomUUID()}` as LogoUploadId;
          nextUploads.push({ id, name: file.name, dataUrl });
          nextKept.add(id);
        } catch {
          /* skip */
        }
      }
      setSelections({ ...selections, uploadedLogos: nextUploads, keptLogoIds: nextKept });
    },
    [selections]
  );

  function removeUpload(id: string) {
    setSelections((s) => {
      if (!s) return s;
      const nextKept = new Set(s.keptLogoIds);
      nextKept.delete(id);
      return {
        ...s,
        uploadedLogos: s.uploadedLogos.filter((u) => u.id !== id),
        keptLogoIds: nextKept,
      };
    });
  }

  async function runBrandAnalysis(urlOverride?: string) {
    const targetUrl = urlOverride ?? data?.url;
    if (!targetUrl) return;
    setBrandLoading(true);
    setBrandError(null);
    try {
      const res = await fetch('/api/analyze-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          ...(claudeApiKey.trim() ? { anthropicApiKey: claudeApiKey.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'AI analysis failed');
      setBrand(json as BrandAnalysisApiResponse);
    } catch (e) {
      setBrandError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBrandLoading(false);
    }
  }

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  const colorsByRole = useMemo(() => {
    if (!data) return [];
    const seenHex = new Set<string>();
    const groups = ROLE_ORDER.map((role) => {
      const entries = data.semanticColors
        .filter((c) => c.role === role)
        .filter((c) => {
          const h = normalizeColorHex(c.hex);
          if (seenHex.has(h)) return false;
          seenHex.add(h);
          return true;
        });
      return { role, label: ROLE_LABELS[role], entries };
    }).filter((g) => g.entries.length > 0);
    return prioritizeButtonFirst(groups);
  }, [data]);

  const imagerySections = useMemo(() => {
    if (!data) return [];
    const byRole = new Map<
      ImageryRole,
      { img: (typeof data.imagery)[number]; index: number }[]
    >();
    data.imagery.forEach((img, index) => {
      const role = img.role;
      const list = byRole.get(role) ?? [];
      list.push({ img, index });
      byRole.set(role, list);
    });
    const seen = new Set<ImageryRole>();
    const sections: {
      role: ImageryRole;
      heading: string;
      items: { img: (typeof data.imagery)[number]; index: number }[];
    }[] = [];
    for (const role of IMAGERY_ROLE_ORDER) {
      const items = byRole.get(role);
      if (items?.length) {
        sections.push({ role, heading: IMAGERY_ROLE_LABELS[role], items });
        seen.add(role);
      }
    }
    for (const [role, items] of byRole) {
      if (!seen.has(role) && items.length) {
        sections.push({
          role,
          heading: IMAGERY_ROLE_LABELS[role] ?? role,
          items,
        });
      }
    }
    return sections;
  }, [data]);

  const stylePayload =
    data && selections
      ? buildStyleGuidePayload(data, selections, brand?.brand ?? null)
      : null;

  const importRail = (
    <aside
      style={{
        background: '#ffffff',
        borderRight: '1px solid var(--color-border-subtle)',
        padding: 'clamp(24px, 4vw, 44px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
      <h1
        style={{
          fontFamily: 'var(--font-brand)',
          fontSize: 36,
          lineHeight: '40px',
          fontWeight: 500,
          letterSpacing: '-0.25px',
          color: 'rgba(5, 5, 5, 0.88)',
          margin: 'clamp(48px, 12vh, 120px) 0 var(--space-8)',
        }}
      >
        Import from URL
      </h1>
      <label
        htmlFor="audit-primary-url"
        className="ch-type-system-text-sm"
        style={{
          display: 'block',
          marginBottom: 10,
          color: 'rgba(5, 5, 5, 0.88)',
          letterSpacing: '-0.25px',
        }}
      >
        Website URL
      </label>
      <input
        id="audit-primary-url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="example.com"
        disabled={scrapeLoading}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && url.trim() && !scrapeLoading) void runScrape();
        }}
        style={{
          width: '100%',
          border: 'none',
          borderBottom: '1px solid rgba(5, 5, 5, 0.12)',
          borderRadius: 0,
          padding: '10px 0 12px',
          fontSize: 16,
          fontFamily: 'var(--font-system)',
          background: 'transparent',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        onClick={() => setExtraUrlsOpen((o) => !o)}
        disabled={scrapeLoading}
        style={{
          marginTop: 20,
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 36,
          padding: '6px 12px 6px 10px',
          borderRadius: 8,
          border: '1px solid rgba(5, 5, 5, 0.08)',
          background: '#f0f0f0',
          fontFamily: 'var(--font-system)',
          fontSize: 14,
          fontWeight: 500,
          color: 'rgba(5, 5, 5, 0.8)',
          cursor: scrapeLoading ? 'not-allowed' : 'pointer',
        }}
      >
        <Plus size={16} weight="bold" aria-hidden />
        Additional URL
      </button>
      {extraUrlsOpen && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <p className="ch-type-system-text-xs" style={{ marginBottom: 8, opacity: 0.85 }}>
            One per line or comma-separated. Imagery only; primary URL still drives logos, fonts, and
            colors.
          </p>
          <textarea
            className="ch-input"
            value={additionalPagesText}
            onChange={(e) => setAdditionalPagesText(e.target.value)}
            placeholder={'https://example.com/gallery'}
            disabled={scrapeLoading}
            rows={3}
            style={{ minHeight: 72, resize: 'vertical', fontFamily: 'inherit', width: '100%' }}
          />
        </div>
      )}
      <div style={{ marginTop: 'var(--space-8)' }}>
        <label
          htmlFor="claude-api-key"
          className="ch-type-system-text-sm"
          style={{
            display: 'block',
            marginBottom: 10,
            color: 'rgba(5, 5, 5, 0.88)',
            letterSpacing: '-0.25px',
          }}
        >
          Claude API key
          <span
            className="ch-type-system-text-xs"
            style={{ marginLeft: 8, opacity: 0.5, fontWeight: 400 }}
          >
            for brand summary
          </span>
        </label>
        <input
          id="claude-api-key"
          type="password"
          value={claudeApiKey}
          onChange={(e) => setClaudeApiKey(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          style={{
            width: '100%',
            border: 'none',
            borderBottom: '1px solid rgba(5, 5, 5, 0.12)',
            borderRadius: 0,
            padding: '10px 0 12px',
            fontSize: 16,
            fontFamily: 'var(--font-system)',
            background: 'transparent',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      {scrapeError && (
        <p className="ch-error-box" style={{ marginTop: 'var(--space-4)' }}>
          {scrapeError}
        </p>
      )}
      <div style={{ marginTop: 'var(--space-8)' }}>
        <button
          type="button"
          className="ch-btn-primary"
          disabled={scrapeLoading || !url.trim()}
          onClick={runScrape}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {scrapeLoading ? 'Importing…' : phase === 'guide' ? 'Re-import' : 'Import'}
          <CaretRight size={18} weight="bold" aria-hidden />
        </button>
      </div>
      {phase === 'guide' && data && (
        <p className="ch-type-system-text-xs" style={{ marginTop: 'var(--space-6)', opacity: 0.72 }}>
          Active: {data.url}
        </p>
      )}
      </div>
    </aside>
  );

  return (
    <>
      <style>{`
        @media (max-width: 900px) {
          .audit-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <ImagePreviewModal src={previewSrc} onClose={() => setPreviewSrc(null)} />
      <div
        className="audit-split"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, min(520px, 42vw)) minmax(0, 1fr)',
          minHeight: '100vh',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
      {importRail}
      <div
        style={{
          background: '#e8e8e8',
          padding: 'clamp(12px, 2vw, 24px)',
          overflow: 'auto',
          position: 'relative',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {phase === 'guide' && data && selections && stylePayload ? (
          <div style={{ width: '100%', maxWidth: 780 }}>
            <StyleGuidePreview payload={stylePayload} onSectionClick={(s) => setPanel(s)} />
          </div>
        ) : scrapeLoading ? (
          <div style={{ width: '100%', maxWidth: 780 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 32,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="sk-pulse"
                  style={{ aspectRatio: '1', borderRadius: 12 }}
                />
              ))}
            </div>
            <div
              className="sk-pulse"
              style={{ marginTop: 32, height: 400, borderRadius: 12 }}
            />
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              maxWidth: 780,
              minHeight: 320,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-8)',
              boxSizing: 'border-box',
            }}
          >
            <p
              className="ch-type-system-text-sm"
              style={{ margin: 0, textAlign: 'center', color: 'rgba(5,5,5,0.42)', maxWidth: 280 }}
            >
              Your brand kit preview will appear here after you import a URL.
            </p>
          </div>
        )}
      </div>
      </div>

      {panel && data && selections && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-panel-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(5,5,5,0.45)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: 'var(--space-6)',
            overflow: 'auto',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPanel(null);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '920px',
              marginTop: 'var(--space-8)',
              marginBottom: 'var(--space-8)',
              background: 'var(--color-surface-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-default)',
              padding: 'var(--space-8)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <h2 id="guide-panel-title" className="ch-type-brand-heading-sm">
                {PANEL_TITLES[panel]}
              </h2>
              <button type="button" className="ch-btn-primary" onClick={() => setPanel(null)}>
                Back to guide
              </button>
            </div>

            {panel === 'logos' && (
            <section>
              <p className="ch-type-system-text-sm" style={{ marginBottom: 'var(--space-6)' }}>
                We only list marks found in the header, navigation, or footer that look like the primary
                brand (home link, size, and “logo” hints). Upload alternates if we missed yours (max{' '}
                {MAX_UPLOAD_FILES} files, {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB each).
              </p>
              {data.logosAndMarks.length === 0 && (
                <p className="ch-type-system-text-sm" style={{ marginBottom: 'var(--space-4)' }}>
                  No main logo detected in the page chrome — use uploads below.
                </p>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 'var(--space-4)',
                  marginBottom: 'var(--space-8)',
                }}
              >
                {data.logosAndMarks.map((l) => {
                  const id = logoEntryId(l);
                  const selected = selections.keptLogoIds.has(id);
                  const pageBgDark = (() => {
                    const bg = stylePayload?.colorsByRole.find((g) => g.role === 'pageBackground');
                    if (!bg?.entries.length) return false;
                    return hexLuminance(normalizeColorHex(bg.entries[0].hex)) < 0.15;
                  })();
                  const logoBg = getLogoBg(l, pageBgDark);
                  return (
                    <div
                      key={id}
                      className="ch-card-selectable"
                      data-selected={selected ? 'true' : 'false'}
                    >
                      <div
                        style={{
                          padding: 'var(--space-3) var(--space-4) 0',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <span className="ch-badge">{l.kind}</span>
                        <span className="ch-badge">{l.role}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLogoId(id)}
                        style={{
                          width: '100%',
                          padding: 'var(--space-4)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          background: 'none',
                          border: 'none',
                          font: 'inherit',
                          color: 'inherit',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 'var(--space-3)',
                            borderRadius: 8,
                            background: logoBg ?? 'var(--color-surface-secondary)',
                            minHeight: 88,
                          }}
                        >
                          {l.url && thumbByUrl.has(l.url) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumbByUrl.get(l.url)}
                              alt=""
                              style={{ maxHeight: '72px', objectFit: 'contain' }}
                            />
                          )}
                          {l.url && /\.svg(\?|$)/i.test(l.url) && !thumbByUrl.has(l.url) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={l.url}
                              alt=""
                              style={{ maxHeight: '72px', objectFit: 'contain' }}
                            />
                          )}
                          {l.inlineSvgPreview && l.kind === 'svg-inline' && (
                            <InlineSvgPreview svgMarkup={l.inlineSvgPreview} maxHeight={72} />
                          )}
                        </div>
                        <p
                          className="ch-type-system-text-xs"
                          style={{ marginTop: 'var(--space-2)' }}
                          title={l.selectorHint}
                        >
                          {l.selectorHint}
                        </p>
                      </button>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 'var(--space-3)',
                          padding: '0 var(--space-4) var(--space-4)',
                          paddingTop: 'var(--space-3)',
                          borderTop: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        {l.url ? (
                          <button
                            type="button"
                            className="ch-btn-ghost"
                            aria-label="Open preview"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 'var(--space-2)',
                            }}
                            onClick={() => setPreviewSrc(l.url!)}
                          >
                            <MagnifyingGlass size={16} weight="regular" aria-hidden />
                          </button>
                        ) : l.inlineSvgPreview ? (
                          <button
                            type="button"
                            className="ch-btn-ghost"
                            aria-label="Open preview"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 'var(--space-2)',
                            }}
                            onClick={() => setPreviewSrc(svgMarkupToDataUrl(l.inlineSvgPreview!))}
                          >
                            <MagnifyingGlass size={16} weight="regular" aria-hidden />
                          </button>
                        ) : (
                          <span />
                        )}
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: 'var(--space-2)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleLogoId(id)}
                            aria-label="Include logo"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="ch-type-system-label-sm" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                Upload logos
              </label>
              <input
                type="file"
                accept="image/*,.svg"
                multiple
                className="ch-type-system-text-sm"
                onChange={(e) => onPickUploads(e.target.files)}
                disabled={selections.uploadedLogos.length >= MAX_UPLOAD_FILES}
              />
              {selections.uploadedLogos.length > 0 && (
                <ul
                  style={{
                    marginTop: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  {selections.uploadedLogos.map((u) => {
                    const selected = selections.keptLogoIds.has(u.id);
                    return (
                      <li
                        key={u.id}
                        className="ch-card-selectable"
                        data-selected={selected ? 'true' : 'false'}
                        style={{ padding: 'var(--space-3)' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleLogoId(u.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-4)',
                              flex: 1,
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: 'inherit',
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u.dataUrl} alt="" style={{ height: '48px', width: 'auto' }} />
                            <span className="ch-type-system-text-sm">{u.name}</span>
                          </button>
                          <button type="button" className="ch-btn-ghost" onClick={() => removeUpload(u.id)}>
                            Remove
                          </button>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 'var(--space-3)',
                            paddingTop: 'var(--space-3)',
                            borderTop: '1px solid var(--color-border-subtle)',
                          }}
                        >
                          <button
                            type="button"
                            className="ch-btn-ghost"
                            aria-label="Open preview"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 'var(--space-2)',
                            }}
                            onClick={() => setPreviewSrc(u.dataUrl)}
                          >
                            <MagnifyingGlass size={16} weight="regular" aria-hidden />
                          </button>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                              padding: 'var(--space-2)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleLogoId(u.id)}
                              aria-label="Include uploaded logo"
                            />
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {panel === 'fonts' && (
            <section>
              {/* Inject @font-face for all fonts so previews render correctly */}
              <style dangerouslySetInnerHTML={{
                __html: data.fonts.map((f, i) => {
                  if (!f.embeddedFont) return '';
                  const alias = `__PanelFont_${i}`;
                  const u = JSON.stringify(f.embeddedFont.dataUrl);
                  const fmt = f.embeddedFont.format === 'woff2' ? ` format('woff2')`
                    : f.embeddedFont.format === 'woff' ? ` format('woff')`
                    : f.embeddedFont.format === 'ttf' ? ` format('truetype')`
                    : f.embeddedFont.format === 'otf' ? ` format('opentype')` : '';
                  return `@font-face{font-family:'${alias}';src:url(${u})${fmt};font-display:swap;}`;
                }).join('')
              }} />
              <p className="ch-type-system-text-sm" style={{ marginBottom: 'var(--space-6)' }}>
                We try to download webfont files from captured <code className="font-mono">@font-face</code>{' '}
                URLs for the style guide. If the browser couldn&apos;t read CSS (cross-origin) or the host
                blocks fetches, you&apos;ll see a note — upload licensed files when needed.
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {data.fonts.map((f, fontIndex) => {
                  const id = fontId(f.familyStack);
                  const selected = selections.keptFontIds.has(id);
                  const previewFamily = f.embeddedFont
                    ? `'__PanelFont_${fontIndex}', ${f.familyStack}`
                    : f.familyStack;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="ch-card-selectable"
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => toggleFontId(id)}
                        style={{
                          width: '100%',
                          padding: 'var(--space-4)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: 'var(--space-3)',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          padding: 'var(--space-4)',
                          borderRadius: 8,
                          background: 'var(--color-surface-secondary)',
                          marginBottom: 'var(--space-1)',
                        }}>
                          <p style={{
                            fontFamily: previewFamily,
                            fontSize: 36,
                            lineHeight: 1.1,
                            fontWeight: 400,
                            color: '#0c0a08',
                            margin: '0 0 4px',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          }}>
                            The quick brown fox
                          </p>
                          <p style={{
                            fontFamily: previewFamily,
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: 'rgba(5,5,5,0.55)',
                            margin: 0,
                          }}>
                            ABCDEFGHIJKLMNOPQRSTUVWXYZ · 0123456789
                          </p>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 'var(--space-3)',
                          }}
                        >
                          <div style={{ flex: '1 1 200px' }}>
                            <p className="ch-type-system-text-sm" style={{ fontFamily: 'monospace' }}>
                              {f.familyStack}
                            </p>
                            {f.usageSample && (
                              <p className="ch-type-system-text-xs" style={{ marginTop: 'var(--space-2)' }}>
                                {f.usageSample}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                            <span className="ch-badge">{FONT_BADGE[f.classification] ?? f.classification}</span>
                            {f.embeddedFont && <span className="ch-badge">Downloaded for preview</span>}
                            {f.needsUserFontUpload && (
                              <span className="ch-badge ch-badge-warning">Upload advised</span>
                            )}
                          </div>
                        </div>
                        {f.embeddedFontWarning && (
                          <p
                            className="ch-type-system-text-xs"
                            style={{
                              color: 'var(--color-text-secondary)',
                              borderLeft: '2px solid var(--color-border-default)',
                              paddingLeft: 'var(--space-3)',
                            }}
                          >
                            {f.embeddedFontWarning}
                          </p>
                        )}
                        {f.userMessage && !f.embeddedFontWarning && (
                          <p className="ch-type-system-text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {f.userMessage}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {panel === 'colors' && (
            <section>
              <p className="ch-type-system-text-sm" style={{ marginBottom: 'var(--space-6)' }}>
                Same semantic groupings as the scrape. Click to exclude colors you don&apos;t want in
                the guide.
              </p>
              {stylePayload && (stylePayload.brandColors.primary || stylePayload.brandColors.secondary || stylePayload.brandColors.tertiary) && (
                <div style={{ marginBottom: 'var(--space-8)' }}>
                  <p className="ch-type-system-label-xs" style={{ marginBottom: 'var(--space-3)' }}>Brand colors</p>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    {([
                      { label: 'Primary', hex: stylePayload.brandColors.primary },
                      { label: 'Secondary', hex: stylePayload.brandColors.secondary },
                      { label: 'Tertiary', hex: stylePayload.brandColors.tertiary },
                    ] as { label: string; hex: string | null }[]).filter((b) => b.hex).map(({ label, hex }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: hex!,
                          border: '1px solid rgba(5,5,5,0.08)',
                          flexShrink: 0,
                        }} />
                        <div>
                          <p className="ch-type-system-label-xs" style={{ margin: 0 }}>{label}</p>
                          <p className="ch-type-system-text-xs" style={{ margin: 0, opacity: 0.6 }}>{hex}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
                {colorsByRole.map(({ role, label, entries }) => (
                  <div key={role}>
                    <p className="ch-type-system-label-xs" style={{ marginBottom: 'var(--space-4)' }}>
                      {label}
                    </p>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: 'var(--space-3)',
                      }}
                    >
                      {entries.map((entry) => {
                        const id = colorSelectionId(entry.hex);
                        return (
                          <ColorSwatch
                            key={id}
                            entry={entry}
                            selected={selections.keptColorIds.has(id)}
                            onToggle={() => toggleColorId(id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {panel === 'imagery' && (
            <section>
              <p className="ch-type-system-text-sm" style={{ marginBottom: 'var(--space-6)' }}>
                Includes raster URLs, SVG assets, and inline SVG from the page. Large backgrounds
                and hero fills are grouped under &quot;Large backgrounds&quot;; chrome icons and
                marks under &quot;Icons &amp; marks&quot;. Extra URLs from step 1 add imagery only.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
                {imagerySections.map(({ role, heading, items }) => (
                  <div key={role}>
                    <h3
                      className="ch-type-brand-heading-xs"
                      style={{ marginBottom: 'var(--space-4)' }}
                    >
                      {heading}
                    </h3>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: 'var(--space-4)',
                      }}
                    >
                      {items.map(({ img, index: i }) => {
                        const id = imageId(i);
                        const selected = selections.keptImageIds.has(id);
                        const isSvg = /\.svg(\?|$)/i.test(img.url);
                        return (
                          <div
                            key={id}
                            className="ch-card-selectable"
                            data-selected={selected ? 'true' : 'false'}
                            style={{ overflow: 'hidden' }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleImageId(id)}
                              style={{
                                width: '100%',
                                padding: 0,
                                cursor: 'pointer',
                                textAlign: 'left',
                                background: 'none',
                                border: 'none',
                                display: 'block',
                                color: 'inherit',
                              }}
                            >
                              <div
                                style={{
                                  aspectRatio: '1',
                                  background: 'var(--color-surface-secondary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {thumbByUrl.has(img.url) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={thumbByUrl.get(img.url)}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                ) : isSvg ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={img.url}
                                    alt=""
                                    style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
                                  />
                                ) : (
                                  <span
                                    className="ch-type-system-text-xs"
                                    style={{ padding: 'var(--space-2)' }}
                                  >
                                    No preview
                                  </span>
                                )}
                              </div>
                            </button>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 'var(--space-3)',
                                padding: 'var(--space-3)',
                                borderTop: '1px solid var(--color-border-subtle)',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-1)',
                                }}
                              >
                                <button
                                  type="button"
                                  className="ch-btn-ghost"
                                  aria-label="Open preview"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 'var(--space-2)',
                                  }}
                                  onClick={() => setPreviewSrc(img.url)}
                                >
                                  <MagnifyingGlass size={16} weight="regular" aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="ch-btn-ghost"
                                  aria-label="Download image"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 'var(--space-2)',
                                  }}
                                  onClick={() => void downloadImageFromUrl(img.url, id)}
                                >
                                  <DownloadSimple size={16} weight="regular" aria-hidden />
                                </button>
                              </div>
                              <label
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  padding: 'var(--space-2)',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleImageId(id)}
                                  aria-label="Include image"
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {panel === 'brand' && (
            <section>
              <p className="ch-type-system-text-sm" style={{ marginBottom: 'var(--space-6)' }}>
                Optional AI pass. Paste your Claude API key in the left panel to enable this, or
                set <code className="font-mono">ANTHROPIC_API_KEY</code> in .env.local. Runs only
                when you click the button — not during the scrape.
              </p>
              {!claudeApiKey.trim() && !brand && (
                <p className="ch-error-box" style={{ marginBottom: 'var(--space-4)' }}>
                  Please add a Claude API key to run brand summary.
                </p>
              )}
              <button
                type="button"
                className="ch-btn-primary"
                disabled={brandLoading || !claudeApiKey.trim()}
                onClick={() => void runBrandAnalysis()}
                style={{ marginBottom: 'var(--space-4)' }}
              >
                {brandLoading ? 'Analyzing…' : brand ? 'Run again' : 'Run AI brand summary'}
              </button>
              {brandError && <p className="ch-error-box">{brandError}</p>}
              {brand && (
                <div
                  style={{
                    marginTop: 'var(--space-6)',
                    padding: 'var(--space-6)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <p className="ch-type-system-text-xs" style={{ marginBottom: 'var(--space-4)' }}>
                    {brand.model} · {brand.textCharsUsed.toLocaleString()} chars
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    <div>
                      <p className="ch-type-system-label-xs" style={{ marginBottom: 'var(--space-2)' }}>
                        Tone of voice
                      </p>
                      <p className="ch-type-system-text-sm">{brand.brand.toneOfVoice}</p>
                    </div>
                    <div>
                      <p className="ch-type-system-label-xs" style={{ marginBottom: 'var(--space-2)' }}>
                        What they do
                      </p>
                      <p className="ch-type-system-text-sm">{brand.brand.whatTheyDo}</p>
                    </div>
                    <div>
                      <p className="ch-type-system-label-xs" style={{ marginBottom: 'var(--space-2)' }}>
                        Features / services
                      </p>
                      <ul
                        className="ch-type-system-text-sm"
                        style={{ paddingLeft: 'var(--space-5)' }}
                      >
                        {brand.brand.keyFeaturesOrServices.map((x, j) => (
                          <li key={j}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="ch-type-system-label-xs" style={{ marginBottom: 'var(--space-2)' }}>
                        Pricing
                      </p>
                      <p className="ch-type-system-text-sm">{brand.brand.pricingSummary}</p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          </div>
        </div>
      )}
    </>
  );
}
