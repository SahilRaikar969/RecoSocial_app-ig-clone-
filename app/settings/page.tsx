import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { AuthSubmitButton } from '@/components/auth/auth-submit-button'
import { logout } from '@/actions/auth'
import { requireSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Settings' }
type SettingsPageProps = { searchParams?: Promise<{ theme?: string; privacy?: string; error?: string }> }
export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined
  const { profileId } = await requireSession()
  const supabase = await createClient()
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id, username, display_name, is_private, theme_preference').eq('id', profileId).maybeSingle()
  if(profileError) throw new Error('Settings could not be loaded.')
  return <PageShell maxWidth="4xl">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Settings</h1><Link href="/profile" className="rs-button">Back to profile</Link></header>
    {params?.error ? <FeedbackBanner tone="error">{params.error === 'private_accounts_unavailable' ? 'Private accounts are unavailable. Posts and media remain public.' : 'Your settings could not be saved. Try again.'}</FeedbackBanner> : null}
    <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
      <section className="space-y-3 p-5"><h2 className="font-semibold">Account</h2><p className="break-all text-sm text-zinc-300">{profile?.display_name || profile?.username || 'Your account'}{profile?.username ? ' · @' + profile.username : ''}</p><div className="flex flex-wrap gap-2"><Link href="/profile/edit" className="rs-button">Edit profile</Link><Link href="/onboarding" className="rs-button">Edit interests</Link><Link href="/forgot-password" className="rs-button">Reset password</Link></div></section>
      <section className="space-y-2 p-5"><h2 className="font-semibold">Appearance</h2><p className="text-sm text-zinc-300">Dark</p><p className="text-sm text-zinc-400">Light appearance is currently unavailable.</p></section>
      <section className="space-y-2 p-5"><h2 className="font-semibold">Privacy</h2><p className="text-sm text-zinc-300">Public accounts only</p><p className="text-sm leading-6 text-zinc-400">Posts and uploaded media are public. Private accounts are unavailable.</p></section>
      <section className="p-5"><form action={logout}><AuthSubmitButton pendingLabel="Signing out…">Log out</AuthSubmitButton></form></section>
    </div>
  </PageShell>
}
