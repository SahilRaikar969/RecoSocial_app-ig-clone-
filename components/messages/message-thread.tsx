import { SmartImage } from '@/components/ui/smart-image'

type ThreadMessage = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
}

type MessageThreadProps = {
  viewerProfileId: string
  otherProfile: {
    id: string
    username: string
    display_name: string
    avatar_url?: string | null
  }
  messages: ThreadMessage[]
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function MessageThread({
  viewerProfileId,
  otherProfile,
  messages,
}: MessageThreadProps) {
  return (
    <section className="bg-black">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-black/95 px-4 py-4 backdrop-blur md:px-5">
        <SmartImage
          src={otherProfile.avatar_url}
          alt={otherProfile.display_name}
          className="h-11 w-11 rounded-full border border-white/10 object-cover md:h-12 md:w-12"
          fallbackClassName="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-[10px] uppercase tracking-[0.16em] text-zinc-500 md:h-12 md:w-12"
          fallbackText="User"
        />

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{otherProfile.username}</p>
          <p className="truncate text-xs text-zinc-400">{otherProfile.display_name}</p>
        </div>
      </div>

      <div className="min-h-[54vh] space-y-3 px-4 py-5 md:px-5">
        {messages.map((message) => {
          const own = message.sender_id === viewerProfileId

          return (
            <div
              key={message.id}
              className={`flex ${own ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[86%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_10px_26px_rgba(0,0,0,0.16)] sm:max-w-[78%] ${
                  own
                    ? 'bg-white text-black'
                    : 'border border-white/10 bg-white/[0.06] text-zinc-100'
                }`}
              >
                <p className="break-words">{message.body}</p>
                <p className={`mt-1 text-right text-[11px] ${own ? 'text-black/55' : 'text-zinc-500'}`}>
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          )
        })}

        {!messages.length ? (
          <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-12 text-center text-sm text-zinc-500">
            No messages yet
          </div>
        ) : null}
      </div>
    </section>
  )
}
