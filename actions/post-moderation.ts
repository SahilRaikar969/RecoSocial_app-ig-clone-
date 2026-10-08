'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { buildReturnUrl } from '@/lib/routes/safe-return-path'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'

const ALLOWED_REPORT_REASONS = new Set([
  'spam',
  'harassment',
  'nsfw',
  'misinformation',
  'other',
])

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  return buildReturnUrl(returnTo, params, '/feed')
}

export async function hidePost(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const postId = String(formData.get('post_id') || '').trim()
  const returnTo = String(formData.get('return_to') || '/feed').trim()

  if (!postId || !profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_hide_ids' }))
  }

  const { data: postRow, error: postLookupError } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', postId)
    .maybeSingle()

  if (postLookupError) {
    redirect(buildRedirectUrl(returnTo, { error: 'moderation_failed' }))
  }

  if (!postRow) {
    redirect(buildRedirectUrl(returnTo, { error: 'post_not_found' }))
  }

  if (postRow.author_id === profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'cannot_hide_own_post' }))
  }

  const { error } = await supabase
    .from('hidden_posts')
    .upsert(
      {
        profile_id: profileId,
        post_id: postId,
      },
      {
        onConflict: 'profile_id,post_id',
        ignoreDuplicates: true,
      }
    )

  if (error) {
    redirect(buildRedirectUrl(returnTo, { error: 'moderation_failed' }))
  }

  revalidatePath('/feed')
  revalidatePath('/explore')
  revalidatePath('/profile')
  revalidatePath(`/post/${postId}`)
  revalidatePath(`/reel/${postId}`)
  redirect(buildRedirectUrl(returnTo, { hidden: '1' }))
}

export async function unhidePost(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const postId = String(formData.get('post_id') || '').trim()
  const returnTo = String(formData.get('return_to') || '/profile?tab=hidden').trim()

  if (!postId || !profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_unhide_ids' }))
  }

  const { error } = await supabase
    .from('hidden_posts')
    .delete()
    .eq('profile_id', profileId)
    .eq('post_id', postId)

  if (error) {
    redirect(buildRedirectUrl(returnTo, { error: 'moderation_failed' }))
  }

  revalidatePath('/feed')
  revalidatePath('/explore')
  revalidatePath('/profile')
  revalidatePath(`/post/${postId}`)
  revalidatePath(`/reel/${postId}`)
  redirect(buildRedirectUrl(returnTo, { unhidden: '1' }))
}

export async function reportPost(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const postId = String(formData.get('post_id') || '').trim()
  const rawReason = String(formData.get('reason') || '').trim().toLowerCase()
  const reason = ALLOWED_REPORT_REASONS.has(rawReason) ? rawReason : 'other'
  const details = String(formData.get('details') || '').trim()
  const returnTo = String(formData.get('return_to') || '/feed').trim()

  if (!postId || !profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_report_ids' }))
  }

  const { data: postRow, error: postLookupError } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', postId)
    .maybeSingle()

  if (postLookupError) {
    redirect(buildRedirectUrl(returnTo, { error: 'moderation_failed' }))
  }

  if (!postRow) {
    redirect(buildRedirectUrl(returnTo, { error: 'post_not_found' }))
  }

  if (postRow.author_id === profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'cannot_report_own_post' }))
  }

  const { error } = await supabase
    .from('post_reports')
    .upsert(
      {
        reporter_id: profileId,
        post_id: postId,
        reason,
        details: details || null,
      },
      {
        onConflict: 'reporter_id,post_id',
      }
    )

  if (error) {
    redirect(buildRedirectUrl(returnTo, { error: 'moderation_failed' }))
  }

  revalidatePath('/feed')
  revalidatePath('/explore')
  revalidatePath('/profile')
  revalidatePath(`/post/${postId}`)
  revalidatePath(`/reel/${postId}`)
  redirect(buildRedirectUrl(returnTo, { reported: '1' }))
}