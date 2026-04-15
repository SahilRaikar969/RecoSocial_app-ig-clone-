import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Clapperboard,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { signup } from '@/actions/auth'

type SignupPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

function getErrorMessage(error?: string) {
  const value = String(error || '').trim()

  if (!value) return ''

  if (value === 'missing_fields') {
    return 'Complete username, email, and password.'
  }

  if (value === 'username_taken') {
    return 'That username is already taken.'
  }

  if (value === 'signup_failed') {
    return 'Signup failed. Try again.'
  }

  return decodeURIComponent(value)
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const errorMessage = getErrorMessage(resolvedSearchParams?.error)

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.04),transparent_24%)]" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_500px] lg:px-8">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              <Sparkles className="h-3.5 w-3.5" />
              Build your graph
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-tight text-white">
              Start your RecoSocial account
            </h1>

            <p className="mt-5 max-w-lg text-base leading-8 text-zinc-400">
              Create your creator identity, seed your interests, and enter a product built around posts, reels, discovery, and stronger return loops.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <UserPlus className="h-5 w-5 text-white" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">Creator identity</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Secure your profile, username, and network entry point from the first session.
                </p>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Clapperboard className="h-5 w-5 text-white" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">Feed and reels ready</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Go straight into onboarding, discovery ranking, post publishing, and immersive video viewing.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="rounded-[34px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(8,8,8,0.98))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              New account
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">
              Create account
            </h1>

            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Start building your interest graph and creator presence.
            </p>

            {errorMessage ? (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <form action={signup} className="mt-6 space-y-4">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-zinc-300">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  minLength={3}
                  maxLength={24}
                  required
                  autoComplete="username"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
                  placeholder="sahilraikar"
                />
              </div>

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
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-300">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Create account
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 rounded-[26px] border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Next step
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                After sign-up, onboarding seeds your feed so the product feels personalized earlier instead of empty.
              </p>
            </div>

            <p className="mt-6 text-sm text-zinc-400">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-white underline underline-offset-4">
                Login
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}