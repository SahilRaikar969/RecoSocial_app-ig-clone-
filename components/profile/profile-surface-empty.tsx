type ProfileSurfaceEmptyProps = { eyebrow: string; title: string; body: string }

export function ProfileSurfaceEmpty({ title, body }: ProfileSurfaceEmptyProps) {
  return (
    <section className="rounded-xl border border-dashed border-zinc-700 px-5 py-10 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">{body}</p>
    </section>
  )
}
