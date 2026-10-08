'use server'

import { randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertMediaUpload, isOwnedMediaPath } from '@/lib/media/upload-validation'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { isValidMediaUrl } from '@/lib/media/is-valid-media-url'

const MAX_IMAGE_FILE_SIZE = 12 * 1024 * 1024
const MAX_VIDEO_FILE_SIZE = 35 * 1024 * 1024
const MAX_THUMBNAIL_FILE_SIZE = 8 * 1024 * 1024
const MAX_CAPTION_LENGTH = 180

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

async function uploadToMediaBucket(
  file: File,
  folder: string,
  ownerId: string
) {
  const supabase = await createClient()

  await assertMediaUpload(file)

  const fileExt = getFileExtension(file.name)
  const safeName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, '')) || 'story'
  const filePath = `${folder}/${ownerId}/${Date.now()}-${randomUUID()}-${safeName}.${fileExt}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await supabase.storage
    .from('media')
    .upload(filePath, buffer, {
      contentType: file.type || undefined,
      upsert: false,
      cacheControl: '1800',
    })

  if (error) {
    throw new Error(error.message)
  }

  return filePath
}

export async function createStory(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const mediaType = String(formData.get('media_type') || '').trim() as 'image' | 'video'
  const caption = String(formData.get('caption') || '').trim()
  const mediaPathInput = String(formData.get('media_path') || '').trim()
  const thumbnailPathInput = String(formData.get('thumbnail_path') || '').trim()

  const mediaFile = formData.get('media_file')
  const thumbnailFile = formData.get('thumbnail_file')

  const mediaUpload = mediaFile instanceof File && mediaFile.size > 0 ? mediaFile : null
  const thumbnailUpload = thumbnailFile instanceof File && thumbnailFile.size > 0 ? thumbnailFile : null

  if (!profileId) {
    redirect('/stories/create?error=missing_profile_id')
  }

  if (caption.length > MAX_CAPTION_LENGTH) {
    redirect('/stories/create?error=caption_too_long')
  }

  if (mediaType !== 'image' && mediaType !== 'video') {
    redirect('/stories/create?error=invalid_media_type')
  }

  if (!mediaPathInput && !mediaUpload) {
    redirect('/stories/create?error=media_source_required')
  }

  if (mediaUpload) {
    if (mediaType === 'image') {
      if (!mediaUpload.type || !ACCEPTED_IMAGE_TYPES.has(mediaUpload.type)) {
        redirect('/stories/create?error=invalid_image_file')
      }
      if (mediaUpload.size > MAX_IMAGE_FILE_SIZE) {
        redirect('/stories/create?error=image_too_large')
      }
    }

    if (mediaType === 'video') {
      if (!mediaUpload.type || !ACCEPTED_VIDEO_TYPES.has(mediaUpload.type)) {
        redirect('/stories/create?error=invalid_video_file')
      }
      if (mediaUpload.size > MAX_VIDEO_FILE_SIZE) {
        redirect('/stories/create?error=video_too_large')
      }
    }
  }

  let resolvedMediaPath = mediaPathInput

  if (mediaUpload) {
    try {
      resolvedMediaPath = await uploadToMediaBucket(
        mediaUpload,
        mediaType === 'video' ? 'story-videos' : 'story-images',
        profileId
      )
    } catch (error: unknown) {
      redirect(`/stories/create?error=${encodeURIComponent((error instanceof Error ? error.message : 'story_media_upload_failed'))}`)
    }
  } else if (!isOwnedMediaPath(mediaPathInput, profileId) && !isValidMediaUrl(mediaPathInput)) {
    redirect('/stories/create?error=invalid_media_url')
  }

  let resolvedThumbnailPath = thumbnailPathInput

  if (mediaType === 'video') {
    if (thumbnailUpload) {
      if (!thumbnailUpload.type || !ACCEPTED_IMAGE_TYPES.has(thumbnailUpload.type)) {
        redirect('/stories/create?error=invalid_thumbnail_file')
      }
      if (thumbnailUpload.size > MAX_THUMBNAIL_FILE_SIZE) {
        redirect('/stories/create?error=thumbnail_too_large')
      }

      try {
        resolvedThumbnailPath = await uploadToMediaBucket(
          thumbnailUpload,
          'story-thumbnails',
          profileId
        )
      } catch (error: unknown) {
        redirect(`/stories/create?error=${encodeURIComponent((error instanceof Error ? error.message : 'story_thumbnail_upload_failed'))}`)
      }
    } else if (thumbnailPathInput && !isOwnedMediaPath(thumbnailPathInput, profileId) && !isValidMediaUrl(thumbnailPathInput)) {
      redirect('/stories/create?error=invalid_thumbnail_url')
    }
  } else {
    resolvedThumbnailPath = ''
  }

  const { error } = await supabase.from('stories').insert({
    author_id: profileId,
    media_type: mediaType,
    media_path: resolvedMediaPath,
    thumbnail_path: mediaType === 'video' ? resolvedThumbnailPath || null : null,
    caption: caption || null,
  })

  if (error) {
    redirect(`/stories/create?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/feed?story_created=1')
}

export async function markStoryViewed(storyId: string) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  if (!storyId || !profileId) return

  await supabase
    .from('story_views')
    .upsert(
      {
        story_id: storyId,
        viewer_id: profileId,
      },
      {
        onConflict: 'story_id,viewer_id',
      }
    )
}