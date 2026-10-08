import type { CategoryJoin } from '@/lib/db/query-types'
import { createClient } from '@/lib/supabase/server'

function normalizeNestedCategory(item: CategoryJoin) {
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
      updated_at,
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

  if (data.media_type !== 'image' && data.media_type !== 'video') {
    throw new Error('Unsupported post media type')
  }

  return {
    unauthorized: false,
    post: {
      ...data,
      caption: data.caption ?? '',
      thumbnail_path: data.thumbnail_path ?? '',
      media_type: data.media_type as 'image' | 'video',
      post_categories: Array.isArray(data.post_categories)
        ? data.post_categories.map(normalizeNestedCategory)
        : [],
    },
  }
}