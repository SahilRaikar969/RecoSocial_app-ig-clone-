import type { createClient } from '@/lib/supabase/server'

type SaveCountClient = Pick<Awaited<ReturnType<typeof createClient>>, 'rpc'>

// Save rows stay owner-only. Ranking uses anonymous totals from a visibility-
// checked RPC, while each query still reads its viewer's own save rows.
export async function getVisiblePostSaveCounts(
  supabase: SaveCountClient,
  postIds: readonly string[]
): Promise<Map<string, number>> {
  const ids = [...new Set(postIds)]
  const counts = new Map<string, number>()

  for (let offset = 0; offset < ids.length; offset += 1000) {
    const { data, error } = await supabase.rpc('get_visible_post_save_counts', {
      post_ids: ids.slice(offset, offset + 1000),
    })

    if (error) throw new Error(error.message)

    for (const row of (data ?? []) as Array<{ post_id: string; save_count: number | string }>) {
      const count = Number(row.save_count)
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error('Invalid post save count')
      }
      counts.set(row.post_id, count)
    }
  }

  return counts
}
