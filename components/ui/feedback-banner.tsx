import type { ReactNode } from 'react'
type FeedbackBannerProps = { children: ReactNode; tone?: 'success' | 'error' | 'neutral' | 'warning' }
const tones = {
  success: 'border-emerald-800 bg-emerald-950 text-emerald-100',
  error: 'border-red-800 bg-red-950 text-red-100',
  neutral: 'border-zinc-700 bg-zinc-900 text-zinc-100',
  warning: 'border-amber-800 bg-amber-950 text-amber-100',
}
export function FeedbackBanner({ children, tone = 'success' }: FeedbackBannerProps) {
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere] ${tones[tone]}`}>{children}</div>
}
