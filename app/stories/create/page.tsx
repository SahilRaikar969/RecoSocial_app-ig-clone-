import { PageShell } from '@/components/ui/page-shell'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { CreateStoryForm } from '@/components/stories/create-story-form'

type CreateStoryPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

function getErrorMessage(value?: string) {
  const error = String(value || '').trim()

  if (!error) return ''

  switch (error) {
    case 'missing_profile_id':
      return 'Missing profile id.'
    case 'caption_too_long':
      return 'Story caption is too long.'
    case 'invalid_media_type':
      return 'Invalid media type.'
    case 'media_source_required':
      return 'Upload media or provide a media URL.'
    case 'invalid_image_file':
      return 'Invalid image file.'
    case 'invalid_video_file':
      return 'Invalid video file.'
    case 'image_too_large':
      return 'Image file is too large.'
    case 'video_too_large':
      return 'Video file is too large.'
    case 'invalid_media_url':
      return 'Media URL is invalid.'
    case 'invalid_thumbnail_file':
      return 'Thumbnail file is invalid.'
    case 'thumbnail_too_large':
      return 'Thumbnail is too large.'
    case 'invalid_thumbnail_url':
      return 'Thumbnail URL is invalid.'
    default:
      return error
  }
}

export default async function CreateStoryPage({
  searchParams,
}: CreateStoryPageProps) {
  const params = searchParams ? await searchParams : undefined
  const errorMessage = getErrorMessage(params?.error)

  return (
    <PageShell maxWidth="4xl">
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}
      <CreateStoryForm errorMessage={errorMessage} />
    </PageShell>
  )
}