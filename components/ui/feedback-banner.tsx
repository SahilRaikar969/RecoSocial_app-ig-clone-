type FeedbackBannerProps = {
  children: React.ReactNode
  tone?: 'success' | 'error' | 'neutral' | 'warning'
}

export function FeedbackBanner({
  children,
  tone = 'success',
}: FeedbackBannerProps) {
  const isError = tone === 'error'
  const isWarning = tone === 'warning'
  const isNeutral = tone === 'neutral'

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.18)] ${
        isError
          ? 'border-red-900/50 bg-[linear-gradient(180deg,rgba(60,10,10,0.75),rgba(28,8,8,0.88))] text-red-100'
          : isWarning
            ? 'border-amber-900/50 bg-[linear-gradient(180deg,rgba(56,34,8,0.76),rgba(24,16,6,0.9))] text-amber-100'
            : isNeutral
              ? 'border-zinc-700/70 bg-[linear-gradient(180deg,rgba(28,28,34,0.78),rgba(12,12,16,0.92))] text-zinc-100'
              : 'border-emerald-900/40 bg-[linear-gradient(180deg,rgba(8,42,28,0.72),rgba(6,20,14,0.9))] text-emerald-100'
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          isError
            ? 'bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_32%)]'
            : isWarning
              ? 'bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_32%)]'
              : isNeutral
                ? 'bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.10),transparent_32%)]'
                : 'bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_32%)]'
        }`}
      />

      <div className="relative text-sm font-medium leading-6">{children}</div>
    </div>
  )
}