export type SemanticColorRole =
  | 'pageBackground'
  | 'sectionBackground'
  | 'card'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'link'
  | 'headerCta'
  | 'button'
  | 'border';

export interface SemanticColorEntry {
  role: SemanticColorRole;
  hex: string;
  source: string;
  property: string;
}

export type LogoKind = 'raster' | 'svg-inline' | 'svg-url';
export type LogoRole = 'logo' | 'icon' | 'mark';

export interface LogoOrMarkEntry {
  /** Absolute or site-relative URL when applicable */
  url?: string;
  kind: LogoKind;
  role: LogoRole;
  selectorHint: string;
  alt?: string;
  /** Bounded inline SVG snippet when kind is svg-inline */
  inlineSvgPreview?: string;
}

export type FontClassification = 'system' | 'google' | 'adobe' | 'bunny' | 'custom-unknown';

export type EmbeddedFontFormat = 'woff2' | 'woff' | 'ttf' | 'otf' | 'unknown';

export interface FontEntry {
  familyStack: string;
  usageSample?: string;
  classification: FontClassification;
  needsUserFontUpload: boolean;
  userMessage?: string;
  evidence: string[];
  /** Server-fetched @font-face binary for offline preview (bounded size). */
  embeddedFont?: {
    dataUrl: string;
    format: EmbeddedFontFormat;
    sourceUrl: string;
  };
  /** Shown when download failed, was skipped, or no fetchable URL existed. */
  embeddedFontWarning?: string;
}

/** Visual/content classification for raster discovery (one best URL per element). */
export type ImageryRole =
  | 'background'
  | 'decorative'
  | 'primaryLogo'
  | 'secondaryLogo'
  | 'misc';

export interface ImageryEntry {
  url: string;
  role: ImageryRole;
  alt?: string;
  width?: number;
  height?: number;
}

export interface ThumbnailEntry {
  url: string;
  role: ImageryRole | LogoRole | 'logo-asset';
  dataUrl: string;
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface SiteExtractionResult {
  semanticColors: SemanticColorEntry[];
  logosAndMarks: LogoOrMarkEntry[];
  fonts: FontEntry[];
  imagery: ImageryEntry[];
  thumbnails: ThumbnailEntry[];
  url: string;
  scrapedAt: string;
}

/** LLM-derived summary from visible page copy (on-demand only). */
export interface BrandAnalysisResult {
  toneOfVoice: string;
  whatTheyDo: string;
  keyFeaturesOrServices: string[];
  pricingSummary: string;
}

export interface BrandAnalysisApiResponse {
  brand: BrandAnalysisResult;
  analyzedUrl: string;
  textCharsUsed: number;
  model: string;
}
