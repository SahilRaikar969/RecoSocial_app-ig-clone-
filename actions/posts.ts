'use server'

import { randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { isValidMediaUrl } from '@/lib/media/is-valid-media-url'

const MAX_CAPTION_LENGTH = 280
const MAX_IMAGE_FILE_SIZE = 15 * 1024 * 1024
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024
const MAX_THUMBNAIL_FILE_SIZE = 10 * 1024 * 1024

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const ACCEPTED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function getFileExtension(name: string) {
  return name.includes('.')
    ? name.split('.').pop()?.toLowerCase() || 'bin'
    : 'bin'
}

function isAcceptedMediaFile(file: File, mediaType: 'image' | 'video') {
  if (!file.type) return false

  if (mediaType === 'image') {
    return ACCEPTED_IMAGE_TYPES.has(file.type)
  }

  return ACCEPTED_VIDEO_TYPES.has(file.type)
}

function isAcceptedThumbnailFile(file: File) {
  return !!file.type && ACCEPTED_IMAGE_TYPES.has(file.type)
}

function isFileTooLarge(file: File, mediaType: 'image' | 'video') {
  if (mediaType === 'image') {
    return file.size > MAX_IMAGE_FILE_SIZE
  }

  return file.size > MAX_VIDEO_FILE_SIZE
}

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  const cleanReturnTo = returnTo.trim() || '/feed'
  const search = new URLSearchParams(params).toString()

  return search ? `${cleanReturnTo}?${search}` : cleanReturnTo
}

async function uploadToMediaBucket(
  file: File,
  folder: string,
  ownerId: string
) {
  const supabase = await createClient()

  const fileExt = getFileExtension(file.name)
  const safeName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, '')) || 'file'
  const filePath = `${folder}/${ownerId}/${Date.now()}-${randomUUID()}-${safeName}.${fileExt}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await supabase.storage
    .from('media')
    .upload(filePath, buffer, {
      contentType: file.type || undefined,
      upsert: false,
      cacheControl: '3600',
    })

  if (error) {
    throw new Error(error.message)
  }

  return filePath
}

export async function createPost(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  if (!profileId) {
    redirect('/create?error=missing_profile_id')
  }

  const caption = String(formData.get('caption') || '').trim()
  const mediaType = String(formData.get('media_type') || '').trim() as 'image' | 'video'
  const mediaPathInput = String(formData.get('media_path') || '').trim()
  const thumbnailPathInput = String(formData.get('thumbnail_path') || '').trim()

  const mediaFile = formData.get('media_file')
  const thumbnailFile = formData.get('thumbnail_file')

  const mediaUpload = mediaFile instanceof File && mediaFile.size > 0 ? mediaFile : null
  const thumbnailUpload =
    thumbnailFile instanceof File && thumbnailFile.size > 0 ? thumbnailFile : null

  const categoryNames = [
    ...new Set(
      formData
        .getAll('categories')
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ]

  if (caption.length > MAX_CAPTION_LENGTH) {
    redirect('/create?error=caption_too_long')
  }

  if (mediaType !== 'image' && mediaType !== 'video') {
    redirect('/create?error=invalid_media_type')
  }

  if (!mediaPathInput && !mediaUpload) {
    redirect('/create?error=media_source_required')
  }

  if (mediaUpload) {
    if (!isAcceptedMediaFile(mediaUpload, mediaType)) {
      redirect('/create?error=invalid_media_file_type')
    }

    if (isFileTooLarge(mediaUpload, mediaType)) {
      redirect('/create?error=media_file_too_large')
    }
  }

  let resolvedMediaPath = mediaPathInput

  if (mediaUpload) {
    try {
      resolvedMediaPath = await uploadToMediaBucket(
        mediaUpload,
        mediaType === 'video' ? 'videos' : 'images',
        profileId
      )
    } catch (error: any) {
      redirect(`/create?error=${encodeURIComponent(error?.message || 'media_upload_failed')}`)
    }
  } else if (!isValidMediaUrl(mediaPathInput)) {
    redirect('/create?error=invalid_media_url')
  }

  let resolvedThumbnailPath = thumbnailPathInput

  if (mediaType === 'video') {
    if (thumbnailUpload) {
      if (!isAcceptedThumbnailFile(thumbnailUpload)) {
        redirect('/create?error=invalid_thumbnail_file_type')
      }

      if (thumbnailUpload.size > MAX_THUMBNAIL_FILE_SIZE) {
        redirect('/create?error=thumbnail_file_too_large')
      }

      try {
        resolvedThumbnailPath = await uploadToMediaBucket(
          thumbnailUpload,
          'thumbnails',
          profileId
        )
      } catch (error: any) {
        redirect(`/create?error=${encodeURIComponent(error?.message || 'thumbnail_upload_failed')}`)
      }
    } else if (thumbnailPathInput && !isValidMediaUrl(thumbnailPathInput)) {
      redirect('/create?error=invalid_thumbnail_url')
    }
  }

  if (categoryNames.length === 0) {
    redirect('/create?error=no_categories_selected')
  }

  const { data: categoryRows, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .in('name', categoryNames)

  if (categoriesError) {
    redirect(`/create?error=${encodeURIComponent(categoriesError.message)}`)
  }

  if (!categoryRows || categoryRows.length === 0) {
    redirect('/create?error=categories_not_found')
  }

  if (categoryRows.length !== categoryNames.length) {
    redirect('/create?error=some_categories_not_found')
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      author_id: profileId,
      caption,
      media_type: mediaType,
      media_path: resolvedMediaPath,
      thumbnail_path: mediaType === 'video' ? resolvedThumbnailPath || null : null,
      status: 'published',
      visibility: 'public',
    })
    .select('id')
    .single()

  if (postError || !post) {
    redirect(`/create?error=${encodeURIComponent(postError?.message || 'post_create_failed')}`)
  }

  const postCategories = categoryRows.map((category) => ({
    post_id: post.id,
    category_id: category.id,
  }))

  const { error: postCategoriesError } = await supabase
    .from('post_categories')
    .insert(postCategories)

  if (postCategoriesError) {
    redirect(`/create?error=${encodeURIComponent(postCategoriesError.message)}`)
  }

  redirect('/feed?post_created=1')
}

export async function updatePost(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const postId = String(formData.get('post_id') || '').trim()
  const returnTo = String(formData.get('return_to') || `/post/${postId}`).trim()

  const caption = String(formData.get('caption') || '').trim()
  const mediaType = String(formData.get('media_type') || '').trim() as 'image' | 'video'
  const mediaPathInput = String(formData.get('media_path') || '').trim()
  const thumbnailPathInput = String(formData.get('thumbnail_path') || '').trim()

  const mediaFile = formData.get('media_file')
  const thumbnailFile = formData.get('thumbnail_file')

  const mediaUpload = mediaFile instanceof File && mediaFile.size > 0 ? mediaFile : null
  const thumbnailUpload =
    thumbnailFile instanceof File && thumbnailFile.size > 0 ? thumbnailFile : null

  const categoryNames = [
    ...new Set(
      formData
        .getAll('categories')
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ]

  if (!postId || !profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_post_update_ids' }))
  }

  if (caption.length > MAX_CAPTION_LENGTH) {
    redirect(buildRedirectUrl(returnTo, { error: 'caption_too_long' }))
  }

  if (mediaType !== 'image' && mediaType !== 'video') {
    redirect(buildRedirectUrl(returnTo, { error: 'invalid_media_type' }))
  }

  if (!mediaPathInput && !mediaUpload) {
    redirect(buildRedirectUrl(returnTo, { error: 'media_source_required' }))
  }

  const { data: postRow, error: postLookupError } = await supabase
    .from('posts')
    .select('id, author_id, media_type, thumbnail_path')
    .eq('id', postId)
    .maybeSingle()

  if (postLookupError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(postLookupError.message),
      })
    )
  }

  if (!postRow) {
    redirect(buildRedirectUrl(returnTo, { error: 'post_not_found' }))
  }

  if (postRow.author_id !== profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'not_post_owner' }))
  }

  if (mediaUpload) {
    if (!isAcceptedMediaFile(mediaUpload, mediaType)) {
      redirect(buildRedirectUrl(returnTo, { error: 'invalid_media_file_type' }))
    }

    if (isFileTooLarge(mediaUpload, mediaType)) {
      redirect(buildRedirectUrl(returnTo, { error: 'media_file_too_large' }))
    }
  }

  let resolvedMediaPath = mediaPathInput

  if (mediaUpload) {
    try {
      resolvedMediaPath = await uploadToMediaBucket(
        mediaUpload,
        mediaType === 'video' ? 'videos' : 'images',
        profileId
      )
    } catch (error: any) {
      redirect(
        buildRedirectUrl(returnTo, {
          error: encodeURIComponent(error?.message || 'media_upload_failed'),
        })
      )
    }
  } else if (!isValidMediaUrl(mediaPathInput)) {
    redirect(buildRedirectUrl(returnTo, { error: 'invalid_media_url' }))
  }

  let resolvedThumbnailPath =
    thumbnailPathInput || String(postRow.thumbnail_path || '').trim()

  if (mediaType === 'video') {
    if (thumbnailUpload) {
      if (!isAcceptedThumbnailFile(thumbnailUpload)) {
        redirect(buildRedirectUrl(returnTo, { error: 'invalid_thumbnail_file_type' }))
      }

      if (thumbnailUpload.size > MAX_THUMBNAIL_FILE_SIZE) {
        redirect(buildRedirectUrl(returnTo, { error: 'thumbnail_file_too_large' }))
      }

      try {
        resolvedThumbnailPath = await uploadToMediaBucket(
          thumbnailUpload,
          'thumbnails',
          profileId
        )
      } catch (error: any) {
        redirect(
          buildRedirectUrl(returnTo, {
            error: encodeURIComponent(error?.message || 'thumbnail_upload_failed'),
          })
        )
      }
    } else if (thumbnailPathInput && !isValidMediaUrl(thumbnailPathInput)) {
      redirect(buildRedirectUrl(returnTo, { error: 'invalid_thumbnail_url' }))
    }
  } else {
    resolvedThumbnailPath = ''
  }

  if (categoryNames.length === 0) {
    redirect(buildRedirectUrl(returnTo, { error: 'no_categories_selected' }))
  }

  const { data: categoryRows, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .in('name', categoryNames)

  if (categoriesError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(categoriesError.message),
      })
    )
  }

  if (!categoryRows || categoryRows.length === 0) {
    redirect(buildRedirectUrl(returnTo, { error: 'categories_not_found' }))
  }

  if (categoryRows.length !== categoryNames.length) {
    redirect(buildRedirectUrl(returnTo, { error: 'some_categories_not_found' }))
  }

  const { error: updateError } = await supabase
    .from('posts')
    .update({
      caption,
      media_type: mediaType,
      media_path: resolvedMediaPath,
      thumbnail_path: mediaType === 'video' ? resolvedThumbnailPath || null : null,
    })
    .eq('id', postId)
    .eq('author_id', profileId)

  if (updateError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(updateError.message),
      })
    )
  }

  const { error: clearCategoriesError } = await supabase
    .from('post_categories')
    .delete()
    .eq('post_id', postId)

  if (clearCategoriesError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(clearCategoriesError.message),
      })
    )
  }

  const postCategories = categoryRows.map((category) => ({
    post_id: postId,
    category_id: category.id,
  }))

  const { error: postCategoriesError } = await supabase
    .from('post_categories')
    .insert(postCategories)

  if (postCategoriesError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(postCategoriesError.message),
      })
    )
  }

  redirect(`/post/${postId}?updated=1`)
}

export async function deletePost(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const postId = String(formData.get('post_id') || '').trim()
  const returnTo = String(formData.get('return_to') || '/profile').trim()

  if (!postId || !profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_post_delete_ids' }))
  }

  const { data: postRow, error: postLookupError } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', postId)
    .maybeSingle()

  if (postLookupError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(postLookupError.message),
      })
    )
  }

  if (!postRow) {
    redirect(buildRedirectUrl(returnTo, { error: 'post_not_found' }))
  }

  if (postRow.author_id !== profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'not_post_owner' }))
  }

  await supabase.from('notifications').delete().eq('post_id', postId)
  await supabase.from('post_reports').delete().eq('post_id', postId)
  await supabase.from('hidden_posts').delete().eq('post_id', postId)
  await supabase.from('likes').delete().eq('post_id', postId)
  await supabase.from('saves').delete().eq('post_id', postId)
  await supabase.from('comments').delete().eq('post_id', postId)
  await supabase.from('post_categories').delete().eq('post_id', postId)

  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', profileId)

  if (deleteError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(deleteError.message),
      })
    )
  }

  redirect(buildRedirectUrl(returnTo, { deleted: '1' }))
}