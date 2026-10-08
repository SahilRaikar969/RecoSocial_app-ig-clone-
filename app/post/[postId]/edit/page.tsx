import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { EditPostForm } from '@/components/post/edit-post-form'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getAllCategories } from '@/lib/db/queries/categories'
import { getEditablePost } from '@/lib/db/queries/post-edit'

type EditPostPageProps = {
  params: Promise<{
    postId: string
  }>
  searchParams?: Promise<{
    error?: string
  }>
}

export default async function EditPostPage({
  params,
  searchParams,
}: EditPostPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const { profileId } = await getDevSession()

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
                                      ? 'Media upload failed. Check the storage bucket and policies.'
                                      : error === 'thumbnail_upload_failed'
                                        ? 'Thumbnail upload failed. Check the storage bucket and policies.'
                                        : error
                                          ? `Edit failed: ${error}`
                                          : ''

  return (
    <PageShell maxWidth="6xl">
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}

      <SurfaceHero
        eyebrow="Edit"
        title="Update your post"
        description="Refine media, thumbnail, caption, and category intent without breaking the existing post route, owner actions, or recommendation continuity."
        actions={[
          { href: `/post/${postId}`, label: 'Back to post', variant: 'secondary' },
          { href: '/profile', label: 'Open profile', variant: 'secondary' },
        ]}
        stats={[
          {
            label: 'Current type',
            value: editablePost.media_type,
            helper: 'you can keep or replace the source',
          },
          {
            label: 'Categories',
            value: editablePost.post_categories.length,
            helper: 'currently attached discovery topics',
          },
          {
            label: 'Status',
            value: 'Published',
            helper: 'changes stay on the same live post',
          },
        ]}
      />

      <section className="rounded-[32px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                Edit workflow
              </div>

              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                Improve the post without losing continuity
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                This flow preserves the existing post while letting you replace media, tighten caption clarity, and improve discovery categories from one creator-first workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/explore"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Explore categories
              </Link>

              <Link
                href={`/post/${postId}`}
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                View live post
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-3 sm:px-6">
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Replace media
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Keep the current media source or replace it without creating a new post.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Improve context
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Tighten caption quality and category accuracy to improve how the post is understood.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Keep route continuity
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Edits stay tied to the current post detail, profile grid, and creator identity surface.
            </p>
          </div>
        </div>
      </section>

      <EditPostForm
        profileId={profileId}
        post={editablePost}
        categories={categories}
        errorMessage={errorMessage}
      />
    </PageShell>
  )
}