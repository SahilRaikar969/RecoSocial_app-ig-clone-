import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/ui/page-shell'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { MessageThread } from '@/components/messages/message-thread'
import { MessageComposer } from '@/components/messages/message-composer'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getThreadPageData } from '@/lib/db/queries/messages'

type ThreadPageProps = {
  params: Promise<{
    threadId: string
  }>
  searchParams?: Promise<{
    error?: string
    sent?: string
  }>
}

function getErrorMessage(value?: string) {
  const error = String(value || '').trim()
  if (!error) return ''

  switch (error) {
    case 'missing_message_fields':
      return 'Message body is required.'
    case 'message_too_long':
      return 'Message is too long.'
    case 'thread_not_found':
      return 'Thread not found.'
    case 'thread_access_denied':
      return 'You cannot access this thread.'
    case 'mutual_follow_required':
      return 'Only mutual followers can message each other.'
    default:
      return decodeURIComponent(error)
  }
}

export default async function ThreadPage({
  params,
  searchParams,
}: ThreadPageProps) {
  const { threadId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const { profileId } = await getDevSession()

  const data = await getThreadPageData(profileId, String(threadId || '').trim())

  if (!data) {
    notFound()
  }

  const errorMessage = getErrorMessage(resolvedSearchParams?.error)
  const successMessage =
    resolvedSearchParams?.sent === '1' ? 'Message sent.' : ''

  return (
    <PageShell maxWidth="5xl">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/messages"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Back to inbox
        </Link>

        <Link
          href={`/profile/${data.thread.other_profile.id}`}
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          View profile
        </Link>
      </div>

      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}
      {successMessage ? <FeedbackBanner>{successMessage}</FeedbackBanner> : null}

      <MessageThread
        viewerProfileId={profileId}
        otherProfile={data.thread.other_profile}
        messages={data.messages}
      />

      <MessageComposer threadId={data.thread.id} />
    </PageShell>
  )
}