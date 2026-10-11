import Link from 'next/link'
import { signup } from '@/actions/auth'
import { AuthFrame } from '@/components/auth/auth-frame'
import { AuthSubmitButton } from '@/components/auth/auth-submit-button'
import { PasswordField } from '@/components/auth/password-field'
import { FeedbackBanner } from '@/components/ui/feedback-banner'

type SignupPageProps = { searchParams?: Promise<{ error?: string }> }

function getErrorMessage(error?: string) {
  const value = String(error || '').trim()
  const messages: Record<string, string> = {
    missing_fields: 'Enter your username, email, and password.',
    username_taken: 'That username is already taken.',
    signup_failed: 'Unable to create your account. Try again.',
  }
  return messages[value] || value
}

export const metadata = { title: "Sign up" }

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = searchParams ? await searchParams : undefined
  const errorMessage = getErrorMessage(params?.error)
  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Create an account</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">Find your people and share what interests you.</p>
      {errorMessage ? <div className="mt-5"><FeedbackBanner tone="error">{errorMessage}</FeedbackBanner></div> : null}
      <form action={signup} className="mt-6 space-y-5">
        <div>
          <label htmlFor="username" className="mb-2 block text-sm font-medium text-zinc-200">Username</label>
          <input id="username" name="username" type="text" minLength={3} maxLength={24} required autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby="username-hint" className="rs-input" placeholder="yourname" />
          <p id="username-hint" className="mt-2 text-xs leading-5 text-zinc-400">3–24 characters. Letters, numbers, dots, and underscores.</p>
        </div>
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-200">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="rs-input" placeholder="you@example.com" />
        </div>
        <PasswordField id="password" name="password" label="Password" minLength={6} required autoComplete="new-password" aria-describedby="password-hint" />
        <p id="password-hint" className="text-xs text-zinc-400">Use at least 6 characters.</p>
        <AuthSubmitButton pendingLabel="Creating account…">Create account</AuthSubmitButton>
      </form>
      <p className="mt-6 text-sm text-zinc-400">Already a member? <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-white underline underline-offset-4">Sign in</Link></p>
    </AuthFrame>
  )
}
