'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'
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

  const passwordStrengthText = useMemo(() => {
    if (password.length >= 12) return 'Strong'
    if (password.length >= 8) return 'Good'
    if (password.length > 0) return 'Too short'
    return 'Required'
  }, [password])

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword

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
      } catch (error: any) {
        if (!active) return
        setRecoveryReady(false)
        setError(error?.message || 'Recovery link is invalid or expired.')
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
    } catch (error: any) {
      setError(error?.message || 'Failed to update password.')
      setSuccess('')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-[34px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(8,8,8,0.98))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:p-8">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to login
      </Link>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        New password
      </div>

      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">
        Set a new password
      </h1>

      <p className="mt-3 text-sm leading-7 text-zinc-400">
        Finish recovery and return to your account with a new secure password.
      </p>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      {bootstrapping ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-4 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing your recovery session...
        </div>
      ) : recoveryReady ? (
        <>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                  New password
                </label>
                <span className="text-xs text-zinc-500">{passwordStrengthText}</span>
              </div>

              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300">
                  Confirm password
                </label>
                <span
                  className={`text-xs ${
                    confirmPassword.length === 0
                      ? 'text-zinc-500'
                      : passwordsMatch
                        ? 'text-emerald-400'
                        : 'text-red-400'
                  }`}
                >
                  {confirmPassword.length === 0
                    ? 'Repeat password'
                    : passwordsMatch
                      ? 'Matches'
                      : 'Does not match'}
                </span>
              </div>

              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
                placeholder="Repeat your new password"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending ? 'Updating password...' : 'Update password'}
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            </button>
          </form>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[26px] border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <p className="mt-3 text-sm font-medium text-white">
                Recovery session is active
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                You can safely update the password on this screen now.
              </p>
            </div>

            <div className="rounded-[26px] border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Mail className="h-4 w-4 text-white" />
              </div>
              <p className="mt-3 text-sm font-medium text-white">
                Next login will use the new password
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Existing recovery state will be cleared after the password update.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-[26px] border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Recovery required
          </p>
          <p className="mt-2 text-sm leading-7 text-zinc-400">
            Open a fresh reset link from your email, then come back to this screen through that link.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/forgot-password"
              className="rounded-2xl border border-white bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Request new reset link
            </Link>

            <Link
              href="/login"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500"
            >
              Return to login
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}