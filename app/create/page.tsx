import { CreatePostForm } from '@/components/create/create-post-form'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { getAllCategories } from '@/lib/db/queries/categories'
import { requireSession } from '@/lib/auth/session'

type CreatePageProps = {
  searchParams?: Promise<{ error?: string }>
}

export const metadata = { title: "Create post" }

export default async function CreatePage({
  searchParams,
}: CreatePageProps) {
  const { profileId } = await requireSession()
  const params = searchParams ? await searchParams : undefined
  const error = params?.error || ''
  const categories = await getAllCategories()

  const errorMessage =
    error === 'missing_dev_profile_id'
      ? 'Profile id is missing.'
      : error === 'media_source_required'
        ? 'Add either a media upload or a valid direct media URL.'
        : error === 'invalid_media_url'
          ? 'Use a direct image or video file URL ending in .jpg, .png, .webp, .mp4, or similar.'
          : error === 'invalid_media_type'
            ? 'Media type must be image or video.'
            : error === 'caption_too_long'
              ? 'Caption is too long. Keep it within 280 characters.'
              : error === 'invalid_media_file_type'
                ? 'Unsupported media file type. Use JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV.'
                : error === 'media_file_too_large'
                  ? 'Media file is too large. Keep images under 15 MB and videos under 50 MB.'
                  : error === 'thumbnail_required'
                    ? 'Video posts need a thumbnail upload or thumbnail URL.'
                    : error === 'invalid_thumbnail_url'
                      ? 'Use a direct thumbnail image URL ending in .jpg, .png, or .webp.'
                      : error === 'invalid_thumbnail_file_type'
                        ? 'Unsupported thumbnail file type. Use JPG, PNG, WEBP, or GIF.'
                        : error === 'thumbnail_file_too_large'
                          ? 'Thumbnail file is too large. Keep it under 10 MB.'
                          : error === 'no_categories_selected'
                            ? 'Select at least one category.'
                            : error === 'categories_not_found'
                              ? 'Selected categories were not found.'
                              : error === 'some_categories_not_found'
                                ? 'One or more selected categories were not found.'
                                : error === 'media_upload_failed'
                                  ? 'Media upload failed. Please try again.'
                                  : error === 'thumbnail_upload_failed'
                                    ? 'Cover upload failed. Please try again.'
                                    : error
                                      ? `Create failed: ${error}`
                                      : ''

  return (
    <PageShell maxWidth="6xl">
      <SurfaceHero title="Create a post" description="Share a photo or video." />
      <CreatePostForm profileId={profileId} categories={categories} errorMessage={errorMessage} />
    </PageShell>
  )
}
