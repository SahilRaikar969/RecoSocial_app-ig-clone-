import Link from 'next/link'
import { SmartImage } from '@/components/ui/smart-image'

type Conversation = {
  id: string
  last_message_at: string
  other_profile: {
    id: string
    username: string
    display_name: string
    avatar_url?: string | null
  }
  last_message?: {
    id: string
    body: string
    sender_id: string
    created_at: string
  } | null
}

type ConversationListProps = {
  conversations: Conversation[]
}

function formatRelative(value: string) {
  const date = new Date(value)
  const now = Date.now()
  const diffMs = now - date.getTime()

  if (diffMs < 60_000) return 'now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h`
  return `${Math.floor(diffMs / 86_400_000)}d`
}

export function ConversationList({ conversations }: ConversationListProps) {
  return (
    <section className="rounded-[28px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <div className="mb-4">
        <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-violet-200">
          Inbox
        </div>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Only creators who mutually follow each other can message.
        </p>
      </div>

      <div className="space-y-3">
        {conversations.map((conversation) => (
          <Link
            key={conversation.id}
            href={`/messages/${conversation.id}`}
            className="flex items-center gap-3 rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4 transition hover:-translate-y-0.5 hover:border-zinc-700"
          >
            <SmartImage
              src={conversation.other_profile.avatar_url}
              alt={conversation.other_profile.display_name}
              className="h-12 w-12 rounded-full object-cover"
              fallbackClassName="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-[10px] uppercase tracking-[0.16em] text-zinc-500"
              fallbackText="User"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-white">
                  {conversation.other_profile.username}
                </p>
                <span className="text-xs text-zinc-500">
                  {formatRelative(conversation.last_message_at)}
                </span>
              </div>

              <p className="mt-1 truncate text-sm text-zinc-400">
                {conversation.last_message?.body || 'Conversation ready'}
              </p>
            </div>
          </Link>
        ))}

        {!conversations.length ? (
          <div className="rounded-[22px] border border-dashed border-zinc-800 bg-zinc-950/70 px-5 py-10 text-center text-sm text-zinc-500">
            No conversations yet
          </div>
        ) : null}
      </div>
    </section>
  )
}