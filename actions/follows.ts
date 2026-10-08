'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { buildReturnUrl } from '@/lib/routes/safe-return-path'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'

type ToggleFollowInlineInput = {
  followerId: string
  followingId: string
  followedByMe: boolean
  returnTo?: string
}

type ToggleFollowInlineResult =
  | { ok: true; followedByMe: boolean }
  | { ok: false; error: string }

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  return buildReturnUrl(returnTo, params, '/feed')
}

async function revalidateFollowSurfaces(followerId: string, followingId: string) {
  revalidatePath('/feed')
  revalidatePath('/explore')
  revalidatePath('/activity')
  revalidatePath('/profile')
  revalidatePath('/profile/followers')
  revalidatePath('/profile/following')
  revalidatePath(`/profile/${followingId}`)
  revalidatePath(`/profile/${followingId}/followers`)
  revalidatePath(`/profile/${followingId}/following`)
  if (followerId) {
    revalidatePath(`/profile/${followerId}`)
    revalidatePath(`/profile/${followerId}/followers`)
    revalidatePath(`/profile/${followerId}/following`)
  }
}

async function performFollowToggle(
  followingId: string,
  followedByMe: boolean
): Promise<ToggleFollowInlineResult & { followerId?: string }> {
  const supabase = await createClient()
  const { profileId: followerId } = await getDevSession()

  if (!followerId || !followingId) {
    return { ok: false, error: 'missing_follow_ids' }
  }

  if (followerId === followingId) {
    return { ok: false, error: 'cannot_follow_self' }
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', followingId)
    .maybeSingle()

  if (targetProfileError) {
    return { ok: false, error: targetProfileError.message }
  }

  if (!targetProfile) {
    return { ok: false, error: 'profile_not_found' }
  }

  if (followedByMe) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, followedByMe: false, followerId }
  }

  const { error } = await supabase
    .from('follows')
    .upsert(
      {
        follower_id: followerId,
        following_id: followingId,
      },
      {
        onConflict: 'follower_id,following_id',
      }
    )

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, followedByMe: true, followerId }
}

export async function toggleFollowInline(
  input: ToggleFollowInlineInput
): Promise<ToggleFollowInlineResult> {
  const followingId = String(input.followingId || '').trim()

  const result = await performFollowToggle(
    followingId,
    Boolean(input.followedByMe)
  )

  if (result.ok) {
    await revalidateFollowSurfaces(String(result.followerId || ''), followingId)
    return { ok: true, followedByMe: result.followedByMe }
  }

  return { ok: false, error: result.error }
}

export async function toggleFollow(formData: FormData) {
  const followingId = String(formData.get('following_id') || '').trim()
  const followedByMe =
    String(formData.get('followed_by_me') || formData.get('followed') || '').trim() === 'true'
  const returnTo = String(formData.get('return_to') || '/feed').trim()

  const result = await performFollowToggle(followingId, followedByMe)

  if (!result.ok) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(result.error),
      })
    )
  }

  await revalidateFollowSurfaces(String(result.followerId || ''), followingId)

  redirect(
    buildRedirectUrl(returnTo, {
      follow: result.followedByMe ? 'added' : 'removed',
    })
  )
}