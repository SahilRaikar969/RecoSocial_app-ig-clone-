import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { FeedList } from '@/components/feed/feed-list'
import { CreatorSpotlightList } from '@/components/explore/creator-spotlight-list'
import { SearchResults } from '@/components/explore/search-results'
import { SearchPanel } from '@/components/explore/search-panel'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceEmpty } from '@/components/ui/surface-empty'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { filterDiscoveryPosts, getExploreData } from '@/lib/db/queries/explore'
import { getSearchCreators } from '@/lib/db/queries/search'

type ExplorePageProps = { searchParams?: Promise<{ q?: string; category?: string }> }

export const metadata = { title: "Explore" }

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const searchQuery = String(resolvedSearchParams?.q || '').trim()
  const activeCategory = String(resolvedSearchParams?.category || '').trim()
  const { profileId } = await getDevSession()
  const baseData = await getExploreData(profileId, activeCategory || undefined)
  const creators = searchQuery
    ? await getSearchCreators(profileId, searchQuery, activeCategory
        ? [...new Set(baseData.posts.map((post) => post.author_id))]
        : undefined)
    : baseData.creators
  const data = {
    categories: baseData.categories,
    creators,
    // Filtering preserves the query's ranked order and all media/ranking metadata.
    posts: filterDiscoveryPosts(baseData.posts, searchQuery),
  }
  const hasSearch = Boolean(searchQuery)
  const exploreReturnTo = activeCategory ? `/explore?category=${encodeURIComponent(activeCategory)}` : '/explore'
  const categoryHref = (category: string) => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (category) params.set('category', category)
    return params.size ? '/explore?' + params.toString() : '/explore'
  }

  return (
    <PageShell maxWidth="5xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Explore</h1>
        <p className="mt-1 text-sm text-zinc-400">Find your next favorite creator.</p>
      </header>
      <SearchPanel key={searchQuery + ':' + activeCategory} initialQuery={searchQuery} activeCategory={activeCategory} />
      {data.categories.length > 0 || activeCategory ? (
        <nav aria-label="Explore topics" className="flex flex-wrap gap-2">
          <Link href={categoryHref('')} aria-current={!activeCategory ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm ${!activeCategory ? 'border-violet-400 bg-violet-500/10 text-violet-200' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}>All topics</Link>
          {data.categories.map((category) => (
            <Link key={category.id} href={categoryHref(category.slug)} aria-current={activeCategory === category.slug ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm ${activeCategory === category.slug ? 'border-violet-400 bg-violet-500/10 text-violet-200' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}>{category.name}</Link>
          ))}
          {activeCategory && !data.categories.some(category => category.slug === activeCategory) ? <span className="inline-flex min-h-11 items-center rounded-lg border border-violet-400 px-4 text-sm text-violet-200">{activeCategory}</span> : null}
        </nav>
      ) : null}
      {hasSearch ? (
        <SearchResults query={searchQuery} activeCategory={activeCategory} viewerProfileId={profileId} creators={data.creators} posts={data.posts} />
      ) : (
        <>
          {data.creators.length > 0 ? <CreatorSpotlightList creators={data.creators} viewerProfileId={profileId} returnTo={exploreReturnTo} activeCategory={activeCategory} /> : null}
          {data.posts.length > 0 ? (
            <FeedList posts={data.posts} devProfileId={profileId} emptyMode="explore" title={activeCategory ? 'Posts in this topic' : 'Discover posts'} returnToBase={exploreReturnTo} />
          ) : (
            <SurfaceEmpty eyebrow="Explore" title={activeCategory ? 'No posts in this topic yet' : 'No posts to discover yet'} body={activeCategory ? 'Try another topic or browse all posts.' : 'Check back soon for new posts.'} actions={[{ href: '/explore', label: 'All topics' }, { href: '/feed', label: 'Your feed' }]} />
          )}
        </>
      )}
    </PageShell>
  )
}
