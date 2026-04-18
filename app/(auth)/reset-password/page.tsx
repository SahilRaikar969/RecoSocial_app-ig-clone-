import { Compass, Lock, Sparkles } from 'lucide-react'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export default function ResetPasswordPage() {
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
              Finish recovery without leaving the product
            </h1>

            <p className="mt-5 max-w-lg text-base leading-8 text-zinc-400">
              Password recovery should land inside a controlled premium auth surface, not a broken dead-end.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Compass className="h-5 w-5 text-white" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">Fast recovery return</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  New password set, account restored, back to feed and profile without extra friction.
                </p>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">Direct password reset</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Recovery session opens this page directly and lets the user immediately set a new password.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full">
          <ResetPasswordForm />
        </section>
      </div>
    </main>
  )
}