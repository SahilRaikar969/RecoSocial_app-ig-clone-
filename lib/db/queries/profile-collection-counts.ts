import { createClient } from '@/lib/supabase/server'

export type ProfileCollection = 'saved' | 'liked' | 'hidden' | 'reported'

const collections = {
  saved: { table: 'saves', owner: 'profile_id' },
  liked: { table: 'likes', owner: 'profile_id' },
  hidden: { table: 'hidden_posts', owner: 'profile_id' },
  reported: { table: 'post_reports', owner: 'reporter_id' },
} as const

export async function getProfileCollectionCount(profileId: string, collection: ProfileCollection) {
  const supabase = await createClient()
  const { table, owner } = collections[collection]
  // Match the existing collection loaders' filter(Boolean) for nested posts:
  // RLS-invisible/deleted posts must not contribute to a tab's badge count.
  const { count, error } = await supabase.from(table)
    .select('post_id, posts!inner(id)', { count: 'exact', head: true })
    .eq(owner, profileId)
  if (error) throw new Error(error.message)
  return count ?? 0
}
