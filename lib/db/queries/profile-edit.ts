import { createClient } from '@/lib/supabase/server'

function buildFallbackProfile(profileId: string) {
  const compact = String(profileId || 'unknown').slice(0, 8)

  return {
    id: profileId,
    username: compact.toLowerCase(),
    display_name: `Creator ${String(profileId || 'unknown').slice(0, 6)}`,
    bio: '',
    avatar_url: null,
  }
}

export async function getEditableProfile(profileId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .eq('id', profileId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? buildFallbackProfile(profileId)
}