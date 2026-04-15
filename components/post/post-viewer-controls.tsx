'use client'

import Link from 'next/link'
import { EyeOff, Flag, UserRound } from 'lucide-react'
import { useRef, useTransition } from 'react'
import { hidePost, reportPost, unhidePost } from '@/actions/post-moderation'

type PostViewerControlsProps = {
  postId: string
  devProfileId: string
  returnTo: string
  hiddenByViewer: boolean
  reportedByViewer: boolean
  authorProfileHref: string
  authorUsername: string
}

export function PostViewerControls({
  postId,
  devProfileId,
  returnTo,
  hiddenByViewer,
  reportedByViewer,
  authorProfileHref,
  authorUsername,
}: PostViewerControlsProps) {
  const hideFormRef = useRef<HTMLFormElement | null>(null)
  const unhideFormRef = useRef<HTMLFormElement | null>(null)
  const reportFormRef = useRef<HTMLFormElement | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleHideToggle() {
    startTransition(() => {
      if (hiddenByViewer) {
        unhideFormRef.current?.requestSubmit()
        return
      }

      hideFormRef.current?.requestSubmit()
    })
  }

  function handleReport() {
    if (reportedByViewer) return

    startTransition(() => {
      reportFormRef.current?.requestSubmit()
    })
  }

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(16,16,22,0.96),rgba(8,8,10,0.98))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.20)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.10),transparent_30%)]" />

      <form ref={hideFormRef} action={hidePost} className="hidden">
        <input type="hidden" name="post_id" value={postId} />
        <input type="hidden" name="dev_profile_id" value={devProfileId} />
        <input type="hidden" name="return_to" value={returnTo} />
      </form>

      <form ref={unhideFormRef} action={unhidePost} className="hidden">
        <input type="hidden" name="post_id" value={postId} />
        <input type="hidden" name="dev_profile_id" value={devProfileId} />
        <input type="hidden" name="return_to" value={returnTo} />
      </form>

      <form ref={reportFormRef} action={reportPost} className="hidden">
        <input type="hidden" name="post_id" value={postId} />
        <input type="hidden" name="dev_profile_id" value={devProfileId} />
        <input type="hidden" name="reason" value="other" />
        <input type="hidden" name="details" value="" />
        <input type="hidden" name="return_to" value={returnTo} />
      </form>

      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Viewer controls
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              Tune what appears in your feed and discovery surfaces.
            </p>
          </div>

          <Link
            href={authorProfileHref}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950/85 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white"
          >
            <UserRound className="h-3.5 w-3.5" />
            @{authorUsername}
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleHideToggle}
            disabled={isPending}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              hiddenByViewer
                ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_14px_30px_rgba(120,119,255,0.12)]'
                : 'border-zinc-700 bg-black/70 text-zinc-200 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            <EyeOff className="h-4 w-4" />
            {hiddenByViewer ? 'Restore post' : 'Hide post'}
          </button>

          <button
            type="button"
            onClick={handleReport}
            disabled={isPending || reportedByViewer}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              reportedByViewer
                ? 'border-red-900/40 bg-red-950/40 text-red-200'
                : 'border-zinc-700 bg-black/70 text-zinc-200 hover:-translate-y-0.5 hover:border-red-800/60 hover:bg-red-950/30 hover:text-red-100'
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            <Flag className="h-4 w-4" />
            {reportedByViewer ? 'Reported' : 'Report post'}
          </button>
        </div>
      </div>
    </section>
  )
}