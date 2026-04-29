import type {
  BrandAnalysisResult,
  FontEntry,
  ImageryEntry,
  LogoOrMarkEntry,
  SemanticColorEntry,
} from '@/types/extraction';
import type { BrandColorHierarchy } from '@/lib/colorUtils';

export type LogoUploadId = `upload-${string}`;
/** Scraped logo ids from `logoEntryId()` plus uploads */
export type LogoItemId = string;

export interface UploadedLogo {
  id: LogoUploadId;
  name: string;
  dataUrl: string;
}

export interface WizardSelections {
  keptLogoIds: Set<string>;
  keptFontIds: Set<string>;
  keptColorIds: Set<string>;
  keptImageIds: Set<string>;
  uploadedLogos: UploadedLogo[];
}

export interface VoiceSettings {
  aboutBrand: string;
  brandPersonality: string;
  slidePreferences: string;
}

export interface StyleGuidePayload {
  sourceUrl: string;
  scrapedAt: string;
  logos: Array<{ scraped?: LogoOrMarkEntry; index?: number; uploaded?: UploadedLogo }>;
  fonts: FontEntry[];
  colorsByRole: Array<{ role: string; label: string; entries: SemanticColorEntry[] }>;
  brandColors: BrandColorHierarchy;
  imagery: ImageryEntry[];
  thumbnailByUrl: Map<string, string>;
  brand: BrandAnalysisResult | null;
  voiceSettings: VoiceSettings;
}

export const MAX_UPLOAD_FILES = 5;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
