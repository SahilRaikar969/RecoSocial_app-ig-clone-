'use server'

import { redirect } from 'next/navigation'
import { buildReturnUrl } from '@/lib/routes/safe-return-path'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { areMutualFollowers, getOrCreateDirectThread } from '@/lib/db/queries/messages'

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  return buildReturnUrl(returnTo, params, '/messages')
}

export async function startConversation(formData: FormData) {
  const { profileId } = await getDevSession()
  const otherProfileId = String(formData.get('other_profile_id') || '').trim()

  if (!profileId || !otherProfileId) {
    redirect('/messages?error=missing_message_profile_id')
  }

  const thread = await getOrCreateDirectThread(profileId, otherProfileId)

  if (!thread) {
    redirect('/messages?error=mutual_follow_required')
  }

  redirect(`/messages/${thread.id}`)
}

export async function sendDirectMessage(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const threadId = String(formData.get('thread_id') || '').trim()
  const returnTo = String(formData.get('return_to') || `/messages/${threadId}`).trim()
  const body = String(formData.get('body') || '').trim()

  if (!threadId || !profileId || !body) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_message_fields' }))
  }

  if (body.length > 1200) {
    redirect(buildRedirectUrl(returnTo, { error: 'message_too_long' }))
  }

  const { data: thread, error: threadError } = await supabase
    .from('direct_threads')
    .select('id, profile_low_id, profile_high_id')
    .eq('id', threadId)
    .maybeSingle()

  if (threadError) {
    redirect(buildRedirectUrl(returnTo, { error: encodeURIComponent(threadError.message) }))
  }

  if (!thread) {
    redirect(buildRedirectUrl(returnTo, { error: 'thread_not_found' }))
  }

  if (thread.profile_low_id !== profileId && thread.profile_high_id !== profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'thread_access_denied' }))
  }

  const otherProfileId =
    thread.profile_low_id === profileId ? thread.profile_high_id : thread.profile_low_id

  const mutual = await areMutualFollowers(profileId, otherProfileId)

  if (!mutual) {
    redirect(buildRedirectUrl(returnTo, { error: 'mutual_follow_required' }))
  }

  const { error: messageError } = await supabase
    .from('direct_messages')
    .insert({
      thread_id: threadId,
      sender_id: profileId,
      body,
    })

  if (messageError) {
    redirect(buildRedirectUrl(returnTo, { error: encodeURIComponent(messageError.message) }))
  }

  redirect(buildRedirectUrl(returnTo, { sent: '1' }))
}
