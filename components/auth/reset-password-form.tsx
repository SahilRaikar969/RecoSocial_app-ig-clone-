'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PasswordField } from '@/components/auth/password-field'
import { preparePasswordRecovery, recoveryReturnPath } from '@/lib/auth/recovery'
import { createClient } from '@/lib/supabase/browser'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const recoveryAttempt=useRef<Promise<void> | null>(null)
  const submitting=useRef(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    async function prepareRecoverySession() {
      try {
        setBootstrapping(true)
        setError('')
        setSuccess('')

        recoveryAttempt.current ??= preparePasswordRecovery(createClient(), {
          code:searchParams.get('code'),tokenHash:searchParams.get('token_hash'),type:searchParams.get('type'),error:searchParams.get('error'),
        })
        await recoveryAttempt.current
        if (!active) return

        setRecoveryReady(true)
      } catch {
        if (!active) return
        setRecoveryReady(false)
        setError('This reset link is invalid or expired. Request a new one.')
      } finally {
        if (!active) return
        window.history.replaceState(window.history.state, '', recoveryReturnPath(window.location.href))
        setBootstrapping(false)
      }
    }

    void prepareRecoverySession()

    return () => {
      active = false
    }
  }, [searchParams])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!recoveryReady || submitting.current) return

    if (!password || !confirmPassword) {
      setError('Enter and confirm your new password.')
      setSuccess('')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      setSuccess('')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setSuccess('')
      return
    }

    submitting.current=true
    try {
      setPending(true)
      setError('')
      setSuccess('')

      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        throw updateError
      }

      setPassword('')
      setConfirmPassword('')
      const signOut=await supabase.auth.signOut()
      if(signOut.error) {
        setSuccess('Password updated. You are still signed in; use Settings to sign out.')
        setRecoveryReady(false)
        return
      }
      router.replace('/login?message=password_reset_success')
    } catch {
      setError('Unable to update your password. Please try again.')
      setSuccess('')
    } finally {
      submitting.current=false
      setPending(false)
    }
  }

  return (
    <div>
      <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-zinc-300 underline underline-offset-4">Back to sign in</Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Set a new password</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">Use at least 8 characters.</p>
      {error ? <div className="mt-5"><FeedbackBanner tone="error">{error}</FeedbackBanner></div> : null}
      {success ? <div className="mt-5"><FeedbackBanner>{success}</FeedbackBanner></div> : null}
      {bootstrapping ? (
        <p role="status" className="mt-6 text-sm text-zinc-300">Checking your reset link…</p>
      ) : recoveryReady ? (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5" aria-busy={pending}>
          <PasswordField id="password" label="New password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <PasswordField id="confirmPassword" label="Confirm password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <button type="submit" disabled={pending} className="rs-button rs-button-primary w-full" aria-live="polite">{pending ? 'Updating…' : 'Update password'}</button>
        </form>
      ) : (
        <Link href="/forgot-password" className="rs-button rs-button-primary mt-6 w-full">Request a new reset link</Link>
      )}
    </div>
  )
}
