// Categories live in the `categories` table; select them with
// `category:categories(name_en, name_ar)` and render with getCategoryLabel.
export type Category = { name_en: string; name_ar: string | null }

export function getCategoryLabel(category: Category | null | undefined, lang: 'en' | 'ar' = 'en'): string {
  if (!category) return ''
  return (lang === 'ar' && category.name_ar) || category.name_en
}
