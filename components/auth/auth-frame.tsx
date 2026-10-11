import Link from 'next/link'

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="flex min-h-dvh items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <Link href="/login" className="mb-8 inline-flex min-h-11 items-center gap-3 text-xl font-semibold tracking-tight text-white">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-lg font-bold text-white">r</span>
          RecoSocial
        </Link>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-8">
          {children}
        </section>
        <p className="mt-6 text-center text-sm text-zinc-400">Your interests. Your people.</p>
      </div>
    </main>
  )
}
