import Link from 'next/link'
import { CreatePostForm } from '@/components/create/create-post-form'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { getAllCategories } from '@/lib/db/queries/categories'
import { getDevSession } from '@/lib/auth/get-dev-session'

type CreatePageProps = {
  searchParams?: Promise<{ error?: string }>
}

export default async function CreatePage({
  searchParams,
}: CreatePageProps) {
  const { profileId } = await getDevSession()
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
                                  ? 'Media upload failed. Check the storage bucket and policies.'
                                  : error === 'thumbnail_upload_failed'
                                    ? 'Thumbnail upload failed. Check the storage bucket and policies.'
                                    : error
                                      ? `Create failed: ${error}`
                                      : ''

  return (
    <PageShell maxWidth="6xl">
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}

      <SurfaceHero
        eyebrow="Create"
        title="Publish a post"
        description="Build a cleaner creator workflow with upload-first media handling, better previewing, tighter category intent, and stronger readiness before publishing."
        actions={[
          { href: '/feed', label: 'Back to feed', variant: 'secondary' },
          { href: '/profile', label: 'Open profile', variant: 'secondary' },
        ]}
        stats={[
          {
            label: 'Media',
            value: 'Image + video',
            helper: 'upload or direct URL source',
          },
          {
            label: 'Categories',
            value: categories.length,
            helper: 'available ranking and discovery topics',
          },
          {
            label: 'Surface',
            value: 'Creator-first',
            helper: 'publish into feed, explore, profile, and post detail',
          },
        ]}
      />

      <section className="rounded-[32px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                Publishing workflow
              </div>

              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                Build content before it goes live
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                Media type, upload method, thumbnail support, caption quality, and category selection all shape how this post enters recommendation surfaces.
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
                href="/saved"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open saved
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-3 sm:px-6">
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Preview-first
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              See the post shape before publishing instead of filling a flat dev form.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Better categorization
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Strong topic selection improves ranking placement and creator discovery quality.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Video-ready
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Video posts now have a cleaner thumbnail path instead of a confusing secondary field block.
            </p>
          </div>
        </div>
      </section>

      <CreatePostForm
        profileId={profileId}
        categories={categories}
        errorMessage={errorMessage}
      />
    </PageShell>
  )
}