import Link from 'next/link'
import { OnboardingForm } from '@/components/onboarding/onboarding-form'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getOnboardingCategories } from '@/lib/db/queries/onboarding'

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined
  const { profileId } = await getDevSession()
  const categories = await getOnboardingCategories()
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
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <section className="mb-6 overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            Onboarding
          </div>

          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Shape your first recommendations
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Pick the content zones that should seed your home feed, creator discovery, and early ranking logic before your real behavior signals take over.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/feed"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Skip to feed
              </Link>

              <Link
                href="/explore"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Explore later
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4 sm:px-6">
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Feed
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              Early recommendations get seeded from these interests.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Explore
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              Discovery starts closer to the topics you actually care about.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Cold start
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              This reduces empty, random, or weak first-session ranking.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Signal quality
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              Later likes, saves, follows, and watch behavior build on top of this.
            </p>
          </div>
        </div>
      </section>

      <OnboardingForm
        profileId={profileId}
        categories={categories}
        errorMessage={errorMessage}
      />
    </main>
  )
}