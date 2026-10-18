/**
 * Category chips shown in the UI. Ids are slugs from the `categories` table
 * (life_moments → categories taxonomy); this list is the subset we feature,
 * ordered by how many businesses each has. Any other slug still renders via
 * categoryLabel().
 */

export interface CategoryDef {
  id:    string;
  label: string;
  emoji: string;
  tint:  string; // tailwind gradient classes
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'restaurants',          label: 'Restaurants',     emoji: '🍽️', tint: 'from-gold-500 to-gold-400' },
  { id: 'salons-spas',          label: 'Salons & spas',   emoji: '💇', tint: 'from-royal-500 to-gold-400' },
  { id: 'general-clinics',      label: 'Clinics',         emoji: '🩺', tint: 'from-royal-600 to-royal-500' },
  { id: 'hotels',               label: 'Hotels',          emoji: '🏨', tint: 'from-royal-900 to-royal-600' },
  { id: 'sports-fitness',       label: 'Gyms & fitness',  emoji: '🏋️', tint: 'from-royal-600 to-gold-500' },
  { id: 'dental',               label: 'Dental',          emoji: '🦷', tint: 'from-royal-500 to-royal-600' },
  { id: 'schools',              label: 'Schools',         emoji: '🏫', tint: 'from-gold-400 to-royal-500' },
  { id: 'shopping-malls',       label: 'Malls',           emoji: '🛍️', tint: 'from-gold-500 to-royal-500' },
  { id: 'real-estate',          label: 'Real estate',     emoji: '🏘️', tint: 'from-royal-900 to-royal-600' },
  { id: 'car-dealers',          label: 'Car dealers',     emoji: '🚗', tint: 'from-royal-600 to-royal-500' },
  { id: 'nurseries',            label: 'Nurseries',       emoji: '🧸', tint: 'from-gold-400 to-gold-500' },
  { id: 'family-entertainment', label: 'Family fun',      emoji: '🎠', tint: 'from-gold-500 to-royal-500' },
  { id: 'delivery-rideshare',   label: 'Delivery & rides',emoji: '🛵', tint: 'from-gold-400 to-royal-500' },
  { id: 'theme-parks',          label: 'Attractions',     emoji: '🎢', tint: 'from-royal-600 to-gold-500' },
  { id: 'banks',                label: 'Banks',           emoji: '🏦', tint: 'from-royal-600 to-royal-500' },
  { id: 'telecom',              label: 'Telecom',         emoji: '📶', tint: 'from-royal-500 to-royal-600' },
];

export function getCategory(id: string | null | undefined): CategoryDef | undefined {
  return id ? CATEGORIES.find(c => c.id === id) : undefined;
}

/** Display label for any category slug — featured label if we have one, else the slug humanised. */
export function categoryLabel(id: string | null | undefined): string {
  if (!id) return '';
  return getCategory(id)?.label ?? id.replace(/-/g, ' ').replace(/^\w/, ch => ch.toUpperCase());
}
