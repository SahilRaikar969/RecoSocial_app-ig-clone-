import { feedRankingTime } from '@/lib/recommendations/feed-contract'
import { AuthPromptLink } from '@/components/auth/auth-prompt-link'
import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { FeedList } from '@/components/feed/feed-list'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { StoryRail } from '@/components/stories/story-rail'
import { getOptionalSession } from '@/lib/auth/get-dev-session'
import { getFeedData } from '@/lib/db/queries/feed'
import { getStoriesRail } from '@/lib/db/queries/stories'

type FeedPageProps = {
  searchParams?: Promise<{
    post_created?: string
    story_created?: string
    hidden?: string
    reported?: string
    onboarding?: string
    error?: string
    view?: string
    page?: string
    at?: string
  }>
}

export const metadata = { title: "Home" }

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const session=await getOptionalSession()
  const profileId=session?.profileId ?? null
  const params = searchParams ? await searchParams : undefined
  const view = params?.view === 'following' ? 'following' : 'for-you'
  const rankingTime = feedRankingTime(params?.at)
  const requestedPage = Number(params?.page ?? 1)
  const [{ posts, pagination }, storyRail] = await Promise.all([
    getFeedData(profileId, { view, page: requestedPage, candidateBefore: rankingTime }),
    getStoriesRail(profileId),
  ])
  const feedHref = (pageNumber: number) => '/feed?' + new URLSearchParams({ view, page: String(pageNumber), at: String(rankingTime) }).toString()
  const feedback = params?.post_created === '1'
    ? { tone: 'success' as const, text: 'Post published.' }
    : params?.story_created === '1'
      ? { tone: 'success' as const, text: 'Story published.' }
      : params?.hidden === '1'
        ? { tone: 'neutral' as const, text: 'Post hidden from your feed.' }
        : params?.reported === '1'
          ? { tone: 'warning' as const, text: 'Post reported.' }
          : params?.onboarding === 'done'
            ? { tone: 'neutral' as const, text: 'Your interests were saved.' }
            : null
  const error = params?.error || ''
  const errorMessage = error === 'post_not_found'
    ? 'This post is no longer available.'
    : error === 'cannot_hide_own_post'
      ? 'You cannot hide your own post.'
      : error === 'cannot_report_own_post'
        ? 'You cannot report your own post.'
        : error ? 'Could not update this post. Please try again.' : ''

  return (
    <PageShell maxWidth="4xl">
      <div className="mx-auto w-full max-w-[640px] space-y-5">
        {feedback ? <FeedbackBanner tone={feedback.tone}>{feedback.text}</FeedbackBanner> : null}
        {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{profileId ? 'Your feed' : 'Discover RecoSocial'}</h1>
          <Link href="/create" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500">Create post</Link>
        </header>
        {!profileId ? <div className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-300">Browse public posts. <AuthPromptLink returnTo="/feed" action="personalize">Sign in to personalize your feed</AuthPromptLink></div> : null}
        <StoryRail items={storyRail} />
        <nav aria-label="Feed views" className="flex border-b border-zinc-800">
          <Link href="/feed" aria-current={view === 'for-you' ? 'page' : undefined} className={`min-h-11 flex-1 border-b-2 px-4 py-3 text-center text-sm font-semibold ${view === 'for-you' ? 'border-violet-400 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}>For You</Link>
          <Link href={profileId ? "/feed?view=following" : "/login?next=%2Ffeed%3Fview%3Dfollowing&reason=follow"} aria-current={view === 'following' ? 'page' : undefined} className={`min-h-11 flex-1 border-b-2 px-4 py-3 text-center text-sm font-semibold ${view === 'following' ? 'border-violet-400 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}>Following</Link>
        </nav>
        <FeedList posts={posts} devProfileId={profileId} emptyMode="feed" feedView={view} title={view === 'following' ? 'Following' : 'For You'} returnToBase={feedHref(pagination.page)} />
        {pagination.pageCount > 1 ? (
          <nav aria-label="Feed pages" className="flex flex-wrap items-center justify-center gap-3 text-sm">
            {pagination.page > 1 ? <Link href={feedHref(pagination.page - 1)} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 hover:bg-zinc-800">Previous</Link> : null}
            <span className="text-zinc-400">Page {pagination.page} of {pagination.pageCount}</span>
            {pagination.page < pagination.pageCount ? <Link href={feedHref(pagination.page + 1)} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 hover:bg-zinc-800">Next</Link> : null}
          </nav>
        ) : null}
      </div>
    </PageShell>
  )
}
