'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PasswordField } from '@/components/auth/password-field'
import { createClient } from '@/lib/supabase/browser'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

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

        const supabase = createClient()

        const code = searchParams.get('code')
        const tokenHash = searchParams.get('token_hash')
        const type = searchParams.get('type')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            throw exchangeError
          }
        } else if (tokenHash && type === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })

          if (verifyError) {
            throw verifyError
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (!session) {
          throw new Error('Recovery session is missing or expired. Request a new reset email.')
        }

        if (!active) return

        setRecoveryReady(true)
      } catch {
        if (!active) return
        setRecoveryReady(false)
        setError('This reset link is invalid or expired. Request a new one.')
      } finally {
        if (!active) return
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

    if (!recoveryReady) return

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

      await supabase.auth.signOut()

      setSuccess('Password updated successfully. Redirecting to login...')

      setTimeout(() => {
        router.replace('/login?message=password_reset_success')
      }, 900)
    } catch {
      setError('Unable to update your password. Please try again.')
      setSuccess('')
    } finally {
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
