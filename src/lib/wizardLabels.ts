import type { ImageryRole, SemanticColorRole } from '@/types/extraction';

export const ROLE_ORDER: SemanticColorRole[] = [
  'pageBackground',
  'sectionBackground',
  'card',
  'heading',
  'subheading',
  'body',
  'link',
  'headerCta',
  'button',
  'border',
];

/** Put header CTAs then buttons first (primary brand color signal). */
export function prioritizeButtonFirst<
  T extends { role: SemanticColorRole; entries: readonly unknown[] },
>(groups: T[]): T[] {
  const headerCta = groups.find((g) => g.role === 'headerCta');
  const button = groups.find((g) => g.role === 'button');
  const rest = groups.filter((g) => g.role !== 'headerCta' && g.role !== 'button');
  return [...(headerCta ? [headerCta] : []), ...(button ? [button] : []), ...rest];
}

export const ROLE_LABELS: Record<SemanticColorRole, string> = {
  pageBackground: 'Page background',
  sectionBackground: 'Sections & hero',
  card: 'Cards & panels',
  heading: 'Headings',
  subheading: 'Subheadings',
  body: 'Body text',
  link: 'Links',
  headerCta: 'Header CTAs',
  button: 'Buttons',
  border: 'Borders',
};

export const FONT_BADGE: Record<string, string> = {
  system: 'System',
  google: 'Google Fonts',
  adobe: 'Adobe Fonts',
  bunny: 'Bunny Fonts',
  'custom-unknown': 'Custom / unknown',
};

export const IMAGERY_ROLE_LABELS: Record<ImageryRole, string> = {
  background: 'Large backgrounds',
  decorative: 'Icons & marks',
  primaryLogo: 'Primary logo',
  secondaryLogo: 'Other logo / mark',
  misc: 'Misc',
};

/** Section order in the imagery picker and style guide. */
export const IMAGERY_ROLE_ORDER: ImageryRole[] = [
  'background',
  'decorative',
  'primaryLogo',
  'secondaryLogo',
  'misc',
];
