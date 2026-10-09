import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { FeedList } from '@/components/feed/feed-list'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { StoryRail } from '@/components/stories/story-rail'
import { getDevSession } from '@/lib/auth/get-dev-session'
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
  }>
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const { profileId } = await getDevSession()
  const params = searchParams ? await searchParams : undefined
  const view = params?.view === 'following' ? 'following' : 'for-you'
  const requestedPage = Number(params?.page ?? 1)
  const [{ posts, summary, pagination }, storyRail] = await Promise.all([
    getFeedData(profileId, { view, page: requestedPage }),
    getStoriesRail(profileId),
  ])

  const feedHref = (pageNumber: number) => '/feed?' + new URLSearchParams({ view, page: String(pageNumber) }).toString()
  const feedback =
    params?.post_created === '1'
      ? { tone: 'success' as const, text: 'Post published successfully.' }
      : params?.story_created === '1'
        ? { tone: 'success' as const, text: 'Story published successfully.' }
        : params?.hidden === '1'
          ? { tone: 'neutral' as const, text: 'Post hidden from your feed.' }
          : params?.reported === '1'
            ? { tone: 'warning' as const, text: 'Post reported.' }
            : params?.onboarding === 'done'
              ? {
                  tone: 'neutral' as const,
                  text: 'Your interests were saved. Feed ranking is now seeded from onboarding.',
                }
              : null

  const error = params?.error || ''
  const errorMessage =
    error === 'missing_hide_ids'
      ? 'Missing hide ids.'
      : error === 'missing_report_ids'
        ? 'Missing report ids.'
        : error === 'post_not_found'
          ? 'Post not found.'
          : error === 'cannot_hide_own_post'
            ? 'You cannot hide your own post from moderation controls.'
            : error === 'cannot_report_own_post'
              ? 'You cannot report your own post.'
              : error
                ? `Feed action failed: ${error}`
                : ''

  return (
    <PageShell maxWidth="6xl">
      {feedback ? (
        <FeedbackBanner tone={feedback.tone}>{feedback.text}</FeedbackBanner>
      ) : null}

      {errorMessage ? (
        <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner>
      ) : null}

      <SurfaceHero
        eyebrow="Home"
        title="Your feed"
        description="Posts ranked by your follows, selected interests, likes and saves. Stories appear separately below."
        actions={[
          { href: '/create', label: 'Create post', variant: 'primary' },
          { href: '/stories/create', label: 'Add story', variant: 'secondary' },
        ]}
        stats={[
          {
            label: 'Following',
            value: String(summary.followedCreatorCount),
            helper: 'creators directly shaping this feed',
          },
          {
            label: 'Hidden',
            value: String(summary.hiddenPostCount),
            helper: 'posts removed from your personal loop',
          },
          {
            label: 'Interest topics',
            value: String(summary.topInterestCategories.length),
            helper: 'categories currently steering ranking',
          },
        ]}
      />

      <StoryRail items={storyRail} />

      <section className="rounded-[32px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                Ranking mix
              </div>

              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                Why these posts are surfacing
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                Post ranking combines follows, category interests, aggregate likes, saves
                and comments, and post recency. Views and watch time do not affect it.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/saved"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open saved
              </Link>

              <Link
                href="/messages"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open messages
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-3 sm:px-6">
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Follow graph
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Content from creators you follow remains a strong anchor.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Interest match
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Selected interests and categories on your liked and saved posts influence later rankings.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Freshness layer
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Newer posts receive a small bonus. With no interaction history, engagement and recency determine the order.
            </p>
          </div>
        </div>
      </section>

      <nav aria-label="Feed views" className="flex gap-3">
        <Link href="/feed" aria-current={view === 'for-you' ? 'page' : undefined} className="rounded-2xl border border-zinc-700 px-5 py-3">For You</Link>
        <Link href="/feed?view=following" aria-current={view === 'following' ? 'page' : undefined} className="rounded-2xl border border-zinc-700 px-5 py-3">Following</Link>
      </nav>

      <FeedList
        posts={posts}
        devProfileId={profileId}
        emptyMode="feed"
        feedView={view}
        title={view === 'following' ? 'Following' : 'For You'}
        subtitle="Ranked within the latest eligible candidate window. Refreshing recalculates rankings."
        returnToBase={feedHref(pagination.page)}
      />
      {pagination.pageCount > 1 ? (
        <nav aria-label="Feed pages" className="flex items-center gap-4">
          {pagination.page > 1 ? <Link href={feedHref(pagination.page - 1)}>Previous</Link> : null}
          <span>Page {pagination.page} of {pagination.pageCount}</span>
          {pagination.page < pagination.pageCount ? <Link href={feedHref(pagination.page + 1)}>Next</Link> : null}
        </nav>
      ) : null}
    </PageShell>
  )
}