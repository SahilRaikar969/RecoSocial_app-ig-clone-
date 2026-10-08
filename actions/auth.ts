'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function normalizeUsername(input: string) {
  return input.trim().toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24)
}

function buildDisplayName(email: string) {
  const emailPrefix = email.split('@')[0] || 'User'
  const cleaned = emailPrefix.replace(/[._-]+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, 40) : 'New User'
}

async function ensureUniqueUsername(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseUsername: string
) {
  const normalizedBase = normalizeUsername(baseUsername) || 'user'
  let candidate = normalizedBase
  let suffix = 1

  while (true) {
    const { data: existingProfile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', candidate)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (!existingProfile) {
      return candidate
    }

    candidate = `${normalizedBase.slice(0, 20)}${suffix}`
    suffix += 1
  }
}

async function ensureProfileForUser(userId: string, username: string, email: string) {
  const supabase = await createClient()

  const { data: existingProfile, error: existingError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existingProfile) return

  const finalUsername = await ensureUniqueUsername(supabase, username)

  const { error: insertError } = await supabase.from('profiles').insert({
    id: userId,
    username: finalUsername,
    display_name: buildDisplayName(email),
    bio: '',
    avatar_url: null,
  })

  if (insertError) {
    // Another authenticated request may have provisioned this same account.
    // Never resolve a duplicate by updating whichever username collided.
    if (insertError.code === '23505') {
      const { data: concurrentProfile, error: readError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle()
      if (readError) throw new Error(readError.message)
      if (concurrentProfile) return
    }
    throw new Error(insertError.message)
  }
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const rawUsername = String(formData.get('username') || '')
  const username = normalizeUsername(rawUsername)

  if (!email || !password || !username) {
    redirect('/signup?error=missing_fields')
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existingProfileError) {
    redirect(`/signup?error=${encodeURIComponent(existingProfileError.message)}`)
  }

  if (existingProfile) {
    redirect('/signup?error=username_taken')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }

  const userId = data.user?.id

  if (!userId) {
    redirect('/signup?error=signup_failed')
  }

  /*
    If email confirmation is ON in Supabase, signUp often returns no session.
    In that case the user is not logged in yet, so send them to login with a clear message.
    If confirmation is OFF, session exists and we can continue into onboarding/feed.
  */
  if (!data.session) {
    redirect('/login?error=confirm_email_required')
  }

  // The database auth trigger provisions profiles even before confirmation.
  // This authenticated fallback supports an existing confirmed account.
  await ensureProfileForUser(userId, username, email)

  redirect('/onboarding')
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  const userId = data.user?.id

  if (!userId) {
    redirect('/login?error=login_failed')
  }

  const usernameFromMeta = normalizeUsername(String(data.user.user_metadata?.username || ''))
  const fallbackUsername =
    usernameFromMeta ||
    normalizeUsername(email.split('@')[0] || 'user') ||
    'user'

  await ensureProfileForUser(userId, fallbackUsername, email)

  redirect('/feed')
}

export async function logout() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
  redirect('/login')
}