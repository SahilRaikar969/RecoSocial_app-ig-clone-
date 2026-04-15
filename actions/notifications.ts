'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  const cleanReturnTo = returnTo.trim() || '/activity'
  const search = new URLSearchParams(params).toString()
  return search ? `${cleanReturnTo}?${search}` : cleanReturnTo
}

export async function markNotificationsRead() {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', profileId)
    .is('read_at', null)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/activity')
}

export async function markNotificationReadAndRedirect(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const notificationId = String(formData.get('notification_id') || '').trim()
  const targetHref = String(formData.get('target_href') || '/activity').trim()
  const returnTo = String(formData.get('return_to') || '/activity').trim()

  if (!notificationId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_notification_id' }))
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('recipient_id', profileId)
    .is('read_at', null)

  if (error) {
    redirect(buildRedirectUrl(returnTo, { error: encodeURIComponent(error.message) }))
  }

  revalidatePath('/activity')
  redirect(targetHref || '/activity')
}