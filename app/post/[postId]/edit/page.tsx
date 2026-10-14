import { notFound, redirect } from 'next/navigation'
import { EditPostForm } from '@/components/post/edit-post-form'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { requireSession } from '@/lib/auth/session'
import { getAllCategories } from '@/lib/db/queries/categories'
import { getEditablePost } from '@/lib/db/queries/post-edit'
import { getMediaUrl } from '@/lib/media/get-media-url'

type EditPostPageProps = {
  params: Promise<{
    postId: string
  }>
  searchParams?: Promise<{
    error?: string
  }>
}

export const metadata = { title: "Edit post" }

export default async function EditPostPage({
  params,
  searchParams,
}: EditPostPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const { profileId } = await requireSession()

  const postId = String(resolvedParams?.postId || '').trim()

  const [result, categories] = await Promise.all([
    getEditablePost(postId, profileId),
    getAllCategories(),
  ])

  if (!result?.post && !result?.unauthorized) {
    notFound()
  }

  if (result?.unauthorized) {
    redirect(`/post/${postId}?error=not_post_owner`)
  }

  if (!result?.post) {
    notFound()
  }

  const editablePost = result.post
  const [initialMediaUrl, initialThumbnailUrl] = await Promise.all([
    getMediaUrl(editablePost.media_path),
    getMediaUrl(editablePost.thumbnail_path),
  ])
  const error = resolvedSearchParams?.error || ''

  const errorMessage =
    error === 'missing_post_update_ids'
      ? 'Post id or profile id is missing.'
      : error === 'post_not_found'
        ? 'Post not found.'
        : error === 'not_post_owner'
          ? 'You can only edit your own post.'
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
                                          ? `Edit failed: ${error}`
                                          : ''

  return (
    <PageShell maxWidth="6xl">
      <SurfaceHero title="Edit post" />
      <EditPostForm profileId={profileId} post={editablePost} initialMediaUrl={initialMediaUrl} initialThumbnailUrl={initialThumbnailUrl} categories={categories} errorMessage={errorMessage} />
    </PageShell>
  )
}
