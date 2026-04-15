'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'

type ToggleSaveInlineInput = {
  postId: string
  devProfileId: string
  saved: boolean
  returnTo?: string
}

type ToggleSaveInlineResult =
  | { ok: true; saved: boolean }
  | { ok: false; error: string }

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  const cleanReturnTo = returnTo.trim() || '/feed'
  const search = new URLSearchParams(params).toString()

  return search ? `${cleanReturnTo}?${search}` : cleanReturnTo
}

async function revalidateSaveSurfaces(postId: string) {
  revalidatePath('/feed')
  revalidatePath('/explore')
  revalidatePath('/saved')
  revalidatePath('/profile')
  revalidatePath(`/post/${postId}`)
}

async function performSaveToggle(
  postId: string,
  saved: boolean
): Promise<ToggleSaveInlineResult> {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  if (!postId) {
    return { ok: false, error: 'missing_post_id' }
  }

  if (!profileId) {
    return { ok: false, error: 'missing_dev_profile_id' }
  }

  if (saved) {
    const { error } = await supabase
      .from('saves')
      .delete()
      .eq('post_id', postId)
      .eq('profile_id', profileId)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, saved: false }
  }

  const { error } = await supabase
    .from('saves')
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

  return { ok: true, saved: true }
}

export async function toggleSaveInline(
  input: ToggleSaveInlineInput
): Promise<ToggleSaveInlineResult> {
  const result = await performSaveToggle(
    String(input.postId || '').trim(),
    Boolean(input.saved)
  )

  if (result.ok) {
    await revalidateSaveSurfaces(String(input.postId || '').trim())
  }

  return result
}

export async function toggleSave(formData: FormData) {
  const postId = String(formData.get('post_id') || '').trim()
  const saved = String(formData.get('saved') || '').trim() === 'true'
  const returnTo = String(formData.get('return_to') || '/feed').trim()

  const result = await performSaveToggle(postId, saved)

  if (!result.ok) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(result.error),
      })
    )
  }

  await revalidateSaveSurfaces(postId)

  redirect(
    buildRedirectUrl(returnTo, {
      saved: result.saved ? 'added' : 'removed',
    })
  )
}