import { redirect } from 'next/navigation'
import { PageShell } from '@/components/ui/page-shell'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { ConversationList } from '@/components/messages/conversation-list'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getInboxData, getOrCreateDirectThread } from '@/lib/db/queries/messages'

type MessagesPageProps = {
  searchParams?: Promise<{
    with?: string
    error?: string
  }>
}

function getErrorMessage(value?: string) {
  const error = String(value || '').trim()
  if (!error) return ''

  switch (error) {
    case 'mutual_follow_required':
      return 'Only mutual followers can message each other.'
    case 'missing_message_profile_id':
      return 'Missing target profile.'
    default:
      return decodeURIComponent(error)
  }
}

export default async function MessagesPage({
  searchParams,
}: MessagesPageProps) {
  const params = searchParams ? await searchParams : undefined
  const { profileId } = await getDevSession()

  const otherProfileId = String(params?.with || '').trim()

  if (otherProfileId) {
    const thread = await getOrCreateDirectThread(profileId, otherProfileId)

    if (thread) {
      redirect(`/messages/${thread.id}`)
    }
  }

  const conversations = await getInboxData(profileId)
  const errorMessage = getErrorMessage(params?.error)

  return (
    <PageShell maxWidth="5xl">
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}

      <section className="overflow-hidden rounded-[34px] border border-white/10 bg-black shadow-[0_18px_52px_rgba(0,0,0,0.28)]">
        <div className="border-b border-white/10 px-5 py-5 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Direct
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Messages
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Mutual-follow conversations in a cleaner social inbox.
          </p>
        </div>
        <div className="p-3 sm:p-5">
          <ConversationList conversations={conversations} />
        </div>
      </section>
    </PageShell>
  )
}
