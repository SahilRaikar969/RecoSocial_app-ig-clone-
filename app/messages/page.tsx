import { redirect } from 'next/navigation'
import { PageShell } from '@/components/ui/page-shell'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import Link from 'next/link'
import { MessagesLive } from '@/components/messages/messages-live'
import { ConversationList } from '@/components/messages/conversation-list'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getInboxData, getOrCreateDirectThread } from '@/lib/db/queries/messages'

export const metadata = { title: 'Messages' }

type MessagesPageProps = {
  searchParams?: Promise<{
    with?: string
    before?: string
    beforeId?: string
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
      return 'Messages could not be loaded. Try again.'
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

  // Keep PostgreSQL microseconds intact so equal-millisecond inbox pages do not skip threads.
  const cursor = params?.before && params.beforeId && Number.isFinite(Date.parse(params.before)) && /^[0-9a-f-]{36}$/i.test(params.beforeId) ? { created_at: params.before, id: params.beforeId } : undefined
  const { conversations, nextCursor } = await getInboxData(profileId, cursor)
  const errorMessage = getErrorMessage(params?.error)

  return <PageShell maxWidth="4xl"><h1 className="text-2xl font-semibold">Messages</h1>{errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}<p className="text-sm text-zinc-400">Message people who follow you back.</p><MessagesLive key={profileId} viewerId={profileId}><ConversationList conversations={conversations} />{nextCursor ? <Link className="rs-button mt-4" href={'/messages?' + new URLSearchParams({ before: nextCursor.created_at, beforeId: nextCursor.id })}>Older conversations</Link> : null}{cursor ? <Link href="/messages" className="rs-button mt-4">Latest conversations</Link> : null}</MessagesLive></PageShell>
}
