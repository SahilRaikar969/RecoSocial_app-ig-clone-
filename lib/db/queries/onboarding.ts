import { createClient } from '@/lib/supabase/server'

export async function getOnboardingCategories() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function getProfileCategoryPreferenceSlugs(profileId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profile_category_preferences')
    .select(`
      category_id,
      categories (
        id,
        name,
        slug
      )
    `)
    .eq('profile_id', profileId)

  if (error) {
    throw new Error(error.message)
  }

  const slugs = (data ?? [])
    .map((row) => {
      const nested = Array.isArray(row?.categories)
        ? row.categories[0] ?? null
        : row?.categories ?? null

      return nested?.slug ?? null
    })
    .filter(Boolean)

  return [...new Set(slugs)]
}