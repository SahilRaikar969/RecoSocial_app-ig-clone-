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

const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

const ACCEPTED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp',
  'video/3gpp2',
  'video/ogg',
])

const ACCEPTED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
])

const ACCEPTED_VIDEO_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'm4v',
  '3gp',
  '3g2',
  'ogv',
  'ogg',
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

function hasAcceptedTypeOrExtension(
  file: File,
  mimeTypes: Set<string>,
  extensions: Set<string>
) {
  const type = String(file.type || '').toLowerCase().trim()
  const extension = getFileExtension(file.name)

  if (type && mimeTypes.has(type)) {
    return true
  }

  return extensions.has(extension)
}

function isHeicLikeFile(file: File) {
  const type = String(file.type || '').toLowerCase().trim()
  const extension = getFileExtension(file.name)

  return (
    type.includes('heic') ||
    type.includes('heif') ||
    extension === 'heic' ||
    extension === 'heif'
  )
}

function isAcceptedMediaFile(file: File, mediaType: 'image' | 'video') {
  if (mediaType === 'image') {
    return hasAcceptedTypeOrExtension(
      file,
      ACCEPTED_IMAGE_MIME_TYPES,
      ACCEPTED_IMAGE_EXTENSIONS
    )
  }

  return hasAcceptedTypeOrExtension(
    file,
    ACCEPTED_VIDEO_MIME_TYPES,
    ACCEPTED_VIDEO_EXTENSIONS
  )
}

function isAcceptedThumbnailFile(file: File) {
  return hasAcceptedTypeOrExtension(
    file,
    ACCEPTED_IMAGE_MIME_TYPES,
    ACCEPTED_IMAGE_EXTENSIONS
  )
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

async function uploadToMediaBucket(file: File, folder: string, ownerId: string) {
  const supabase = await createClient()

  const fileExt = getFileExtension(file.name)
  const safeName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, '')) || 'file'
  const filePath = `${folder}/${ownerId}/${Date.now()}-${randomUUID()}-${safeName}.${fileExt}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await supabase.storage.from('media').upload(filePath, buffer, {
    contentType: file.type || undefined,
    upsert: false,
    cacheControl: '3600',
  })

  if (error) {
    throw new Error(error.message)
  }

  return filePath
}

function normalizeCategoryNames(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll('categories')
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ]
}

function getUploads(formData: FormData) {
  const mediaFile = formData.get('media_file')
  const thumbnailFile = formData.get('thumbnail_file')

  const mediaUpload = mediaFile instanceof File && mediaFile.size > 0 ? mediaFile : null
  const thumbnailUpload =
    thumbnailFile instanceof File && thumbnailFile.size > 0 ? thumbnailFile : null

  return { mediaUpload, thumbnailUpload }
}

async function resolveCategoryRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryNames: string[],
  returnToOnError: string
) {
  if (categoryNames.length === 0) {
    redirect(buildRedirectUrl(returnToOnError, { error: 'no_categories_selected' }))
  }

  const { data: categoryRows, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .in('name', categoryNames)

  if (categoriesError) {
    redirect(
      buildRedirectUrl(returnToOnError, {
        error: encodeURIComponent(categoriesError.message),
      })
    )
  }

  if (!categoryRows || categoryRows.length === 0) {
    redirect(buildRedirectUrl(returnToOnError, { error: 'categories_not_found' }))
  }

  if (categoryRows.length !== categoryNames.length) {
    redirect(buildRedirectUrl(returnToOnError, { error: 'some_categories_not_found' }))
  }

  return categoryRows
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
  const { mediaUpload, thumbnailUpload } = getUploads(formData)
  const categoryNames = normalizeCategoryNames(formData)

  if (caption.length > MAX_CAPTION_LENGTH) {
    redirect('/create?error=caption_too_long')
  }

  if (mediaType !== 'image' && mediaType !== 'video') {
    redirect('/create?error=invalid_media_type')
  }

  if (!mediaPathInput && !mediaUpload) {
    redirect('/create?error=media_source_required')
  }

  if (mediaUpload && isHeicLikeFile(mediaUpload)) {
    redirect('/create?error=heic_not_supported')
  }

  if (thumbnailUpload && isHeicLikeFile(thumbnailUpload)) {
    redirect('/create?error=thumbnail_heic_not_supported')
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
        redirect(
          `/create?error=${encodeURIComponent(error?.message || 'thumbnail_upload_failed')}`
        )
      }
    } else if (thumbnailPathInput && !isValidMediaUrl(thumbnailPathInput)) {
      redirect('/create?error=invalid_thumbnail_url')
    }
  } else {
    resolvedThumbnailPath = ''
  }

  const categoryRows = await resolveCategoryRows(supabase, categoryNames, '/create')

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

  const { mediaUpload, thumbnailUpload } = getUploads(formData)
  const categoryNames = normalizeCategoryNames(formData)

  if (!postId || !profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_post_update_ids' }))
  }

  if (caption.length > MAX_CAPTION_LENGTH) {
    redirect(buildRedirectUrl(returnTo, { error: 'caption_too_long' }))
  }

  if (mediaType !== 'image' && mediaType !== 'video') {
    redirect(buildRedirectUrl(returnTo, { error: 'invalid_media_type' }))
  }

  const { data: postRow, error: postLookupError } = await supabase
    .from('posts')
    .select('id, author_id, media_type, thumbnail_path')
    .eq('id', postId)
    .maybeSingle()

  if (postLookupError) {
    redirect(buildRedirectUrl(returnTo, { error: encodeURIComponent(postLookupError.message) }))
  }

  if (!postRow || postRow.author_id !== profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'post_not_found' }))
  }

  if (!mediaPathInput && !mediaUpload) {
    redirect(buildRedirectUrl(returnTo, { error: 'media_source_required' }))
  }

  if (mediaUpload && isHeicLikeFile(mediaUpload)) {
    redirect(buildRedirectUrl(returnTo, { error: 'heic_not_supported' }))
  }

  if (thumbnailUpload && isHeicLikeFile(thumbnailUpload)) {
    redirect(buildRedirectUrl(returnTo, { error: 'thumbnail_heic_not_supported' }))
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

  const categoryRows = await resolveCategoryRows(supabase, categoryNames, returnTo)

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
    redirect(buildRedirectUrl(returnTo, { error: encodeURIComponent(updateError.message) }))
  }

  const { error: deleteCategoryError } = await supabase
    .from('post_categories')
    .delete()
    .eq('post_id', postId)

  if (deleteCategoryError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(deleteCategoryError.message),
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

  redirect(buildRedirectUrl(returnTo, { post_updated: '1' }))
}