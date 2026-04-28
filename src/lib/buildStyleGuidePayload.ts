import type { SiteExtractionResult } from '@/types/extraction';
import type { StyleGuidePayload, WizardSelections } from '@/types/wizard';
import type { BrandAnalysisResult } from '@/types/extraction';
import { colorSelectionId, fontId, imageId, logoEntryId, normalizeColorHex } from '@/lib/wizardIds';
import { prioritizeButtonFirst, ROLE_LABELS, ROLE_ORDER } from '@/lib/wizardLabels';

export function buildStyleGuidePayload(
  data: SiteExtractionResult,
  s: WizardSelections,
  brand: BrandAnalysisResult | null
): StyleGuidePayload {
  const logos: StyleGuidePayload['logos'] = [];
  data.logosAndMarks.forEach((l, i) => {
    if (s.keptLogoIds.has(logoEntryId(l))) logos.push({ scraped: l, index: i });
  });
  s.uploadedLogos.forEach((u) => {
    if (s.keptLogoIds.has(u.id)) logos.push({ uploaded: u });
  });

  const fonts = data.fonts.filter((f) => s.keptFontIds.has(fontId(f.familyStack)));

  const keptColors: SiteExtractionResult['semanticColors'] = [];
  const seenHex = new Set<string>();
  for (const c of data.semanticColors) {
    const h = normalizeColorHex(c.hex);
    if (!s.keptColorIds.has(colorSelectionId(c.hex))) continue;
    if (seenHex.has(h)) continue;
    seenHex.add(h);
    keptColors.push(c);
  }
  const colorsByRole = prioritizeButtonFirst(
    ROLE_ORDER.map((role) => ({
      role,
      label: ROLE_LABELS[role],
      entries: keptColors.filter((c) => c.role === role),
    })).filter((g) => g.entries.length > 0)
  );

  const imagery = data.imagery.filter((_, i) => s.keptImageIds.has(imageId(i)));

  const thumbnailByUrl = new Map(data.thumbnails.map((t) => [t.url, t.dataUrl]));

  return {
    sourceUrl: data.url,
    scrapedAt: data.scrapedAt,
    logos,
    fonts,
    colorsByRole,
    imagery,
    thumbnailByUrl,
    brand,
  };
}
