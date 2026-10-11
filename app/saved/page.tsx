import { ProfilePostGrid } from '@/components/profile/profile-post-grid'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceEmpty } from '@/components/ui/surface-empty'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getSavedPosts } from '@/lib/db/queries/saved'
import { getMediaUrl } from '@/lib/media/get-media-url'

type SavedPageProps = { searchParams?: Promise<{ saved?: string; error?: string }> }

export const metadata = { title: "Saved" }

export default async function SavedPage({ searchParams }: SavedPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const { profileId } = await getDevSession()
  const posts = await getSavedPosts(profileId)
  const postsWithResolvedMedia = await Promise.all(posts.map(async (post) => ({
    ...post,
    resolved_media_url: await getMediaUrl(post.media_path),
    resolved_thumbnail_url: await getMediaUrl(post.thumbnail_path ?? null),
  })))
  const feedback = resolvedSearchParams?.saved === 'added' ? 'Post saved.' : resolvedSearchParams?.saved === 'removed' ? 'Post removed from saved.' : ''

  return (
    <PageShell maxWidth="5xl">
      {feedback ? <FeedbackBanner>{feedback}</FeedbackBanner> : null}
      {resolvedSearchParams?.error ? <FeedbackBanner tone="error">Could not update your saved posts. Please try again.</FeedbackBanner> : null}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Saved</h1>
        <p className="mt-1 text-sm text-zinc-400">Only you can see what you save.</p>
      </header>
      {postsWithResolvedMedia.length ? (
        <ProfilePostGrid posts={postsWithResolvedMedia} openContext={{ source: 'saved' }} emptyTitle="No saved posts yet" emptyBody="Save a post to find it here later." />
      ) : (
        <SurfaceEmpty eyebrow="Saved" title="No saved posts yet" body="Save a post to find it here later." actions={[{ href: '/explore', label: 'Explore posts' }]} />
      )}
    </PageShell>
  )
}
