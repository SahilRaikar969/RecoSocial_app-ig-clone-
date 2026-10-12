import { createClient } from '@/lib/supabase/server'
import { getMediaUrl } from '@/lib/media/get-media-url'

function sortProfilePair(a: string, b: string) {
  return [a, b].sort((left, right) => left.localeCompare(right)) as [string, string]
}

export async function areMutualFollowers(profileA: string, profileB: string) {
  const supabase = await createClient()

  const [forward, reverse] = await Promise.all([
    supabase
      .from('follows')
      .select('follower_id', { head: true, count: 'exact' })
      .eq('follower_id', profileA)
      .eq('following_id', profileB),
    supabase
      .from('follows')
      .select('follower_id', { head: true, count: 'exact' })
      .eq('follower_id', profileB)
      .eq('following_id', profileA),
  ])

  if (forward.error) throw new Error(forward.error.message)
  if (reverse.error) throw new Error(reverse.error.message)

  return (forward.count ?? 0) > 0 && (reverse.count ?? 0) > 0
}

export async function getOrCreateDirectThread(viewerProfileId: string, otherProfileId: string) {
  const supabase = await createClient()

  if (!viewerProfileId || !otherProfileId || viewerProfileId === otherProfileId) {
    return null
  }

  const mutual = await areMutualFollowers(viewerProfileId, otherProfileId)
  if (!mutual) return null

  const [profileLowId, profileHighId] = sortProfilePair(viewerProfileId, otherProfileId)

  const { data: existingThread, error: existingError } = await supabase
    .from('direct_threads')
    .select('id, profile_low_id, profile_high_id')
    .eq('profile_low_id', profileLowId)
    .eq('profile_high_id', profileHighId)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existingThread) return existingThread

  const { data: insertedThread, error: insertError } = await supabase
    .from('direct_threads')
    .insert({
      profile_low_id: profileLowId,
      profile_high_id: profileHighId,
    })
    .select('id, profile_low_id, profile_high_id')
    .single()

  if (insertError) {
    // A concurrent request for the same canonical pair may win the unique key.
    // Re-read only that pair; never return a thread from another participant set.
    if (insertError.code === '23505') {
      const { data: concurrentThread, error: readError } = await supabase
        .from('direct_threads')
        .select('id, profile_low_id, profile_high_id')
        .eq('profile_low_id', profileLowId)
        .eq('profile_high_id', profileHighId)
        .maybeSingle()
      if (readError) throw new Error(readError.message)
      if (concurrentThread) return concurrentThread
    }
    throw new Error(insertError.message)
  }

  return insertedThread
}

export async function getInboxData(viewerProfileId: string, cursor?: { created_at: string; id: string }) {
  const supabase = await createClient()

  const { data: threads, error: threadsError } = await supabase.rpc('get_direct_inbox', {
    p_limit: 51,
    ...(cursor ? { p_before_at: cursor.created_at, p_before_id: cursor.id } : {}),
  })
  if (threadsError) throw new Error(threadsError.message)
  const page = (threads ?? []).slice(0, 50)
  const otherProfileIds = [...new Set(page.map(thread => thread.profile_low_id === viewerProfileId ? thread.profile_high_id : thread.profile_low_id))]
  const { data: profiles, error: profilesError } = otherProfileIds.length
    ? await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', otherProfileIds)
    : { data: [], error: null }
  if (profilesError) throw new Error(profilesError.message)
  const profileMap = new Map((profiles ?? []).map(row => [row.id, row]))

  const conversations = await Promise.all(
    page.map(async (thread) => {
      const otherProfileId =
        thread.profile_low_id === viewerProfileId ? thread.profile_high_id : thread.profile_low_id
      const otherProfile = profileMap.get(otherProfileId)
      const avatarUrl = await getMediaUrl(otherProfile?.avatar_url ?? null)
      const lastMessage = thread.last_message_id ? { id: thread.last_message_id, body: thread.last_message_body, sender_id: thread.last_message_sender_id, created_at: thread.last_message_created_at } : null

      return {
        id: thread.thread_id,
        has_unread: thread.has_unread,
        last_message_at: thread.last_message_at,
        other_profile: {
          id: otherProfile?.id ?? otherProfileId,
          username: otherProfile?.username ?? 'creator',
          display_name: otherProfile?.display_name ?? 'Creator',
          avatar_url: avatarUrl,
        },
        last_message: lastMessage
          ? {
              id: lastMessage.id,
              body: lastMessage.body,
              sender_id: lastMessage.sender_id,
              created_at: lastMessage.created_at,
            }
          : null,
      }
    })
  )

  const last = page[page.length - 1]
  return { conversations, nextCursor: (threads?.length ?? 0) > 50 && last ? { id: last.thread_id, created_at: last.last_message_at } : null }
}

export async function getThreadPageData(viewerProfileId: string, threadId: string) {
  const supabase = await createClient()

  const { data: thread, error: threadError } = await supabase
    .from('direct_threads')
    .select('id, profile_low_id, profile_high_id, created_at, last_message_at')
    .eq('id', threadId)
    .maybeSingle()

  if (threadError) throw new Error(threadError.message)
  if (!thread) return null

  if (thread.profile_low_id !== viewerProfileId && thread.profile_high_id !== viewerProfileId) {
    return null
  }

  const otherProfileId =
    thread.profile_low_id === viewerProfileId ? thread.profile_high_id : thread.profile_low_id

  const mutual = await areMutualFollowers(viewerProfileId, otherProfileId)
  // History remains participant-only after an unfollow; new sends stay disabled.

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', [viewerProfileId, otherProfileId])

  if (profilesError) throw new Error(profilesError.message)

  const profileMap = new Map((profiles ?? []).map((row) => [row.id, row]))

  const { data: messages, error: messagesError } = await supabase
    .from('direct_messages')
    .select('id, thread_id, sender_id, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(51)

  if (messagesError) throw new Error(messagesError.message)

  return {
    thread: {
      id: thread.id,
      other_profile: {
        id: otherProfileId,
        username: profileMap.get(otherProfileId)?.username ?? 'creator',
        display_name: profileMap.get(otherProfileId)?.display_name ?? 'Creator',
        avatar_url: await getMediaUrl(profileMap.get(otherProfileId)?.avatar_url ?? null),
      },
    },
    messages: (messages ?? []).slice(0, 50).reverse(),
    hasOlder: (messages?.length ?? 0) > 50,
    canSend: mutual,
  }
}