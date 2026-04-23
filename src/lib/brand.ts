/**
 * Single source of truth for brand tokens. Mirror of tailwind.config.ts.
 * Import this in React components that need a color outside Tailwind (e.g. SVG).
 *
 * Brand direction: blue-to-purple gradient (social-first review platform).
 * Legacy token names (royal/gold/cream) are kept as aliases so existing
 * class names continue to resolve; the VALUES behind them are the new brand.
 */

export const brand = {
  // Primary brand
  primary: '#2B8BFF', // blue
  accent:  '#7B2CFF', // purple
  hover:   '#5FA2FF', // primary hover tint
  ink:     '#0D1117', // near-black — text / dark surfaces

  // Legacy aliases (remapped values — same names, new colors)
  royal:  '#2B8BFF', // was #0A47A5
  cobalt: '#5FA2FF', // was #2563EB
  navy:   '#0D1117', // was #0B1F47
  gold:   '#7B2CFF', // was #D4A72C
  honey:  '#9D5FFF', // was #E5B44A
  cream:  '#F1F1F3', // was #FAF5E6
  bg:     '#FAFAFB', // was #FDFBF2

  // Functional
  inkMuted:  '#57534e',
  border:    '#e7e5e4',
  surface:   '#ffffff',

  gradient: 'linear-gradient(135deg, #2B8BFF 0%, #7B2CFF 100%)',
} as const;

export const brandName = 'Reviewencer';
export const brandTagline = 'AI-powered reviews for the UAE.';
