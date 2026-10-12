import type { CategoryJoin, NormalizedCategoryJoin } from '@/lib/db/query-types'

/** PostgREST relation shapes may be a single category, a list, or null. */
export function normalizeNestedCategory(item: CategoryJoin): NormalizedCategoryJoin {
  const nested = Array.isArray(item?.categories)
    ? item.categories[0] ?? null
    : item?.categories ?? null

  return {
    category_id: item?.category_id ?? '',
    categories: nested
      ? {
          id: nested.id,
          name: nested.name,
          slug: nested.slug,
        }
      : null,
  }
}
