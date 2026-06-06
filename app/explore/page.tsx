import type { ComponentProps } from 'react'
import Link from 'next/link'
import { Compass, Search, Sparkles, TrendingUp } from 'lucide-react'
import { FeedList } from '@/components/feed/feed-list'
import { CreatorSpotlightList } from '@/components/explore/creator-spotlight-list'
import { SearchResults } from '@/components/explore/search-results'
import { SearchPanel } from '@/components/explore/search-panel'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { SurfaceEmpty } from '@/components/ui/surface-empty'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getExploreData } from '@/lib/db/queries/explore'

type FeedListPost = ComponentProps<typeof FeedList>['posts'][number]
type SearchResultPost = ComponentProps<typeof SearchResults>['posts'][number]
type ExplorePost = FeedListPost & SearchResultPost

type SearchResultCreator = ComponentProps<typeof SearchResults>['creators'][number]
type CreatorSpotlightCreator = ComponentProps<
  typeof CreatorSpotlightList
>['creators'][number]
type ExploreCreator = SearchResultCreator & CreatorSpotlightCreator

type RawExploreCategory = {
  id?: string | null
  name?: string | null
  slug?: string | null
}

type RawExplorePostCategory = {
  category_id?: string | null
  categories?: RawExploreCategory | RawExploreCategory[] | null
}

type RawExplorePost = {
  id?: string | null
  author_id?: string | null
  media_type?: string | null
  media_path?: string | null
  caption?: string | null
  category?: string | null
  created_at?: string | null
  like_count?: number | null
  comment_count?: number | null
  save_count?: number | null
  liked_by_me?: boolean | null
  saved_by_me?: boolean | null
  author?: {
    id?: string | null
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
  profiles?: {
    id?: string | null
    username?: string | null
    full_name?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
  post_categories?: RawExplorePostCategory[] | null
}

type RawExploreCreator = {
  id?: string | null
  username?: string | null
  full_name?: string | null
  display_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  followed_by_me?: boolean | null
  follower_count?: number | null
  post_count?: number | null
  latest_post_at?: string | null
  discovery_score?: number | null
  matched_categories?: {
    slug?: string | null
  }[] | null
}

type ExplorePageProps = {
  searchParams?: Promise<{
    q?: string
    category?: string
  }>
}

function getCategoryFromRelation(item: RawExplorePostCategory) {
  return Array.isArray(item.categories)
    ? item.categories[0] ?? null
    : item.categories ?? null
}

function getExploreCategorySlug(item: RawExplorePostCategory) {
  return getCategoryFromRelation(item)?.slug ?? null
}

function normalizeExplorePost(post: RawExplorePost): ExplorePost {
  const profileId = post.profiles?.id || post.author?.id || post.author_id || ''
  const profileUsername =
    post.profiles?.username ?? post.author?.username ?? 'unknown'
  const profileFullName =
    post.profiles?.full_name ??
    post.profiles?.display_name ??
    post.author?.display_name ??
    profileUsername
  const profileAvatar = post.profiles?.avatar_url ?? post.author?.avatar_url ?? null

  const postCategories = Array.isArray(post.post_categories)
    ? post.post_categories.map((item, index) => {
        const category = getCategoryFromRelation(item)
        const categoryId =
          item.category_id || category?.id || `explore-category-${index}`
        const categorySlug = category?.slug || 'category'
        const categoryName = category?.name || categorySlug

        return {
          category_id: categoryId,
          categories: {
            id: categoryId,
            name: categoryName,
            slug: categorySlug,
          },
        }
      })
    : []

  return {
    id: post.id || '',
    author_id: post.author_id || profileId,
    media_type: post.media_type || 'image',
    media_path: post.media_path || '',
    caption: post.caption ?? null,
    category: post.category ?? null,
    created_at: post.created_at || new Date(0).toISOString(),
    like_count: Number(post.like_count ?? 0),
    comment_count: Number(post.comment_count ?? 0),
    save_count: Number(post.save_count ?? 0),
    liked_by_me: Boolean(post.liked_by_me),
    saved_by_me: Boolean(post.saved_by_me),
    profiles: profileId
      ? {
          id: profileId,
          username: profileUsername,
          full_name: profileFullName,
          avatar_url: profileAvatar,
        }
      : null,
    author: profileId
      ? {
          id: profileId,
          username: profileUsername,
          display_name: profileFullName,
          avatar_url: profileAvatar,
        }
      : null,
    post_categories: postCategories,
  } as ExplorePost
}

function normalizeExploreCreator(creator: RawExploreCreator): ExploreCreator {
  const displayName = creator.display_name ?? creator.full_name ?? null

  return {
    id: creator.id || '',
    username: creator.username ?? null,
    full_name: creator.full_name ?? displayName,
    display_name: displayName,
    avatar_url: creator.avatar_url ?? null,
    bio: creator.bio ?? null,
    followed_by_me: Boolean(creator.followed_by_me),
    follower_count: Number(creator.follower_count ?? 0),
    post_count: Number(creator.post_count ?? 0),
    latest_post_at: creator.latest_post_at ?? null,
    discovery_score: Number(creator.discovery_score ?? 0),
    matched_categories: Array.isArray(creator.matched_categories)
      ? creator.matched_categories
      : [],
  } as ExploreCreator
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const searchQuery = String(resolvedSearchParams?.q || '').trim()
  const activeCategory = String(resolvedSearchParams?.category || '').trim()
  const { profileId } = await getDevSession()

  const baseData = await getExploreData(profileId)
  const loweredSearchQuery = searchQuery.toLowerCase()

  const normalizedPosts = Array.isArray(baseData.posts)
    ? (baseData.posts as RawExplorePost[])
        .map(normalizeExplorePost)
        .filter((post) => post.id && post.media_path)
    : []

  const normalizedCreators = Array.isArray(baseData.creators)
    ? (baseData.creators as RawExploreCreator[])
        .map(normalizeExploreCreator)
        .filter((creator) => creator.id)
    : []

  const filteredPosts = normalizedPosts.filter((post) => {
  const matchesCategory =
    !activeCategory ||
    (Array.isArray(post.post_categories) &&
      post.post_categories.some((item) => {
        const category = Array.isArray(item.categories)
          ? item.categories[0] ?? null
          : item.categories ?? null

        return category?.slug === activeCategory
      }))

  const matchesSearch =
    !searchQuery ||
    String(post.caption || '').toLowerCase().includes(loweredSearchQuery) ||
    String(post.author?.username || '')
      .toLowerCase()
      .includes(loweredSearchQuery) ||
    String(post.author?.display_name || '')
      .toLowerCase()
      .includes(loweredSearchQuery)

  return matchesCategory && matchesSearch
})

const filteredCreators = normalizedCreators.filter((creator) => {
  const matchesSearch =
    !searchQuery ||
    String(creator.username || '').toLowerCase().includes(loweredSearchQuery) ||
    String(creator.display_name || '')
      .toLowerCase()
      .includes(loweredSearchQuery) ||
    String(creator.bio || '').toLowerCase().includes(loweredSearchQuery)

  return matchesSearch
})

  const data = {
    categories: Array.isArray(baseData.categories) ? baseData.categories : [],
    creators: filteredCreators,
    posts: filteredPosts,
  }

  const hasSearch = Boolean(searchQuery)
  const hasDiscoveryPosts = data.posts.length > 0
  const hasCreators = data.creators.length > 0
  const exploreReturnTo = activeCategory
    ? `/explore?category=${encodeURIComponent(activeCategory)}`
    : '/explore'

  const heroDescription = hasSearch
    ? 'Search stays inside discovery so users can pivot between creator matches, caption matches, and topic filtering without breaking the browsing loop.'
    : activeCategory
      ? 'Category-led discovery keeps results focused while still preserving a broad social browsing feel.'
      : 'Explore is the wider discovery surface for creators, posts, reels, and topic-led browsing.'

  return (
    <PageShell maxWidth="6xl">
      <div className="space-y-6">
        <SurfaceHero
          eyebrow="Explore"
          title={
            hasSearch
              ? `Search “${searchQuery}”`
              : activeCategory
                ? 'Topic discovery'
                : 'Discover creators and posts'
          }
          description={heroDescription}
          actions={[
            { href: '/feed', label: 'Back to feed', variant: 'secondary' },
            { href: '/saved', label: 'Open saved', variant: 'secondary' },
          ]}
          stats={[
            {
              label: 'Creators',
              value: data.creators.length,
              helper: hasSearch
                ? 'matched to the active search'
                : 'available in discovery',
            },
            {
              label: 'Posts',
              value: data.posts.length,
              helper: activeCategory
                ? 'inside the active topic'
                : 'ranked in discovery',
            },
            {
              label: 'Topics',
              value: data.categories.length,
              helper: 'available category filters',
            },
          ]}
        />

        <SearchPanel
          initialQuery={searchQuery}
          activeCategory={activeCategory}
        />

        {!hasSearch ? (
          <section className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="flex items-center gap-2 text-zinc-300">
                <Search className="h-4 w-4" />
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Search
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                Find creators and caption-level matches without leaving the page.
              </p>
            </div>

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="flex items-center gap-2 text-zinc-300">
                <TrendingUp className="h-4 w-4" />
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Ranking
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                Discovery posts stay sorted for wider browsing instead of only
                follows-based ordering.
              </p>
            </div>

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="flex items-center gap-2 text-zinc-300">
                <Sparkles className="h-4 w-4" />
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Re-entry
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                Open creators, posts, reels, saved, and feed from one connected
                surface.
              </p>
            </div>
          </section>
        ) : null}

        {hasSearch ? (
          <SearchResults
            query={searchQuery}
            activeCategory={activeCategory}
            viewerProfileId={profileId}
            creators={data.creators}
            posts={data.posts}
          />
        ) : hasDiscoveryPosts ? (
          <FeedList
            posts={data.posts}
            devProfileId={profileId}
            emptyMode="explore"
            title={activeCategory ? 'Topic-ranked posts' : 'Discovery posts'}
            subtitle={
              activeCategory
                ? 'Posts ranked inside the active topic while preserving direct routes into creators and reels.'
                : 'A wider discovery ranking built for creator browsing, media-first scanning, and fast re-entry.'
            }
            returnToBase={exploreReturnTo}
          />
        ) : (
          <SurfaceEmpty
            eyebrow="Discovery empty"
            title={
              activeCategory
                ? 'No posts in this topic yet'
                : 'No discovery posts yet'
            }
            body={
              activeCategory
                ? 'Try another topic or reopen the full explore surface to widen discovery.'
                : 'Search creators, change topics, or publish more content to grow the explore surface.'
            }
            actions={[
              { href: '/feed', label: 'Back to feed' },
              { href: '/create', label: 'Create post' },
            ]}
          />
        )}

        {!hasSearch ? (
          hasCreators ? (
            <CreatorSpotlightList
              creators={data.creators}
              viewerProfileId={profileId}
              returnTo={exploreReturnTo}
            />
          ) : (
            <section className="rounded-[32px] border border-zinc-800/90 bg-black p-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                <Compass className="h-3.5 w-3.5" />
                Creator spotlights
              </div>

              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Creator recommendations will appear here once more profiles become
                available.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/profile"
                  className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Open profile
                </Link>

                <Link
                  href="/create"
                  className="rounded-2xl border border-white bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Publish post
                </Link>
              </div>
            </section>
          )
        ) : null}
      </div>
    </PageShell>
  )
}