import { redirect } from 'next/navigation'
import { PageShell } from '@/components/ui/page-shell'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { ConversationList } from '@/components/messages/conversation-list'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getInboxData, getOrCreateDirectThread } from '@/lib/db/queries/messages'

export const metadata = { title: 'Messages' }

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

  const conversations = await getInboxData(profileId)
  const errorMessage = getErrorMessage(params?.error)

  return <PageShell maxWidth="4xl"><h1 className="text-2xl font-semibold">Messages</h1>{errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}<p className="text-sm text-zinc-400">Message people who follow you back.</p><ConversationList conversations={conversations} /></PageShell>
}
