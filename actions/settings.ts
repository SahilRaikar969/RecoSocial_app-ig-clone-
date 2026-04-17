'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  const cleanReturnTo = returnTo.trim() || '/settings'
  const search = new URLSearchParams(params).toString()
  return search ? `${cleanReturnTo}?${search}` : cleanReturnTo
}

export async function updateThemePreference(formData: FormData) {
  const { profileId } = await getDevSession()
  const theme = String(formData.get('theme') || '').trim()
  const returnTo = String(formData.get('return_to') || '/settings').trim()

  if (!profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_profile_id' }))
  }

  if (theme !== 'dark' && theme !== 'light') {
    redirect(buildRedirectUrl(returnTo, { error: 'invalid_theme' }))
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      theme_preference: theme,
    })
    .eq('id', profileId)

  if (error) {
    redirect(buildRedirectUrl(returnTo, { error: encodeURIComponent(error.message) }))
  }

  const cookieStore = await cookies()
  cookieStore.set('reco_theme', theme, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  })

  redirect(buildRedirectUrl(returnTo, { theme: theme }))
}

export async function updatePrivacyPreference(formData: FormData) {
  const { profileId } = await getDevSession()
  const value = String(formData.get('is_private') || '').trim()
  const returnTo = String(formData.get('return_to') || '/settings').trim()

  if (!profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_profile_id' }))
  }

  const isPrivate = value === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      is_private: isPrivate,
    })
    .eq('id', profileId)

  if (error) {
    redirect(buildRedirectUrl(returnTo, { error: encodeURIComponent(error.message) }))
  }

  redirect(buildRedirectUrl(returnTo, { privacy: isPrivate ? 'private' : 'public' }))
}