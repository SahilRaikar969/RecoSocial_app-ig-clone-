import { redirect } from 'next/navigation'
import { PageShell } from '@/components/ui/page-shell'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { SurfaceHero } from '@/components/ui/surface-hero'
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

      <SurfaceHero
        eyebrow="Messages"
        title="Mutual-follow inbox"
        description="Direct conversations stay lightweight and only open between creators who follow each other both ways."
        actions={[
          { href: '/feed', label: 'Back to feed', variant: 'secondary' },
        ]}
        stats={[
          { label: 'Conversations', value: conversations.length, helper: 'active direct threads' },
        ]}
      />

      <ConversationList conversations={conversations} />
    </PageShell>
  )
}