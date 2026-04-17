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
    <section className="rounded-[28px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
        <SmartImage
          src={otherProfile.avatar_url}
          alt={otherProfile.display_name}
          className="h-12 w-12 rounded-full object-cover"
          fallbackClassName="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-[10px] uppercase tracking-[0.16em] text-zinc-500"
          fallbackText="User"
        />

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{otherProfile.username}</p>
          <p className="truncate text-xs text-zinc-400">{otherProfile.display_name}</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {messages.map((message) => {
          const own = message.sender_id === viewerProfileId

          return (
            <div
              key={message.id}
              className={`flex ${own ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-[22px] px-4 py-3 text-sm leading-7 ${
                  own
                    ? 'border border-violet-400/20 bg-violet-500/10 text-white'
                    : 'border border-zinc-800 bg-zinc-950/85 text-zinc-200'
                }`}
              >
                <p>{message.body}</p>
                <p className="mt-1 text-right text-[11px] text-zinc-400">
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          )
        })}

        {!messages.length ? (
          <div className="rounded-[22px] border border-dashed border-zinc-800 bg-zinc-950/70 px-5 py-12 text-center text-sm text-zinc-500">
            No messages yet
          </div>
        ) : null}
      </div>
    </section>
  )
}