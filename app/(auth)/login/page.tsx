import Link from 'next/link'
import { AlertCircle, ArrowRight, Compass, Lock, Sparkles } from 'lucide-react'
import { login } from '@/actions/auth'

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string
    message?: string
  }>
}

function getBannerState(error?: string, message?: string) {
  const errorValue = String(error || '').trim()
  const messageValue = String(message || '').trim()

  if (messageValue === 'password_reset_email_sent') {
    return {
      tone: 'success' as const,
      text: 'Password reset email sent. Open the link from your email to set a new password.',
    }
  }

  if (messageValue === 'password_reset_success') {
    return {
      tone: 'success' as const,
      text: 'Password updated successfully. Login with your new password.',
    }
  }

  if (!errorValue) {
    return {
      tone: 'neutral' as const,
      text: '',
    }
  }

  if (errorValue === 'Invalid login credentials') {
    return {
      tone: 'error' as const,
      text: 'Incorrect email or password.',
    }
  }

  if (errorValue === 'Email not confirmed') {
    return {
      tone: 'error' as const,
      text: 'Email is not confirmed yet.',
    }
  }

  if (errorValue === 'confirm_email_required') {
    return {
      tone: 'error' as const,
      text: 'Your account was created. Confirm your email in Supabase or disable email confirmation for development.',
    }
  }

  if (errorValue === 'login_failed') {
    return {
      tone: 'error' as const,
      text: 'Login failed. Try again.',
    }
  }

  return {
    tone: 'error' as const,
    text: decodeURIComponent(errorValue),
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const banner = getBannerState(
    resolvedSearchParams?.error,
    resolvedSearchParams?.message
  )

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.04),transparent_24%)]" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_480px] lg:px-8">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              <Sparkles className="h-3.5 w-3.5" />
              RecoSocial
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-tight text-white">
              Return to your creator and reels loop
            </h1>

            <p className="mt-5 max-w-lg text-base leading-8 text-zinc-400">
              Open your personalized feed, saved posts, creator graph, and premium dark social shell from one account surface.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Compass className="h-5 w-5 text-white" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">Discovery-first feed</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Personalized ranking from follows, categories, saves, and broader exploration.
                </p>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">Focused account access</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Resume your profile surface, saved content, interactions, and publishing flow.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="rounded-[34px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(8,8,8,0.98))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Welcome back
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">
              Login
            </h1>

            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Access your personalized social surface.
            </p>

            {banner.text ? (
              <div
                className={`mt-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${
                  banner.tone === 'success'
                    ? 'border border-emerald-900/40 bg-emerald-950/30 text-emerald-100'
                    : 'border border-red-900/40 bg-red-950/30 text-red-100'
                }`}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{banner.text}</span>
              </div>
            ) : null}

            <form action={login} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-300">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-zinc-300 underline underline-offset-4 transition hover:text-white"
                  >
                    Forgot password?
                  </Link>
                </div>

                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 rounded-[26px] border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Product access
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Feed, explore, activity, saved posts, and profile stay inside one premium dark shell after sign-in.
              </p>
            </div>

            <p className="mt-6 text-sm text-zinc-400">
              No account yet?{' '}
              <Link href="/signup" className="font-semibold text-white underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}