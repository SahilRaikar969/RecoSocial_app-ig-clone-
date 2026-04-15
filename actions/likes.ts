'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'

type ToggleLikeInlineInput = {
  postId: string
  devProfileId: string
  liked: boolean
  returnTo?: string
}

type ToggleLikeInlineResult =
  | { ok: true; liked: boolean }
  | { ok: false; error: string }

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  const cleanReturnTo = returnTo.trim() || '/feed'
  const search = new URLSearchParams(params).toString()

  return search ? `${cleanReturnTo}?${search}` : cleanReturnTo
}

async function revalidateLikeSurfaces(postId: string) {
  revalidatePath('/feed')
  revalidatePath('/explore')
  revalidatePath('/saved')
  revalidatePath('/profile')
  revalidatePath('/activity')
  revalidatePath(`/post/${postId}`)
}

async function performLikeToggle(
  postId: string,
  liked: boolean
): Promise<ToggleLikeInlineResult> {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  if (!postId || !profileId) {
    return { ok: false, error: 'missing_like_ids' }
  }

  const { data: postRow, error: postLookupError } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', postId)
    .maybeSingle()

  if (postLookupError) {
    return { ok: false, error: postLookupError.message }
  }

  if (!postRow) {
    return { ok: false, error: 'post_not_found' }
  }

  if (liked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('profile_id', profileId)

    if (error) {
      return { ok: false, error: error.message }
    }

    const { error: notificationDeleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', postRow.author_id)
      .eq('actor_id', profileId)
      .eq('post_id', postId)
      .eq('type', 'like')

    if (notificationDeleteError) {
      return { ok: false, error: notificationDeleteError.message }
    }

    return { ok: true, liked: false }
  }

  const { error } = await supabase
    .from('likes')
    .upsert(
      {
        post_id: postId,
        profile_id: profileId,
      },
      {
        onConflict: 'profile_id,post_id',
      }
    )

  if (error) {
    return { ok: false, error: error.message }
  }

  if (postRow.author_id !== profileId) {
    const { error: notificationInsertError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: postRow.author_id,
        actor_id: profileId,
        post_id: postId,
        type: 'like',
        comment_id: null,
        read_at: null,
      })

    if (notificationInsertError && notificationInsertError.code !== '23505') {
      return { ok: false, error: notificationInsertError.message }
    }
  }

  return { ok: true, liked: true }
}

export async function toggleLikeInline(
  input: ToggleLikeInlineInput
): Promise<ToggleLikeInlineResult> {
  const result = await performLikeToggle(
    String(input.postId || '').trim(),
    Boolean(input.liked)
  )

  if (result.ok) {
    await revalidateLikeSurfaces(String(input.postId || '').trim())
  }

  return result
}

export async function toggleLike(formData: FormData) {
  const postId = String(formData.get('post_id') || '').trim()
  const liked = String(formData.get('liked') || '').trim() === 'true'
  const returnTo = String(formData.get('return_to') || '/feed').trim()

  const result = await performLikeToggle(postId, liked)

  if (!result.ok) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(result.error),
      })
    )
  }

  await revalidateLikeSurfaces(postId)

  redirect(
    buildRedirectUrl(returnTo, {
      liked: result.liked ? 'added' : 'removed',
    })
  )
}