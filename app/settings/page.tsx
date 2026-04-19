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
    .select('id, username, display_name, is_private, theme_preference')
    .eq('id', profileId)
    .maybeSingle()

  const currentTheme = profile?.theme_preference === 'light' ? 'light' : 'dark'
  const isPrivate = Boolean(profile?.is_private)
  const username = String(profile?.username || '').trim()
  const displayName = String(profile?.display_name || '').trim()

  return (
    <PageShell maxWidth="5xl">
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}
      {themeFeedback ? <FeedbackBanner>{themeFeedback}</FeedbackBanner> : null}
      {privacyFeedback ? <FeedbackBanner>{privacyFeedback}</FeedbackBanner> : null}

      <SurfaceHero
        eyebrow="Settings"
        title="Account and app controls"
        description="Profile remains the single entry point for settings. This stage tightens account controls, recovery access, and session-facing actions without cluttering the main product shell."
        actions={[
          { href: '/profile', label: 'Back to profile', variant: 'secondary' },
          { href: '/feed', label: 'Back to feed', variant: 'secondary' },
        ]}
        stats={[
          { label: 'Theme', value: currentTheme === 'light' ? 'Light' : 'Dark', helper: 'saved preference' },
          { label: 'Privacy', value: isPrivate ? 'Private' : 'Public', helper: 'current account visibility' },
          { label: 'Account', value: username ? `@${username}` : 'Active', helper: displayName || 'current profile' },
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[26px] md:rounded-[28px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-5 shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
          <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-violet-200">
            Appearance
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <form action={updateThemePreference}>
              <input type="hidden" name="return_to" value="/settings" />
              <input type="hidden" name="theme" value="dark" />
              <button
                type="submit"
                className={`w-full rounded-[20px] border px-4 py-4 text-left text-sm transition ${
                  currentTheme === 'dark'
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
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
                className={`w-full rounded-[20px] border px-4 py-4 text-left text-sm transition ${
                  currentTheme === 'light'
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                Light premium
              </button>
            </form>
          </div>

          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Theme preference is stored. Full light-surface repaint remains intentionally separate so the working dark product is not destabilized.
          </p>
        </div>

        <div className="rounded-[26px] md:rounded-[28px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-5 shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
          <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-200">
            Privacy
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <form action={updatePrivacyPreference}>
              <input type="hidden" name="return_to" value="/settings" />
              <input type="hidden" name="is_private" value="false" />
              <button
                type="submit"
                className={`w-full rounded-[20px] border px-4 py-4 text-left text-sm transition ${
                  !isPrivate
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
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
                className={`w-full rounded-[20px] border px-4 py-4 text-left text-sm transition ${
                  isPrivate
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
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

        <div className="rounded-[26px] md:rounded-[28px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-5 shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
          <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-200">
            Security
          </div>

          <div className="mt-5 space-y-3">
            <Link
              href="/forgot-password"
              className="block rounded-[20px] border border-zinc-800 bg-zinc-950/90 px-4 py-4 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Reset password by email
            </Link>

            <Link
              href="/profile/edit"
              className="block rounded-[20px] border border-zinc-800 bg-zinc-950/90 px-4 py-4 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Review identity and avatar
            </Link>

            <div className="rounded-[20px] border border-zinc-800 bg-black px-4 py-4 text-sm text-zinc-400">
              Recovery opens in the same controlled auth surface used by login and reset, not outside the product shell.
            </div>
          </div>
        </div>

        <div className="rounded-[26px] md:rounded-[28px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-5 shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
          <div className="inline-flex rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-pink-200">
            Account
          </div>

          <div className="mt-5 space-y-3">
            <Link
              href="/profile/edit"
              className="block rounded-[20px] border border-zinc-800 bg-zinc-950/90 px-4 py-4 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Edit profile
            </Link>

            <Link
              href="/stories/create"
              className="block rounded-[20px] border border-zinc-800 bg-zinc-950/90 px-4 py-4 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Create story
            </Link>

            <form action={logout}>
              <button
                type="submit"
                className="block w-full rounded-[20px] border border-red-900/40 bg-red-950/25 px-4 py-4 text-left text-sm text-red-100 transition hover:border-red-800/60"
              >
                Log out
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-[26px] md:rounded-[28px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-5 shadow-[0_14px_32px_rgba(0,0,0,0.20)] xl:col-span-2">
          <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
            Control summary
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[20px] border border-zinc-800 bg-zinc-950/90 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Session state
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                Active
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Account controls are being read from the live authenticated profile.
              </p>
            </div>

            <div className="rounded-[20px] border border-zinc-800 bg-zinc-950/90 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Profile entry
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                Primary settings source
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Settings remain profile-driven and do not return to cluttered nav entry patterns.
              </p>
            </div>

            <div className="rounded-[20px] border border-zinc-800 bg-zinc-950/90 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Recovery path
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                Ready
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Password reset now has a direct surface from auth and a clear route from settings.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  )
}