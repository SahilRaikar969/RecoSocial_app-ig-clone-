import { sendDirectMessage } from '@/actions/messages'

type MessageComposerProps = {
  threadId: string
}

export function MessageComposer({ threadId }: MessageComposerProps) {
  return (
    <form
      action={sendDirectMessage}
      className="rounded-[28px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={`/messages/${threadId}`} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <textarea
          name="body"
          rows={3}
          maxLength={1200}
          placeholder="Write a message..."
          className="min-h-[96px] flex-1 rounded-[22px] border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-zinc-500"
        />

        <button
          type="submit"
          className="rounded-[22px] border border-white bg-[linear-gradient(90deg,#ffffff_0%,#f4f4ff_100%)] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 sm:self-end"
        >
          Send
        </button>
      </div>
    </form>
  )
}