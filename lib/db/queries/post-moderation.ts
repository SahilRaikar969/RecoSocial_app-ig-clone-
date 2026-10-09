import { createClient } from '@/lib/supabase/server'

export type ViewerPostModerationState = {
  hiddenByViewer: boolean
  reportedByViewer: boolean
}

// Only load state for rendered cards. Keep each request below URL/row limits,
// scope both tables to the verified viewer, and never cache across requests.
export async function getViewerPostModerationStates(
  profileId: string,
  postIds: string[]
): Promise<Map<string, ViewerPostModerationState>> {
  const ids = [...new Set(postIds.filter(Boolean))]
  const states = new Map(ids.map(id => [id, { hiddenByViewer: false, reportedByViewer: false }]))
  if (!ids.length) return states

  const supabase = await createClient()
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200)
    const [hidden, reported] = await Promise.all([
      supabase.from('hidden_posts').select('post_id').eq('profile_id', profileId).in('post_id', batch),
      supabase.from('post_reports').select('post_id').eq('reporter_id', profileId).in('post_id', batch),
    ])
    if (hidden.error) throw new Error(hidden.error.message)
    if (reported.error) throw new Error(reported.error.message)
    for (const row of hidden.data ?? []) {
      const state = states.get(row.post_id)
      if (state) state.hiddenByViewer = true
    }
    for (const row of reported.data ?? []) {
      const state = states.get(row.post_id)
      if (state) state.reportedByViewer = true
    }
  }
  return states
}

export async function getHiddenPostIds(profileId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('hidden_posts')
    .select('post_id')
    .eq('profile_id', profileId)

  if (error) {
    throw new Error(error.message)
  }

  return new Set(
    (data ?? [])
      .map(row => row.post_id)
      .filter(Boolean)
  )
}

export async function getViewerPostModerationState(
  profileId: string,
  postId: string
) {
  const supabase = await createClient()

  const [
    { data: hiddenRow, error: hiddenError },
    { data: reportRow, error: reportError },
  ] = await Promise.all([
    supabase
      .from('hidden_posts')
      .select('post_id')
      .eq('profile_id', profileId)
      .eq('post_id', postId)
      .maybeSingle(),

    supabase
      .from('post_reports')
      .select('id')
      .eq('reporter_id', profileId)
      .eq('post_id', postId)
      .maybeSingle(),
  ])

  if (hiddenError) {
    throw new Error(hiddenError.message)
  }

  if (reportError) {
    throw new Error(reportError.message)
  }

  return {
    hiddenByViewer: !!hiddenRow,
    reportedByViewer: !!reportRow,
  }
}