type AppNoticeProps = {
  title: string
  body: string
  tone?: 'default' | 'error'
}

export function AppNotice({
  title,
  body,
  tone = 'default',
}: AppNoticeProps) {
  const toneClasses =
    tone === 'error'
      ? 'border-red-900/40 bg-red-950/30'
      : 'border-zinc-800 bg-zinc-950/80'

  return (
    <section className={`rounded-[28px] border p-5 ${toneClasses}`}>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-zinc-400">{body}</p>
    </section>
  )
}