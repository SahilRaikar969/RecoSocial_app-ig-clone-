import Link from 'next/link'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { logout } from '@/actions/auth'
import { updatePrivacyPreference, updateThemePreference } from '@/actions/settings'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { createClient } from '@/lib/supabase/server'

type SettingsPageProps = {
  searchParams?: Promise<{
    theme?: string
    privacy?: string
    error?: string
  }>
}

function getErrorMessage(value?: string) {
  const error = String(value || '').trim()
  if (!error) return ''

  switch (error) {
    case 'missing_profile_id':
      return 'Missing profile id.'
    case 'invalid_theme':
      return 'Invalid theme.'
    default:
      return decodeURIComponent(error)
  }
}

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined
  const errorMessage = getErrorMessage(params?.error)

  const themeFeedback =
    params?.theme === 'dark'
      ? 'Dark theme saved.'
      : params?.theme === 'light'
        ? 'Light theme saved. Full light-surface polish will continue in the next visual batch.'
        : ''

  const privacyFeedback =
    params?.privacy === 'private'
      ? 'Account set to private.'
      : params?.privacy === 'public'
        ? 'Account set to public.'
        : ''

  const { profileId } = await getDevSession()
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_private, theme_preference')
    .eq('id', profileId)
    .maybeSingle()

  const currentTheme = profile?.theme_preference === 'light' ? 'light' : 'dark'
  const isPrivate = Boolean(profile?.is_private)

  return (
    <PageShell maxWidth="5xl">
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}
      {themeFeedback ? <FeedbackBanner>{themeFeedback}</FeedbackBanner> : null}
      {privacyFeedback ? <FeedbackBanner>{privacyFeedback}</FeedbackBanner> : null}

      <SurfaceHero
        eyebrow="Settings"
        title="Account and app controls"
        description="Profile is now the single entry point for settings. This phase adds working account preferences, theme storage, privacy control, direct logout, and faster access to safety surfaces already inside the product."
        actions={[
          { href: '/profile', label: 'Back to profile', variant: 'secondary' },
          { href: '/feed', label: 'Back to feed', variant: 'secondary' },
        ]}
        stats={[
          { label: 'Theme', value: currentTheme === 'light' ? 'Light' : 'Dark', helper: 'saved preference' },
          { label: 'Privacy', value: isPrivate ? 'Private' : 'Public', helper: 'current account visibility' },
          { label: 'Entry', value: 'Profile', helper: 'settings now live here only' },
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
          <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-violet-200">
            Appearance
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <form action={updateThemePreference}>
              <input type="hidden" name="return_to" value="/settings" />
              <input type="hidden" name="theme" value="dark" />
              <button
                type="submit"
                className={`w-full rounded-[22px] border px-4 py-4 text-left text-sm transition ${
                  currentTheme === 'dark'
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950/85 text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                Dark premium
              </button>
            </form>

            <form action={updateThemePreference}>
              <input type="hidden" name="return_to" value="/settings" />
              <input type="hidden" name="theme" value="light" />
              <button
                type="submit"
                className={`w-full rounded-[22px] border px-4 py-4 text-left text-sm transition ${
                  currentTheme === 'light'
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950/85 text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                Light premium
              </button>
            </form>
          </div>

          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Theme preference is now stored. The full light-surface visual pass is intentionally kept separate from this batch to avoid breaking the polished dark product surfaces already working.
          </p>
        </div>

        <div className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
          <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-200">
            Privacy
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <form action={updatePrivacyPreference}>
              <input type="hidden" name="return_to" value="/settings" />
              <input type="hidden" name="is_private" value="false" />
              <button
                type="submit"
                className={`w-full rounded-[22px] border px-4 py-4 text-left text-sm transition ${
                  !isPrivate
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950/85 text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                Public account
              </button>
            </form>

            <form action={updatePrivacyPreference}>
              <input type="hidden" name="return_to" value="/settings" />
              <input type="hidden" name="is_private" value="true" />
              <button
                type="submit"
                className={`w-full rounded-[22px] border px-4 py-4 text-left text-sm transition ${
                  isPrivate
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950/85 text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                Private account
              </button>
            </form>
          </div>

          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Private profiles now hide posts and liked content from non-followers.
          </p>
        </div>

        <div className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
          <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-200">
            Safety surfaces
          </div>

          <div className="mt-5 space-y-3">
            <Link
              href="/profile?tab=hidden"
              className="block rounded-[22px] border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:text-white"
            >
              Hidden posts
            </Link>

            <Link
              href="/profile?tab=reported"
              className="block rounded-[22px] border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:text-white"
            >
              Reported posts
            </Link>

            <Link
              href="/activity"
              className="block rounded-[22px] border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:text-white"
            >
              Open activity
            </Link>
          </div>
        </div>

        <div className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
          <div className="inline-flex rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-pink-200">
            Account
          </div>

          <div className="mt-5 space-y-3">
            <Link
              href="/profile/edit"
              className="block rounded-[22px] border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:text-white"
            >
              Edit profile
            </Link>

            <Link
              href="/stories/create"
              className="block rounded-[22px] border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:text-white"
            >
              Create story
            </Link>

            <form action={logout}>
              <button
                type="submit"
                className="block w-full rounded-[22px] border border-red-900/40 bg-red-950/25 px-4 py-4 text-left text-sm text-red-100 transition hover:-translate-y-0.5 hover:border-red-800/60"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </section>
    </PageShell>
  )
}