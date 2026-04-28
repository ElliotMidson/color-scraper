import type { SiteExtractionResult } from '@/types/extraction';
import type { WizardSelections } from '@/types/wizard';
import { colorSelectionId, fontId, imageId, logoEntryId } from '@/lib/wizardIds';

export function defaultSelectionsFromScrape(data: SiteExtractionResult): WizardSelections {
  const keptLogoIds = new Set<string>();
  data.logosAndMarks.forEach((l) => keptLogoIds.add(logoEntryId(l)));

  const keptFontIds = new Set<string>();
  data.fonts.forEach((f) => keptFontIds.add(fontId(f.familyStack)));

  const keptColorIds = new Set<string>();
  data.semanticColors.forEach((c) => keptColorIds.add(colorSelectionId(c.hex)));

  const keptImageIds = new Set<string>();
  data.imagery.forEach((_, i) => keptImageIds.add(imageId(i)));

  return {
    keptLogoIds,
    keptFontIds,
    keptColorIds,
    keptImageIds,
    uploadedLogos: [],
  };
}
