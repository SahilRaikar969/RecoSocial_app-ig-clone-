'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertCircle, ArrowLeft, Mail, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanEmail = email.trim()

    if (!cleanEmail) {
      setError('Email is required.')
      setSuccess('')
      return
    }

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

      setSuccess('Reset email sent. Open the link from your email to continue.')
      setEmail('')
    } catch (error: any) {
      setError(error?.message || 'Failed to send password reset email.')
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
        Account recovery
      </div>

      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">
        Reset password
      </h1>

      <p className="mt-3 text-sm leading-7 text-zinc-400">
        Enter your email and we’ll send you a secure recovery link for your account.
      </p>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? 'Sending reset email...' : 'Send reset email'}
          <Send className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-6 rounded-[26px] border border-zinc-800 bg-zinc-950/70 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Recovery flow
        </p>
        <p className="mt-2 text-sm leading-7 text-zinc-400">
          Open the email on the same device/browser where you requested it, then set a new password on the reset screen.
        </p>
      </div>
    </div>
  )
}