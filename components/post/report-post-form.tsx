import { reportPost } from '@/actions/post-moderation'

type ReportPostFormProps = {
  postId: string
  devProfileId: string
  returnTo: string
  disabled?: boolean
}

export function ReportPostForm({
  postId,
  devProfileId,
  returnTo,
  disabled = false,
}: ReportPostFormProps) {
  return (
    <form action={reportPost} className="space-y-4">
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="dev_profile_id" value={devProfileId} />
      <input type="hidden" name="return_to" value={returnTo} />

      <div className="grid gap-3">
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-zinc-500">
            Reason
          </label>
          <select
            name="reason"
            defaultValue="spam"
            disabled={disabled}
            className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="spam">Spam</option>
            <option value="harassment">Harassment</option>
            <option value="nsfw">NSFW</option>
            <option value="misinformation">Misinformation</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-zinc-500">
            Details
          </label>
          <textarea
            name="details"
            rows={3}
            disabled={disabled}
            placeholder="Optional details"
            className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled}
        className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
          disabled
            ? 'cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-500'
            : 'border-amber-900/50 bg-amber-950/40 text-amber-200 hover:border-amber-700 hover:bg-amber-950/60'
        }`}
      >
        {disabled ? 'Already reported' : 'Report post'}
      </button>
    </form>
  )
}