/**
 * Single source of truth for brand tokens. Mirror of tailwind.config.ts.
 * Import this in React components that need a color outside Tailwind (e.g. SVG).
 */

export const brand = {
  // Primary
  royal:  '#0A47A5',
  cobalt: '#2563EB',
  navy:   '#0B1F47',
  gold:   '#D4A72C',
  honey:  '#E5B44A',
  cream:  '#FAF5E6',
  bg:     '#FDFBF2',

  // Functional
  ink:       '#0B1F47',
  inkMuted:  '#57534e',
  border:    '#e7e5e4',
  surface:   '#ffffff',

  gradient: 'linear-gradient(90deg, #0A47A5 0%, #2563EB 55%, #D4A72C 100%)',
} as const;

export const brandName = 'Reviewencer';
export const brandTagline = 'AI-powered reviews for the UAE.';
