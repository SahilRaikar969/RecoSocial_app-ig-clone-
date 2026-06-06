import { Send } from 'lucide-react'
import { sendDirectMessage } from '@/actions/messages'

type MessageComposerProps = {
  threadId: string
}

export function MessageComposer({ threadId }: MessageComposerProps) {
  return (
    <form
      action={sendDirectMessage}
      className="border-t border-white/10 bg-black/95 p-3"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={`/messages/${threadId}`} />

      <div className="flex items-end gap-2 rounded-[28px] border border-white/10 bg-white/[0.04] p-2">
        <textarea
          name="body"
          rows={1}
          maxLength={1200}
          placeholder="Message..."
          className="max-h-32 min-h-[46px] flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-500"
        />

        <button
          type="submit"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white text-black transition hover:opacity-90"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
