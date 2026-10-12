import { createClient } from '@/lib/supabase/server'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { OnboardingForm } from '@/components/onboarding/onboarding-form'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getOnboardingCategories } from '@/lib/db/queries/onboarding'

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

export const metadata = { title: "Choose your interests" }

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined
  const { profileId } = await getDevSession()
  const categories = await getOnboardingCategories()
  const supabase=await createClient()
  const preferences=await supabase.from('profile_category_preferences').select('category_id').eq('profile_id',profileId)
  if(preferences.error) throw new Error('Your interests could not be loaded.')
  const selectedIds=new Set((preferences.data??[]).map(row=>row.category_id))
  const selectedCategories=categories.filter(category=>selectedIds.has(category.id)).map(category=>category.name)
  const error = params?.error || ''

  const errorMessage =
    error === 'missing_profile_id'
      ? 'Profile id is missing.'
      : error === 'no_categories_selected'
        ? 'Select at least one category.'
        : error === 'categories_not_found'
          ? 'Selected categories were not found.'
          : error
            ? `Onboarding failed: ${error}`
            : ''

  return (
    <PageShell maxWidth="4xl">
      <SurfaceHero title="What interests you?" description="Choose a few topics to personalize your feed. You can change them later in Settings." />
      <OnboardingForm profileId={profileId} categories={categories} initialSelected={selectedCategories} errorMessage={errorMessage} />
    </PageShell>
  )
}
