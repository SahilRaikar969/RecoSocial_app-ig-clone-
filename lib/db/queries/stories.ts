import type { Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { getMediaUrl } from '@/lib/media/get-media-url'

function getStoryPreviewPath(story: Pick<Tables<'stories'>, 'media_type' | 'media_path' | 'thumbnail_path'>) {
  return story.media_type === 'video'
    ? story.thumbnail_path || story.media_path || null
    : story.media_path || story.thumbnail_path || null
}

export async function getStoriesRail(viewerProfileId: string) {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  const { data: followRows, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', viewerProfileId)

  if (followsError) throw new Error(followsError.message)

  const authorIds = [
    viewerProfileId,
    ...(followRows ?? []).map((row) => row.following_id),
  ].filter(Boolean)

  if (authorIds.length === 0) {
    return []
  }

  const { data: stories, error: storiesError } = await supabase
    .from('stories')
    .select(`
      id,
      author_id,
      media_type,
      media_path,
      thumbnail_path,
      caption,
      created_at,
      expires_at
    `)
    .in('author_id', authorIds)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })

  if (storiesError) throw new Error(storiesError.message)

  if (!stories?.length) {
    return []
  }

  const authorProfileIds = [...new Set(stories.map((story) => story.author_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', authorProfileIds)

  if (profilesError) throw new Error(profilesError.message)

  const profileMap = new Map((profiles ?? []).map((row) => [row.id, row]))

  const { data: viewedRows, error: viewedError } = await supabase
    .from('story_views')
    .select('story_id')
    .eq('viewer_id', viewerProfileId)

  if (viewedError) throw new Error(viewedError.message)

  const viewedSet = new Set((viewedRows ?? []).map((row) => row.story_id))

  const grouped = new Map<string, typeof stories>()

  for (const story of stories) {
    const existing = grouped.get(story.author_id) ?? []
    existing.push(story)
    grouped.set(story.author_id, existing)
  }

  const result = await Promise.all(
    Array.from(grouped.entries()).map(async ([authorId, authorStories]) => {
      const author = profileMap.get(authorId)
      const firstUnviewed = authorStories.find((story) => !viewedSet.has(story.id)) ?? authorStories[0]
      const previewUrl = await getMediaUrl(getStoryPreviewPath(firstUnviewed))
      const avatarUrl = await getMediaUrl(author?.avatar_url ?? null)
      const hasUnviewed = authorStories.some((story) => !viewedSet.has(story.id))

      return {
        author: {
          id: author?.id ?? authorId,
          username: author?.username ?? 'creator',
          display_name: author?.display_name ?? 'Creator',
          avatar_url: avatarUrl,
        },
        story_count: authorStories.length,
        first_story_id: firstUnviewed.id,
        preview_url: previewUrl,
        has_unviewed: hasUnviewed,
        is_own_story: authorId === viewerProfileId,
      }
    })
  )

  return result.sort((a, b) => {
    if (a.is_own_story !== b.is_own_story) return a.is_own_story ? -1 : 1
    if (a.has_unviewed !== b.has_unviewed) return a.has_unviewed ? -1 : 1
    return a.author.username.localeCompare(b.author.username)
  })
}

export async function getStoryViewerData(viewerProfileId: string, storyId: string) {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  const { data: currentStory, error: storyError } = await supabase
    .from('stories')
    .select('id, author_id, media_type, media_path, thumbnail_path, caption, created_at, expires_at')
    .eq('id', storyId)
    .gt('expires_at', nowIso)
    .maybeSingle()

  if (storyError) throw new Error(storyError.message)
  if (!currentStory) return null

  const { data: authorStories, error: authorStoriesError } = await supabase
    .from('stories')
    .select('id, author_id, media_type, media_path, thumbnail_path, caption, created_at, expires_at')
    .eq('author_id', currentStory.author_id)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true })

  if (authorStoriesError) throw new Error(authorStoriesError.message)

  const { data: authorProfile, error: authorError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', currentStory.author_id)
    .maybeSingle()

  if (authorError) throw new Error(authorError.message)

  const { data: viewedRows, error: viewedError } = await supabase
    .from('story_views')
    .select('story_id')
    .eq('viewer_id', viewerProfileId)
    .in('story_id', (authorStories ?? []).map((story) => story.id))

  if (viewedError) throw new Error(viewedError.message)

  const viewedSet = new Set((viewedRows ?? []).map((row) => row.story_id))
  const avatarUrl = await getMediaUrl(authorProfile?.avatar_url ?? null)

  const stories = await Promise.all(
    (authorStories ?? []).map(async (story) => ({
      id: story.id,
      media_type: story.media_type,
      media_url: await getMediaUrl(story.media_path),
      thumbnail_url: await getMediaUrl(story.thumbnail_path ?? null),
      caption: story.caption ?? '',
      created_at: story.created_at,
      expires_at: story.expires_at,
      viewed: viewedSet.has(story.id) || story.author_id === viewerProfileId,
    }))
  )

  const initialIndex = Math.max(
    0,
    stories.findIndex((story) => story.id === storyId)
  )

  return {
    author: {
      id: authorProfile?.id ?? currentStory.author_id,
      username: authorProfile?.username ?? 'creator',
      display_name: authorProfile?.display_name ?? 'Creator',
      avatar_url: avatarUrl,
    },
    stories,
    initialIndex,
    viewerProfileId,
  }
}