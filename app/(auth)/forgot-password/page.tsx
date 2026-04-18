import { ForgotPasswordForm } from '../forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-zinc-900 bg-[radial-gradient(circle_at_top,rgba(38,38,38,0.45),transparent_45%),linear-gradient(180deg,#090909,#020202)] shadow-[0_50px_140px_rgba(0,0,0,0.7)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden border-r border-zinc-900 p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                RecoSocial Security
              </div>

              <h2 className="mt-6 text-4xl font-semibold tracking-tight text-white">
                Secure account recovery without leaving the app flow.
              </h2>

              <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
                Recover access with a clean reset experience that feels consistent with the rest of the product.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Recovery step 01
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  Submit your account email.
                </p>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Recovery step 02
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  Open the secure reset link from your inbox.
                </p>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Recovery step 03
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  Set a new password and return to the product immediately.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </main>
  )
}