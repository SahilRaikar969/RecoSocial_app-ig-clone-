import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// One lifecycle per mounted shell. Never retains viewer state across mounts.
export function startUnreadMonitor(
  client: SupabaseClient<Database>,
  onCount: (count: number) => void,
  observer?: {
    onSync?: () => void
    onViewer?: (viewerId: string | null) => void
    onVerifiedViewer?: (viewerId: string | null) => void
  }
) {
  let stopped = false
  let running = false
  let queued = false
  let generation = 0
  let recipientId: string | null = null
  let channel: ReturnType<typeof client.channel> | null = null

  function clearChannel() {
    if (channel) void client.removeChannel(channel)
    channel = null
  }

  async function refresh() {
    if (stopped || document.visibilityState === 'hidden') return
    if (running) { queued = true; return }
    running = true
    const requestGeneration = generation
    try {
      // Preserve verified getUser: browser session events are invalidation only.
      const { data: { user }, error } = await client.auth.getUser()
      if (stopped || requestGeneration !== generation) return
      // An unavailable Auth service is not evidence of logout. Keep the last
      // verified identity until recovery, unless the session is explicitly absent
      // or rejected. Invalidation events alone never reset the document.
      if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401 && error.status !== 403) return
      const verifiedId = !error && user ? user.id : null
      observer?.onVerifiedViewer?.(verifiedId)
      if (verifiedId) {
        // Server auth actions update cookies without notifying this singleton.
        // Switch realtime back to its current-session token callback.
        await client.realtime.setAuth()
        if (stopped || requestGeneration !== generation) return
      }
      if (verifiedId !== recipientId) {
        clearChannel()
        recipientId = verifiedId
        observer?.onViewer?.(verifiedId)
        onCount(0)
        if (verifiedId) {
          // Supabase reuses same-topic channels until async unsubscribe finishes.
          // A fresh topic prevents an old removal from closing this subscription.
          channel = client.channel('activity-unread-' + verifiedId + '-' + crypto.randomUUID())
            .on('postgres_changes', {
              event: '*', schema: 'public', table: 'notifications',
              filter: 'recipient_id=eq.' + verifiedId,
            }, () => { void refresh() }).subscribe(status => {
              if (!stopped && requestGeneration === generation && status === 'SUBSCRIBED') void refresh()
            })
        }
      }
      if (!verifiedId) { observer?.onViewer?.(null); onCount(0); return }
      const { count, error: countError } = await client.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', verifiedId).is('read_at', null)
      if (!stopped && requestGeneration === generation && !countError) {
        onCount(Math.max(0, Number(count || 0)))
        observer?.onSync?.()
      }
    } catch {
      // The decorative unread indicator must not break the navigation shell.
    } finally {
      running = false
      if (queued && !stopped) { queued = false; void refresh() }
    }
  }

  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return // Initial verified read already runs.
    generation += 1
    if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user.id !== recipientId)) observer?.onViewer?.(null)
    recipientId = null
    clearChannel()
    onCount(0)
    // Do not call another Auth method synchronously inside its event callback.
    window.setTimeout(() => { void refresh() }, 0)
  })
  const interval = window.setInterval(() => { void refresh() }, 15000)
  const onVisibility = () => { if (document.visibilityState === 'visible') void refresh() }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onVisibility)
  window.addEventListener('online', onVisibility)
  void refresh()

  return () => {
    stopped = true
    generation += 1
    subscription.unsubscribe()
    clearChannel()
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onVisibility)
    window.removeEventListener('online', onVisibility)
  }
}
