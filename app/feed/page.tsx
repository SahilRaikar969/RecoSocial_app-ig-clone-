import Link from 'next/link'
import { FeedList } from '@/components/feed/feed-list'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getFeedData } from '@/lib/db/queries/feed'

type FeedPageProps = {
  searchParams?: Promise<{
    post_created?: string
    hidden?: string
    reported?: string
    onboarding?: string
    error?: string
  }>
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const { profileId } = await getDevSession()
  const params = searchParams ? await searchParams : undefined
  const { posts, summary } = await getFeedData(profileId)

  const feedback =
    params?.post_created === '1'
      ? { tone: 'success' as const, text: 'Post published successfully.' }
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
                ? `Feed action failed: ${decodeURIComponent(error)}`
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
        description="Recommendation-ranked content from followed creators, interest matches, and broader discovery loops, kept inside one cleaner home surface."
        actions={[
          { href: '/create', label: 'Create post', variant: 'primary' },
          { href: '/explore', label: 'Explore', variant: 'secondary' },
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
                This feed combines creator relationships, interest categories,
                and trend signals so discovery still feels alive even when your
                following graph is small.
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
                href="/activity"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Check activity
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
              Category signals from onboarding keep similar posts closer.
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Discovery layer
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Broader trend-weighted content prevents the feed from going flat.
            </p>
          </div>
        </div>
      </section>

      <FeedList
        posts={posts}
        devProfileId={profileId}
        emptyMode="feed"
        title="Ranked posts"
        subtitle="Your main home surface for creator and content discovery."
        returnToBase="/feed"
      />
    </PageShell>
  )
}