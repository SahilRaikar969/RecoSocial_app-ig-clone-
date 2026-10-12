'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { buildReturnUrl, safeReturnPath } from '@/lib/routes/safe-return-path'

export async function saveOnboardingPreferences(formData: FormData) {
  // The RPC derives its owner from auth.uid(); never accept a form's profile_id.
  await requireSession()
  const supabase = await createClient()
  const returnTo = safeReturnPath(String(formData.get('return_to') || ''), '/onboarding')
  const categoryNames = [
    ...new Set(
      formData
        .getAll('categories')
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ]

  if (categoryNames.length === 0) {
    redirect(buildReturnUrl(returnTo, { error: 'no_categories_selected' }))
  }
  if (categoryNames.length > 100) {
    redirect(buildReturnUrl(returnTo, { error: 'too_many_categories' }))
  }

  const { data: categoryRows, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .in('name', categoryNames)

  if (categoriesError) {
    redirect(buildReturnUrl(returnTo, { error: 'preferences_save_failed' }))
  }

  if (!categoryRows || categoryRows.length !== categoryNames.length) {
    redirect(buildReturnUrl(returnTo, { error: 'categories_not_found' }))
  }

  // One transaction validates every category and replaces only the caller's set.
  const { error: saveError } = await supabase.rpc('save_profile_category_preferences', {
    category_ids: categoryRows.map((category) => category.id),
  })

  if (saveError) {
    redirect(buildReturnUrl(returnTo, { error: 'preferences_save_failed' }))
  }

  revalidatePath('/feed')
  revalidatePath('/explore')
  revalidatePath('/onboarding')
  redirect('/feed?onboarding=done')
}
