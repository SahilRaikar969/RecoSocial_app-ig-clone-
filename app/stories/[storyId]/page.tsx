import { notFound } from 'next/navigation'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getStoryViewerData } from '@/lib/db/queries/stories'
import { StoryViewer } from '@/components/stories/story-viewer'

type StoryViewerPageProps = {
  params: Promise<{
    storyId: string
  }>
}

export default async function StoryViewerPage({ params }: StoryViewerPageProps) {
  const { storyId } = await params
  const { profileId } = await getDevSession()

  const data = await getStoryViewerData(profileId, String(storyId || '').trim())

  if (!data) {
    notFound()
  }

  return (
    <StoryViewer
      author={data.author}
      stories={data.stories}
      initialIndex={data.initialIndex}
    />
  )
}