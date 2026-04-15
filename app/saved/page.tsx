import Link from 'next/link'
import { Bookmark, Clapperboard, Image as ImageIcon } from 'lucide-react'
import { ProfilePostGrid } from '@/components/profile/profile-post-grid'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceEmpty } from '@/components/ui/surface-empty'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getSavedPosts } from '@/lib/db/queries/saved'
import { getMediaUrl } from '@/lib/media/get-media-url'

type SavedPageProps = {
  searchParams?: Promise<{
    saved?: string
    error?: string
  }>
}

export default async function SavedPage({
  searchParams,
}: SavedPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const { profileId } = await getDevSession()

  const posts = await getSavedPosts(profileId)

  const postsWithResolvedMedia = await Promise.all(
    posts.map(async (post) => ({
      ...post,
      resolved_media_url: await getMediaUrl(post.media_path),
      resolved_thumbnail_url: await getMediaUrl(post.thumbnail_path ?? null),
    }))
  )

  const feedback =
    resolvedSearchParams?.saved === 'added'
      ? 'Post saved.'
      : resolvedSearchParams?.saved === 'removed'
        ? 'Post removed from saved.'
        : ''

  const error = resolvedSearchParams?.error || ''
  const errorMessage = error ? decodeURIComponent(error) : ''

  const videoCount = postsWithResolvedMedia.filter((post) => post.media_type === 'video').length
  const imageCount = postsWithResolvedMedia.length - videoCount

  return (
    <PageShell maxWidth="5xl">
      {feedback ? <FeedbackBanner>{feedback}</FeedbackBanner> : null}
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}

      <SurfaceHero
        eyebrow="Saved"
        title="Saved posts"
        description="A retention-first surface for content you want to revisit later, kept as a clean visual grid rather than a dead storage page."
        actions={[
          { href: '/feed', label: 'Back to feed', variant: 'secondary' },
          { href: '/explore', label: 'Explore more', variant: 'secondary' },
        ]}
        stats={[
          {
            label: 'Saved count',
            value: postsWithResolvedMedia.length,
            helper: 'posts kept for future re-entry',
          },
          {
            label: 'Videos',
            value: videoCount,
            helper: 'reels and video posts in this surface',
          },
          {
            label: 'Images',
            value: imageCount,
            helper: 'image posts ready for fast revisit',
          },
        ]}
      />

      <section className="rounded-[32px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                Re-entry loop
              </div>

              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                Come back to high-intent content
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                Saved content sits closer to the main product loop now, so users can move back into creators and post detail instead of losing the trail.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/activity"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open activity
              </Link>

              <Link
                href="/profile"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open profile
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-3 sm:px-6">
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <Bookmark className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Revisit
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Quickly reopen posts you already marked as high value.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <Clapperboard className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Video return
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Jump back into reels and video posts from a visual grid.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <ImageIcon className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Visual scan
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Grid-first layout keeps browsing fast and media-led.
            </p>
          </div>
        </div>
      </section>

      {postsWithResolvedMedia.length ? (
        <ProfilePostGrid
          posts={postsWithResolvedMedia}
          emptyTitle="No saved posts yet"
          emptyBody="Save posts from feed, post detail, or explore and they will appear here in a cleaner grid."
        />
      ) : (
        <SurfaceEmpty
          eyebrow="Saved"
          title="No saved posts yet"
          body="Save posts from feed, post detail, or explore and they will appear here."
          actions={[
            { href: '/feed', label: 'Back to feed' },
            { href: '/explore', label: 'Explore more' },
          ]}
        />
      )}
    </PageShell>
  )
}