import Link from 'next/link'
import { redirect } from 'next/navigation'
import { NetworkProfileList } from '@/components/profile/network-profile-list'
import { NetworkSearchForm } from '@/components/profile/network-search-form'
import { PageShell } from '@/components/ui/page-shell'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getProfileNetworkPageData } from '@/lib/db/queries/network'
import { getProfilePageData } from '@/lib/db/queries/profile'

type FollowersPageProps = {
  params: Promise<{
    profileId: string
  }>
  searchParams?: Promise<{
    q?: string
  }>
}

export const metadata = { title: "Followers" }

export default async function FollowersPage({
  params,
  searchParams,
}: FollowersPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const viewedProfileId = String(resolvedParams?.profileId || '').trim()
  const query = String(resolvedSearchParams?.q || '').trim()
  const { profileId: viewerProfileId } = await getDevSession()

  if (!viewedProfileId) {
    redirect('/profile')
  }

  const [{ profile }, { profiles }] = await Promise.all([
    getProfilePageData(viewerProfileId, viewedProfileId),
    getProfileNetworkPageData(viewerProfileId, viewedProfileId, 'followers', query),
  ])

  const returnTo = query
    ? `/profile/${viewedProfileId}/followers?q=${encodeURIComponent(query)}`
    : `/profile/${viewedProfileId}/followers`

  return (
    <PageShell maxWidth="4xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-white">Followers</h1><p className="mt-1 text-sm text-zinc-400">@{profile.username}</p></div>
        <Link href={profile.is_own_profile ? '/profile' : '/profile/' + viewedProfileId} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-zinc-300 hover:bg-zinc-800">Back to profile</Link>
      </header>
      <nav aria-label="Profile network" className="mb-4 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        <span aria-current="page" className="inline-flex min-h-11 items-center rounded-lg bg-violet-500/10 px-3 text-sm font-medium text-violet-200">Followers</span>
        <Link href={'/profile/' + viewedProfileId + '/following'} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white">Following</Link>
      </nav>
      <NetworkSearchForm placeholder="Search followers" defaultValue={query} />
      <NetworkProfileList profiles={profiles} viewerProfileId={viewerProfileId} returnTo={returnTo}
        emptyTitle={query ? 'No people match your search' : 'No followers yet'}
        emptyBody={query ? 'Try another name or username.' : 'People who follow this profile will appear here.'} />
    </PageShell>
  )
}
