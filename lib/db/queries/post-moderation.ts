import { createClient } from '@/lib/supabase/server'

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
      .map((row: any) => row.post_id)
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