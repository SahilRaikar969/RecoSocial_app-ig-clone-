import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { SmartImage } from '@/components/ui/smart-image'

type Conversation = {
  id: string
  has_unread?: boolean
  last_message_at: string
  other_profile: {
    id: string
    username: string
    display_name: string
    avatar_url?: string | null
  }
  last_message?: {
    id: string
    body: string | null
    sender_id: string | null
    created_at: string | null
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
    <section aria-label="Conversations">
      <div className="space-y-3">
        {conversations.map((conversation) => (
          <Link
            key={conversation.id}
            href={`/messages/${conversation.id}`}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-4 transition hover:border-zinc-700"
          >
            <SmartImage
              src={conversation.other_profile.avatar_url}
              alt={conversation.other_profile.display_name}
              className="h-11 w-11 md:h-12 md:w-12 rounded-full object-cover"
              fallbackClassName="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full bg-zinc-900 text-xs text-zinc-500"
              fallbackText="User"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-white">
                  {conversation.other_profile.username}{conversation.has_unread ? <span className="ml-2 text-xs text-violet-300">Unread</span> : null}
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
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/80 px-5 py-10 text-center text-sm text-zinc-500">
            No conversations yet
          </div>
        ) : null}
      </div>
    </section>
  )
}
