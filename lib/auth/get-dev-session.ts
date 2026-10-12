import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function normalizeUsername(input: string) {
  return input.trim().toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24)
}

function buildFallbackUsername(userId: string, email: string) {
  const emailPrefix = email.split('@')[0] || 'user'
  const compactEmail = normalizeUsername(emailPrefix)
  const compactId = String(userId || '').replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase()

  return normalizeUsername(`${compactEmail}.${compactId}`) || `user.${compactId || 'acct'}`
}

function buildDisplayName(email: string) {
  const emailPrefix = email.split('@')[0] || 'User'
  const cleaned = emailPrefix.replace(/[._-]+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, 40) : 'New User'
}

export async function getOptionalSession() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    throw new Error(profileError.message)
  }

  if (existingProfile) {
    return {
      profileId: String(existingProfile.id),
      username: String(existingProfile.username || '').trim() || buildFallbackUsername(user.id, user.email || ''),
      displayName: String(existingProfile.display_name || '').trim() || buildDisplayName(user.email || ''),
    }
  }

  const usernameFromMeta = normalizeUsername(String(user.user_metadata?.username || ''))
  const email = String(user.email || '').trim()
  const fallbackUsername = usernameFromMeta || buildFallbackUsername(user.id, email)

  let finalUsername = fallbackUsername
  let suffix = 1

  while (true) {
    const { data: collision, error: collisionError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', finalUsername)
      .maybeSingle()

    if (collisionError) {
      throw new Error(collisionError.message)
    }

    if (!collision) break

    finalUsername = `${fallbackUsername.slice(0, 20)}${suffix}`
    suffix += 1
  }

  const displayName =
    String(user.user_metadata?.display_name || '').trim().slice(0, 60) ||
    buildDisplayName(email)

  const { data: insertedProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      username: finalUsername,
      display_name: displayName,
      bio: '',
      avatar_url: null,
    })
    .select('id, username, display_name')
    .single()

  if (insertError) {
    // Parallel protected requests can both observe a missing profile. The loser
    // reads only this verified user's row; it must not overwrite another row.
    if (insertError.code === '23505') {
      const { data: concurrentProfile, error: readError } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('id', user.id)
        .maybeSingle()
      if (readError) throw new Error(readError.message)
      if (concurrentProfile) {
        return {
          profileId: String(concurrentProfile.id),
          username: String(concurrentProfile.username || '').trim() || finalUsername,
          displayName: String(concurrentProfile.display_name || '').trim() || displayName,
        }
      }
    }
    throw new Error(insertError.message)
  }

  return {
    profileId: String(insertedProfile.id),
    username: String(insertedProfile.username || '').trim() || finalUsername,
    displayName: String(insertedProfile.display_name || '').trim() || displayName,
  }
}
/** Mutations and account routes must retain this authenticated boundary. */
export async function getDevSession() {
  const session=await getOptionalSession()
  if(!session) redirect('/login')
  return session
}
