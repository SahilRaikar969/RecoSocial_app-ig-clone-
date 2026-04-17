import Link from 'next/link'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { logout } from '@/actions/auth'

export default function SettingsPage() {
  return (
    <PageShell maxWidth="5xl">
      <SurfaceHero
        eyebrow="Settings"
        title="Account and app controls"
        description="This is the main entry point for account tools, app appearance, privacy options, reported content review, and device-related controls. Phase 1 adds the structure and access point cleanly before deeper settings logic lands next."
        actions={[
          { href: '/profile', label: 'Back to profile', variant: 'secondary' },
          { href: '/feed', label: 'Back to feed', variant: 'secondary' },
        ]}
        stats={[
          { label: 'Phase', value: '1', helper: 'entry and structure added' },
          { label: 'Theme modes', value: '2', helper: 'coming in next phase' },
          { label: 'Privacy controls', value: 'Core', helper: 'next phase target' },
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
          <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-violet-200">
            Account
          </div>

          <div className="mt-5 space-y-3">
            <Link
              href="/profile/edit"
              className="block rounded-[22px] border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:text-white"
            >
              Edit profile
            </Link>

            <Link
              href="/profile"
              className="block rounded-[22px] border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:text-white"
            >
              Open profile
            </Link>

            <form action={logout}>
              <button
                type="submit"
                className="block w-full rounded-[22px] border border-red-900/40 bg-red-950/25 px-4 py-4 text-left text-sm text-red-100 transition hover:-translate-y-0.5 hover:border-red-800/60"
              >
                Log out
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
          <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-200">
            Coming next
          </div>

          <div className="mt-5 space-y-3">
            {[
              'Dark / light premium theme switch',
              'Account privacy controls',
              'Blocked and reported content management',
              'Camera and media permission helpers',
              'Remembered device and session controls',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-zinc-800 bg-zinc-950/75 px-4 py-4 text-sm text-zinc-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  )
}