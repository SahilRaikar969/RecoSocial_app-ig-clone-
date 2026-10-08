'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { buildReturnUrl } from '@/lib/routes/safe-return-path'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'
import type { MutationResult } from '@/lib/mutations/result'

type ToggleLikeInlineInput = {
  postId: string
  devProfileId: string
  liked: boolean
  returnTo?: string
}

type ToggleLikeInlineResult = MutationResult<{ liked: boolean }>

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  return buildReturnUrl(returnTo, params, '/feed')
}

async function revalidateLikeSurfaces(postId: string) {
  revalidatePath('/feed')
  revalidatePath('/explore')
  revalidatePath('/saved')
  revalidatePath('/profile')
  revalidatePath('/activity')
  revalidatePath(`/post/${postId}`)
  revalidatePath(`/reel/${postId}`)
}

async function performLikeToggle(
  postId: string,
  liked: boolean
): Promise<ToggleLikeInlineResult> {
  const { profileId } = await getDevSession()

  try {
    const supabase = await createClient()
    if (!postId || !profileId) {
      return { ok: false, error: 'missing_like_ids' }
    }

    const { data: postRow, error: postLookupError } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .maybeSingle()

    if (postLookupError) {
      return { ok: false, error: 'like_failed' }
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
        return { ok: false, error: 'like_failed' }
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
          ignoreDuplicates: true,
        }
      )

    if (error) {
      return { ok: false, error: 'like_failed' }
    }

    return { ok: true, liked: true }
  } catch {
    return { ok: false, error: 'like_unconfirmed' }
  }
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