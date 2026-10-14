import { notFound } from 'next/navigation'
import { getOptionalSession } from '@/lib/auth/session'
import { getStoryViewerData } from '@/lib/db/queries/stories'
import { StoryViewer } from '@/components/stories/story-viewer'

type StoryViewerPageProps = {
  params: Promise<{
    storyId: string
  }>
}

export const metadata = { title: "Stories" }

export default async function StoryViewerPage({ params }: StoryViewerPageProps) {
  const { storyId } = await params
  const session = await getOptionalSession()
  const profileId = session?.profileId ?? null

  const data = await getStoryViewerData(profileId, String(storyId || '').trim())

  if (!data) {
    notFound()
  }

  return (
    <StoryViewer
      key={`${profileId ?? 'guest'}:${storyId}`}
      viewerProfileId={profileId}
      previousAuthorStoryId={data.previousAuthorStoryId}
      nextAuthorStoryId={data.nextAuthorStoryId}
      author={data.author}
      stories={data.stories}
      initialIndex={data.initialIndex}
    />
  )
}