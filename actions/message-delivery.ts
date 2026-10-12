'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { areMutualFollowers } from '@/lib/db/queries/messages'
import type { ThreadMessage } from '@/lib/messages/message-state'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const columns = 'id, thread_id, sender_id, body, created_at'

export async function sendMessage(input: { id: string; threadId: string; body: string }): Promise<{ message?: ThreadMessage; error?: string }> {
  const { profileId } = await requireSession()
  if (!uuid.test(input?.id ?? '') || !uuid.test(input?.threadId ?? '') || typeof input?.body !== 'string') return { error: 'Invalid message.' }
  const body = input.body.trim()
  if (!body || body.length > 1200) return { error: 'Use between 1 and 1,200 characters.' }
  const client = await createClient()
  try {
    const { data: thread, error: threadError } = await client.from('direct_threads')
      .select('id, profile_low_id, profile_high_id').eq('id', input.threadId).maybeSingle()
    if (threadError || !thread || ![thread.profile_low_id, thread.profile_high_id].includes(profileId)) return { error: 'Conversation unavailable.' }

    // Check replay before mutual follows: an acknowledged send remains a success
    // if the relationship changed while its response was lost.
    const { data: existing, error: existingError } = await client.from('direct_messages').select(columns).eq('id', input.id).maybeSingle()
    if (existingError) return { error: 'Could not confirm delivery. Retry to check again.' }
    if (existing) return existing.thread_id === input.threadId && existing.sender_id === profileId && existing.body === body
      ? { message: existing } : { error: 'This message request conflicts with another message.' }

    const other = thread.profile_low_id === profileId ? thread.profile_high_id : thread.profile_low_id
    if (!await areMutualFollowers(profileId, other)) return { error: 'You must follow each other to send messages.' }
    const { data, error } = await client.from('direct_messages').insert({ id: input.id, thread_id: input.threadId, sender_id: profileId, body }).select(columns).single()
    if (!error && data) return { message: data }
    if (error?.code === '23505') {
      const { data: replay, error: replayError } = await client.from('direct_messages').select(columns).eq('id', input.id).maybeSingle()
      if (!replayError && replay?.thread_id === input.threadId && replay.sender_id === profileId && replay.body === body) return { message: replay }
    }
    return { error: 'Delivery could not be confirmed. Retry this message safely.' }
  } catch {
    return { error: 'Connection interrupted. Retry this message safely.' }
  }
}

export async function loadOlderMessages(threadId: string, cursor: { id: string; created_at: string }) {
  const { profileId } = await requireSession()
  if (!uuid.test(threadId) || !uuid.test(cursor?.id ?? '') || !Number.isFinite(Date.parse(cursor?.created_at))) return { error: 'Invalid message cursor.' }
  const client = await createClient()
  const { data: thread } = await client.from('direct_threads').select('profile_low_id, profile_high_id').eq('id', threadId).maybeSingle()
  if (!thread || ![thread.profile_low_id, thread.profile_high_id].includes(profileId)) return { error: 'Conversation unavailable.' }
  // Use the database timestamp, not a caller-provided value, for cursor ordering.
  const { data: anchor } = await client.from('direct_messages').select('id, created_at').eq('id', cursor.id).eq('thread_id', threadId).maybeSingle()
  if (!anchor) return { error: 'Message no longer available.' }
  const { data, error } = await client.from('direct_messages').select(columns).eq('thread_id', threadId)
    .or(`created_at.lt.${anchor.created_at},and(created_at.eq.${anchor.created_at},id.lt.${anchor.id})`)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(51)
  if (error) return { error: 'Older messages could not be loaded. Try again.' }
  return { messages: (data ?? []).slice(0, 50).reverse(), hasOlder: (data?.length ?? 0) > 50 }
}

export async function markThreadRead(threadId: string, messageId: string) {
  await requireSession()
  if (!uuid.test(threadId) || !uuid.test(messageId)) return { ok: false }
  const client = await createClient()
  const { error } = await client.rpc('mark_direct_thread_read', { p_thread_id: threadId, p_message_id: messageId })
  return { ok: !error }
}
