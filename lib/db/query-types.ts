import type { Tables } from '@/lib/supabase/database.types'

export type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'slug'>
export type CategoryJoin = { category_id: string; categories: Category | Category[] | null }
export type PublicProfile = Pick<Tables<'profiles'>, 'id' | 'username' | 'display_name' | 'bio' | 'avatar_url'>

export type NormalizedCategoryJoin = { category_id: string; categories: Category | null }

/** Columns selected by authenticated post detail and collection queries. */
export type JoinedPost = Pick<
  Tables<'posts'>,
  'id' | 'author_id' | 'caption' | 'media_type' | 'media_path' | 'thumbnail_path' | 'created_at'
> & {
  post_categories: CategoryJoin[]
  likes: Pick<Tables<'likes'>, 'profile_id'>[]
  saves: Pick<Tables<'saves'>, 'profile_id'>[]
  comments: Pick<Tables<'comments'>, 'id' | 'author_id' | 'body' | 'created_at'>[]
}
