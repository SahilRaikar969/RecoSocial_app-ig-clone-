import type { Tables } from '@/lib/supabase/database.types'

export type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'slug'>
export type CategoryJoin = { category_id: string; categories: Category | Category[] | null }
export type PublicProfile = Pick<Tables<'profiles'>, 'id' | 'username' | 'display_name' | 'bio' | 'avatar_url'>
