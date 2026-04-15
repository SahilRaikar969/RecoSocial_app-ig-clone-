import { createClient } from '@/lib/supabase/server'

function normalizeNestedCategory(item: any) {
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

export async function getEditablePost(postId: string, viewerProfileId: string) {
  const supabase = await createClient()

  const safePostId = String(postId || '').trim()

  if (!safePostId) {
    return {
      post: null,
      unauthorized: false,
    }
  }

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      author_id,
      caption,
      media_type,
      media_path,
      thumbnail_path,
      created_at,
      post_categories (
        category_id,
        categories (
          id,
          name,
          slug
        )
      )
    `)
    .eq('id', safePostId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return {
      post: null,
      unauthorized: false,
    }
  }

  if (data.author_id !== viewerProfileId) {
    return {
      post: null,
      unauthorized: true,
    }
  }

  return {
    unauthorized: false,
    post: {
      ...data,
      post_categories: Array.isArray(data.post_categories)
        ? data.post_categories.map(normalizeNestedCategory)
        : [],
    },
  }
}