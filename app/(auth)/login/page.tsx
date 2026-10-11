import Link from 'next/link'
import { login } from '@/actions/auth'
import { AuthFrame } from '@/components/auth/auth-frame'
import { AuthSubmitButton } from '@/components/auth/auth-submit-button'
import { PasswordField } from '@/components/auth/password-field'
import { FeedbackBanner } from '@/components/ui/feedback-banner'

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>
}

function getBannerState(error?: string, message?: string) {
  if (message === 'password_reset_email_sent') return { tone: 'success' as const, text: 'Check your email for a password reset link.' }
  if (message === 'password_reset_success') return { tone: 'success' as const, text: 'Password updated. Sign in with your new password.' }
  const value = String(error || '').trim()
  const messages: Record<string, string> = {
    'Invalid login credentials': 'Incorrect email or password.',
    'Email not confirmed': 'Confirm your email before signing in.',
    confirm_email_required: 'Account created. Check your email and confirm your address before signing in.',
    login_failed: 'Unable to sign in. Try again.',
    profile_setup_failed: 'We could not finish setting up your profile. Please try signing in again.',
  }
  return { tone: 'error' as const, text: messages[value] || value }
}

export const metadata = { title: "Log in" }

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : undefined
  const banner = getBannerState(params?.error, params?.message)
  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
      <p className="mt-2 text-sm text-zinc-400">Sign in to RecoSocial.</p>
      {banner.text ? <div className="mt-5"><FeedbackBanner tone={banner.tone}>{banner.text}</FeedbackBanner></div> : null}
      <form action={login} className="mt-6 space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-200">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="rs-input" placeholder="you@example.com" />
        </div>
        <PasswordField id="password" name="password" label="Password" required autoComplete="current-password" />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm text-violet-300 underline underline-offset-4">Forgot password?</Link>
        </div>
        <AuthSubmitButton pendingLabel="Signing in…">Sign in</AuthSubmitButton>
      </form>
      <p className="mt-6 text-sm text-zinc-400">New here? <Link href="/signup" className="inline-flex min-h-11 items-center font-medium text-white underline underline-offset-4">Create an account</Link></p>
    </AuthFrame>
  )
}
