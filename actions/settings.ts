'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { buildReturnUrl } from '@/lib/routes/safe-return-path'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  return buildReturnUrl(returnTo, params, '/settings')
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
  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({
      theme_preference: theme,
    })
    .eq('id', profileId)
    .select('id')
    .maybeSingle()

  if (error || !updatedProfile) {
    redirect(buildRedirectUrl(returnTo, { error: 'theme_update_failed' }))
  }

  revalidatePath('/settings')
  const cookieStore = await cookies()
  cookieStore.set('reco_theme', theme, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  })

  redirect(buildRedirectUrl(returnTo, { theme: theme }))
}

export async function updatePrivacyPreference() {
  await getDevSession()
  // Retain an authenticated rejection for stale forms / direct action calls.
  redirect('/settings?error=private_accounts_unavailable')
}
