'use client'

import { EyeOff, Flag } from 'lucide-react'
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
    <section aria-label="Post options">

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
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleHideToggle}
            disabled={isPending}
            className={`flex items-center justify-center gap-2 min-h-11 rounded-lg border px-4 py-3 text-sm font-semibold transition ${
              hiddenByViewer
                ? 'border-violet-400/30 bg-violet-500/10 text-violet-200'
                : 'border-zinc-700 bg-black/70 text-zinc-200 hover:border-zinc-500 hover:text-white'
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            <EyeOff className="h-4 w-4" />
            {hiddenByViewer ? 'Restore post' : 'Hide post'}
          </button>

          <button
            type="button"
            onClick={handleReport}
            disabled={isPending || reportedByViewer}
            className={`flex items-center justify-center gap-2 min-h-11 rounded-lg border px-4 py-3 text-sm font-semibold transition ${
              reportedByViewer
                ? 'border-red-900/40 bg-red-950/40 text-red-200'
                : 'border-zinc-700 bg-black/70 text-zinc-200 hover:border-red-800/60 hover:bg-red-950/30 hover:text-red-100'
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