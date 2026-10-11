'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { saveOnboardingPreferences } from '@/actions/onboarding'

type CategoryOption = { id: string; name: string; slug: string; description?: string | null }
type OnboardingFormProps = { profileId: string; categories: CategoryOption[]; errorMessage?: string }

function ContinueButton() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="rs-button rs-button-primary" aria-live="polite">{pending ? 'Saving…' : 'Continue'}</button>
}

export function OnboardingForm({ profileId, categories, errorMessage = '' }: OnboardingFormProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [clientError, setClientError] = useState('')
  const effectiveError = clientError || errorMessage

  function toggleCategory(name: string) {
    setClientError('')
    setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (selected.length === 0) {
      event.preventDefault()
      setClientError('Choose at least one interest to continue.')
    }
  }

  return (
    <form action={saveOnboardingPreferences} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="return_to" value="/onboarding" />
      {effectiveError ? <div id="interests-error" role="alert" className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{effectiveError}</div> : null}
      <fieldset aria-describedby={effectiveError ? 'interests-error' : undefined}>
        <legend className="mb-3 text-sm font-medium text-zinc-200">Your interests</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const active = selected.includes(category.name)
            return (
              <label key={category.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-medium transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-400 ${active ? 'border-violet-400 bg-violet-500/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-600'}`}>
                <input type="checkbox" name="categories" value={category.name} checked={active} onChange={() => toggleCategory(category.name)} className="h-5 w-5 shrink-0 accent-violet-500" />
                <span className="break-words">{category.name}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5">
        <Link href="/feed" className="rs-button">Skip for now</Link>
        <ContinueButton />
      </div>
    </form>
  )
}
