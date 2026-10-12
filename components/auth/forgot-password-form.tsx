'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { createClient } from '@/lib/supabase/browser'

export function ForgotPasswordForm() {
  const inFlight=useRef(false)
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(inFlight.current)return

    const cleanEmail = email.trim()

    if (!cleanEmail) {
      setError('Email is required.')
      setSuccess('')
      return
    }

    inFlight.current=true
    try {
      setPending(true)
      setError('')
      setSuccess('')

      const supabase = createClient()
      const redirectTo = `${window.location.origin}/reset-password`

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      })

      if (resetError) {
        throw resetError
      }

      setSuccess('If this address has an account, a reset link will arrive by email.')
      setEmail('')
    } catch {
      setError('Unable to send the reset email. Please try again.')
    } finally {
      inFlight.current=false
      setPending(false)
    }
  }

  return (
    <div>
      <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-zinc-300 underline underline-offset-4">Back to sign in</Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Forgot your password?</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">Enter your email to receive a reset link.</p>
      {error ? <div className="mt-5"><FeedbackBanner tone="error">{error}</FeedbackBanner></div> : null}
      {success ? <div className="mt-5"><FeedbackBanner>{success}</FeedbackBanner></div> : null}
      <form onSubmit={handleSubmit} className="mt-6 space-y-5" aria-busy={pending}>
        <div>
          <label htmlFor="recovery-email" className="mb-2 block text-sm font-medium text-zinc-200">Email</label>
          <input id="recovery-email" name="email" type="email" inputMode="email" autoCapitalize="none" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rs-input" placeholder="you@example.com" />
        </div>
        <button type="submit" disabled={pending} className="rs-button rs-button-primary w-full" aria-live="polite">{pending ? 'Sending…' : 'Send reset link'}</button>
      </form>
    </div>
  )
}
