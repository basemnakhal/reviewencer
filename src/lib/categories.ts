/**
 * Static list of UAE B2C categories. Mirrors rows in the `categories` table
 * seeded by supabase/seed.sql — keep in sync.
 */

export interface CategoryDef {
  id:    string;
  label: string;
  emoji: string;
  tint:  string; // tailwind gradient classes
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'banking',    label: 'Banking',      emoji: '🏦', tint: 'from-royal-600 to-royal-500' },
  { id: 'ecommerce',  label: 'E-commerce',   emoji: '📦', tint: 'from-gold-500 to-gold-400' },
  { id: 'delivery',   label: 'Food delivery',emoji: '🛵', tint: 'from-gold-400 to-royal-500' },
  { id: 'telecom',    label: 'Telecom',      emoji: '📶', tint: 'from-royal-500 to-royal-600' },
  { id: 'ride',       label: 'Ride-hailing', emoji: '🚕', tint: 'from-royal-600 to-gold-500' },
  { id: 'realestate', label: 'Real estate',  emoji: '🏘️', tint: 'from-royal-900 to-royal-600' },
];

export function getCategory(id: string): CategoryDef | undefined {
  return CATEGORIES.find(c => c.id === id);
}
