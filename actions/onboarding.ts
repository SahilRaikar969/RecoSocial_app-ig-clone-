'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  const cleanReturnTo = returnTo.trim() || '/onboarding'
  const search = new URLSearchParams(params).toString()
  return search ? `${cleanReturnTo}?${search}` : cleanReturnTo
}

export async function saveOnboardingPreferences(formData: FormData) {
  const supabase = await createClient()

  const profileId = String(formData.get('profile_id') || '').trim()
  const returnTo = String(formData.get('return_to') || '/onboarding').trim()

  const categoryNames = [
    ...new Set(
      formData
        .getAll('categories')
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ]

  if (!profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_profile_id' }))
  }

  if (categoryNames.length === 0) {
    redirect(buildRedirectUrl(returnTo, { error: 'no_categories_selected' }))
  }

  const { data: categoryRows, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .in('name', categoryNames)

  if (categoriesError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(categoriesError.message),
      })
    )
  }

  if (!categoryRows || categoryRows.length === 0) {
    redirect(buildRedirectUrl(returnTo, { error: 'categories_not_found' }))
  }

  const preferenceRows = categoryRows.map((category) => ({
    profile_id: profileId,
    category_id: category.id,
  }))

  const { error: deleteError } = await supabase
    .from('profile_category_preferences')
    .delete()
    .eq('profile_id', profileId)

  if (deleteError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(deleteError.message),
      })
    )
  }

  const { error: insertError } = await supabase
    .from('profile_category_preferences')
    .insert(preferenceRows)

  if (insertError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(insertError.message),
      })
    )
  }

  redirect('/feed?onboarding=done')
}