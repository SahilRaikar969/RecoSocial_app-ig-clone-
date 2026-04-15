'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { saveOnboardingPreferences } from '@/actions/onboarding'

type CategoryOption = {
  id: string
  name: string
  slug: string
  description?: string | null
}

type OnboardingFormProps = {
  profileId: string
  categories: CategoryOption[]
  errorMessage?: string
}

function ContinueButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl border border-white bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-700"
    >
      {pending ? 'Saving...' : 'Build my feed'}
    </button>
  )
}

function getCategoryHint(slug: string) {
  const value = String(slug || '').toLowerCase()

  if (value.includes('gaming')) return 'Gameplay, creators, clips, and live culture'
  if (value.includes('tech')) return 'Apps, devices, AI, software, and builds'
  if (value.includes('music')) return 'Tracks, artists, edits, and drops'
  if (value.includes('fitness')) return 'Training, nutrition, and body progress'
  if (value.includes('fashion')) return 'Fits, trends, styling, and creators'
  if (value.includes('travel')) return 'Places, short trips, and visual diaries'
  if (value.includes('food')) return 'Meals, cafés, recipes, and food creators'
  if (value.includes('movie')) return 'Films, shows, scenes, and discussion'
  if (value.includes('anime')) return 'Anime clips, edits, fandom, and creators'
  if (value.includes('photography')) return 'Shots, edits, reels, and visuals'

  return 'Used to shape your feed and creator discovery'
}

function getSelectionStrength(selectedCount: number) {
  if (selectedCount === 0) {
    return {
      title: 'No interests selected',
      body: 'Pick a few interests so your first feed is not random.',
    }
  }

  if (selectedCount <= 2) {
    return {
      title: 'Narrow start',
      body: 'Good for a focused first feed, but discovery breadth will be smaller.',
    }
  }

  if (selectedCount <= 5) {
    return {
      title: 'Balanced start',
      body: 'Strong first-session mix between relevance and variety.',
    }
  }

  return {
    title: 'Wide start',
    body: 'Good for broader discovery, but the first feed may feel less tightly focused.',
  }
}

export function OnboardingForm({
  profileId,
  categories,
  errorMessage = '',
}: OnboardingFormProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [clientError, setClientError] = useState('')

  const effectiveError = clientError || errorMessage
  const selectedCount = selected.length

  const selectedCategories = useMemo(
    () => categories.filter((category) => selected.includes(category.name)),
    [categories, selected]
  )

  const strength = useMemo(
    () => getSelectionStrength(selectedCount),
    [selectedCount]
  )

  function toggleCategory(name: string) {
    setClientError('')

    setSelected((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
    )
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (selected.length === 0) {
      event.preventDefault()
      setClientError('Pick at least one interest to build your feed.')
      return
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form
        action={saveOnboardingPreferences}
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black"
      >
        <input type="hidden" name="profile_id" value={profileId} />
        <input type="hidden" name="return_to" value="/onboarding" />

        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <h2 className="text-xl font-semibold text-white">
            Choose interest seeds
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            These choices become the first ranking anchors for your recommendation surfaces. Later actions like likes, saves, follows, comments, and hidden content refine this automatically.
          </p>

          {effectiveError ? (
            <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {effectiveError}
            </div>
          ) : null}
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-6">
          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Step 1
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  Select interest categories
                </h3>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Selected
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {selectedCount}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => {
                const selectedState = selected.includes(category.name)

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.name)}
                    className={`min-w-0 rounded-[24px] border p-4 text-left transition ${
                      selectedState
                        ? 'border-white bg-white text-black'
                        : 'border-zinc-800 bg-black text-white hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`text-[11px] uppercase tracking-[0.16em] ${
                            selectedState ? 'text-black/60' : 'text-zinc-500'
                          }`}
                        >
                          Topic
                        </p>

                        <h4 className="mt-2 break-words text-base font-semibold">
                          {category.name}
                        </h4>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          selectedState
                            ? 'border-black/10 bg-black text-white'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-300'
                        }`}
                      >
                        {selectedState ? 'Selected' : 'Add'}
                      </span>
                    </div>

                    <p
                      className={`mt-3 text-sm leading-6 ${
                        selectedState ? 'text-black/75' : 'text-zinc-400'
                      }`}
                    >
                      {category.description?.trim() || getCategoryHint(category.slug)}
                    </p>

                    <input
                      type="checkbox"
                      checked={selectedState}
                      readOnly
                      className="sr-only"
                    />
                  </button>
                )
              })}
            </div>

            {selected.map((name) => (
              <input key={name} type="hidden" name="categories" value={name} />
            ))}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <a
              href="/feed"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Skip for now
            </a>

            <ContinueButton />
          </div>
        </div>
      </form>

      <aside className="overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black xl:sticky xl:top-6">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            Cold start preview
          </div>

          <h3 className="mt-4 text-xl font-semibold tracking-tight text-white">
            First-session quality
          </h3>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Before real engagement data exists, this is the strongest signal you give the app.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Selection strength
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {strength.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {strength.body}
            </p>
          </div>

          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Feed seed
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedCategories.length ? (
                selectedCategories.map((category) => (
                  <span
                    key={category.id}
                    className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-xs font-medium text-zinc-200"
                  >
                    {category.name}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-500">
                  No interests selected yet.
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Affects
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Feed ranking, explore discovery, creator spotlights, and early recommendation variety before likes, saves, follows, and comments accumulate.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}