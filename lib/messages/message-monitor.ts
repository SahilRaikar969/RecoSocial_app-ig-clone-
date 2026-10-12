import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { isMessage, type ThreadMessage } from '@/lib/messages/message-state'

type Options = {
  viewerId: string
  threadId?: string
  cursor?: { id: string; created_at: string }
  onMessages?: (messages: ThreadMessage[]) => void
  onInbox?: () => void
  onStatus: (status: 'connecting' | 'connected' | 'reconnecting') => void
  onAccountChange: () => void
}

// Realtime invalidates; ordered database catch-up is authoritative. This avoids
// advancing past a missing event when reconnects deliver messages out of order.
export function startMessageMonitor(client: SupabaseClient<Database>, options: Options) {
  let stopped = false
  let running = false
  let queued = false
  let generation = 0
  let cursor = options.cursor
  let channel: ReturnType<typeof client.channel> | null = null
  let authTimer: number | undefined
  const clearChannel = () => { if (channel) void client.removeChannel(channel); channel = null }
  const refresh = async () => {
    if (stopped || document.visibilityState === 'hidden') return
    if (running) { queued = true; return }
    running = true
    const requestGeneration = generation
    try {
      const { data: { user }, error } = await client.auth.getUser()
      if (stopped || requestGeneration !== generation) return
      if (error) { options.onStatus('reconnecting'); return }
      if (user?.id !== options.viewerId) {
        stop()
        options.onAccountChange()
        return
      }
      // Server Actions can replace auth cookies without a browser auth event.
      // Refresh the SDK's cached realtime token from current cookie storage.
      await client.realtime.setAuth()
      if (stopped || requestGeneration !== generation) return
      if (!channel) {
        channel = client.channel('messages-' + options.viewerId + '-' + crypto.randomUUID())
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', ...(options.threadId ? { filter: 'thread_id=eq.' + options.threadId } : {}) }, () => { void refresh() })
        if (!options.threadId) channel = channel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_threads' }, () => { void refresh() })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_thread_reads', filter: 'profile_id=eq.' + options.viewerId }, () => { void refresh() })
        channel.subscribe(status => {
          if (stopped || requestGeneration !== generation) return
          if (status === 'SUBSCRIBED') { options.onStatus('connected'); void refresh() }
          else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) options.onStatus('reconnecting')
        })
      }
      if (!options.threadId) { options.onInbox?.(); return }
      // Bounded batches catch up from the last confirmed DB cursor; resume on a
      // later poll after 500 rows rather than monopolize a long-lived page.
      for (let batch = 0; batch < 5; batch++) {
        let query = client.from('direct_messages').select('id, thread_id, sender_id, body, created_at').eq('thread_id', options.threadId)
        if (cursor) query = query.or(`created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`)
        const { data, error: queryError } = await query.order('created_at', { ascending: true }).order('id', { ascending: true }).limit(100)
        if (stopped || requestGeneration !== generation) return
        if (queryError) { options.onStatus('reconnecting'); return }
        const messages = (data ?? []).filter(isMessage).filter(message => message.thread_id === options.threadId)
        if (messages.length) {
          const last = messages[messages.length - 1]
          cursor = { id: last.id, created_at: last.created_at }
          options.onMessages?.(messages)
        }
        if (messages.length < 100) break
      }
    } catch {
      if (!stopped && requestGeneration === generation) options.onStatus('reconnecting')
    } finally {
      running = false
      if (queued && !stopped) { queued = false; void refresh() }
    }
  }
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return
    generation++
    clearChannel()
    if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user.id !== options.viewerId)) {
      // Clear private UI immediately, before async verified-account comparison.
      stop()
      options.onAccountChange()
      return
    }
    options.onStatus('connecting')
    authTimer = window.setTimeout(() => { void refresh() }, 0)
  })
  const interval = window.setInterval(() => { void refresh() }, 15000)
  const onVisibility = () => { if (document.visibilityState === 'visible') void refresh() }
  const onOnline = () => { void refresh() }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', onOnline)
  function stop() {
    if (stopped) return
    stopped = true
    generation++
    subscription.unsubscribe()
    clearChannel()
    window.clearInterval(interval)
    if (authTimer !== undefined) window.clearTimeout(authTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('online', onOnline)
  }
  void refresh()
  return { stop, refresh }
}
