export interface ColorEntry {
  hex: string;
  source: string;
  property: string;
}

export interface ColorExtractionResult {
  primaryButtons: ColorEntry[];
  elementBackgrounds: ColorEntry[];
  pageBackgrounds: ColorEntry[];
  textColors: ColorEntry[];
  cssVariables: ColorEntry[];
  url: string;
  scrapedAt: string;
}

export interface ExtractionError {
  error: string;
  url: string;
}
