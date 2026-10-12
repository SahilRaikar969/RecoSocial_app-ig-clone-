'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { buildReturnUrl } from '@/lib/routes/safe-return-path'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import type { MutationResult } from '@/lib/mutations/result'

type CreateCommentInlineInput = {
  postId: string
  profileId: string
  body: string
  returnTo?: string
}

type InlineCommentAuthor = {
  id?: string | null
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
}

type InlineComment = {
  id: string
  author_id: string
  body: string
  created_at: string
  author?: InlineCommentAuthor | null
}

type CreateCommentInlineResult = MutationResult<{ comment: InlineComment }>

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  return buildReturnUrl(returnTo, params, '/feed')
}

async function revalidateCommentSurfaces(postId: string) {
  revalidatePath('/feed')
  revalidatePath('/explore')
  revalidatePath('/saved')
  revalidatePath('/profile')
  revalidatePath('/activity')
  revalidatePath(`/post/${postId}`)
  revalidatePath(`/reel/${postId}`)
}

async function performCreateComment(
  postId: string,
  body: string
): Promise<CreateCommentInlineResult> {
  const { profileId } = await requireSession()

  try {
    const supabase = await createClient()
    if (!postId || !profileId) {
      return { ok: false, error: 'missing_comment_ids' }
    }

    const trimmedBody = body.trim()

    if (!trimmedBody) {
      return { ok: false, error: 'comment_body_required' }
    }

    if (trimmedBody.length > 280) {
      return { ok: false, error: 'comment_too_long' }
    }

    const { data: postRow, error: postLookupError } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .maybeSingle()

    if (postLookupError) {
      return { ok: false, error: 'comment_failed' }
    }

    if (!postRow) {
      return { ok: false, error: 'post_not_found' }
    }

    const { data: insertedComment, error: insertError } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        author_id: profileId,
        body: trimmedBody,
      })
      .select('id, author_id, body, created_at')
      .single()

    if (insertError || !insertedComment) {
      return { ok: false, error: 'comment_insert_failed' }
    }

    // The comment is committed. Optional display enrichment must not turn a
    // successful insert into a failure that invites the user to post it twice.
    let authorProfile: InlineCommentAuthor | null = null
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', profileId)
        .maybeSingle()
      authorProfile = data
    } catch {
      // The next server refresh can supply the author presentation.
    }

    return {
      ok: true,
      comment: {
        id: insertedComment.id,
        author_id: insertedComment.author_id,
        body: insertedComment.body,
        created_at: insertedComment.created_at,
        author: authorProfile || null,
      },
    }
  } catch {
    return { ok: false, error: 'comment_unconfirmed' }
  }
}

export async function createCommentInline(
  input: CreateCommentInlineInput
): Promise<CreateCommentInlineResult> {
  const postId = String(input.postId || '').trim()
  const body = String(input.body || '').trim()

  const result = await performCreateComment(postId, body)

  if (result.ok) {
    await revalidateCommentSurfaces(postId)
  }

  return result
}

export async function createComment(formData: FormData) {
  const postId = String(formData.get('post_id') || '').trim()
  const body = String(formData.get('body') || '').trim()
  const returnTo = String(formData.get('return_to') || `/post/${postId}`).trim()

  const result = await performCreateComment(postId, body)

  if (!result.ok) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(result.error),
      })
    )
  }

  await revalidateCommentSurfaces(postId)

  redirect(
    buildRedirectUrl(returnTo, {
      comment: 'added',
    })
  )
}

export async function deleteCommentByOwner(formData: FormData) {
  const commentId = String(formData.get('comment_id') || '').trim()
  const postId = String(formData.get('post_id') || '').trim()
  const returnTo = String(formData.get('return_to') || '/feed').trim()

  const { profileId } = await requireSession()

  if (!commentId || !postId || !profileId) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent('missing_comment_delete_ids'),
      })
    )
  }

  const supabase = await createClient()

  const { data: commentRow, error: commentLookupError } = await supabase
    .from('comments')
    .select('id, post_id')
    .eq('id', commentId)
    .eq('post_id', postId)
    .maybeSingle()

  if (commentLookupError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: 'comment_delete_failed',
      })
    )
  }

  if (!commentRow) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent('comment_not_found'),
      })
    )
  }

  const { data: postRow, error: postLookupError } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', postId)
    .maybeSingle()

  if (postLookupError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: 'comment_delete_failed',
      })
    )
  }

  if (!postRow) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent('post_not_found'),
      })
    )
  }

  if (postRow.author_id !== profileId) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent('not_post_owner'),
      })
    )
  }

  const { error: deleteError } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('post_id', postId)

  if (deleteError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: 'comment_delete_failed',
      })
    )
  }

  await revalidateCommentSurfaces(postId)

  redirect(
    buildRedirectUrl(returnTo, {
      comment_deleted: '1',
    })
  )
}