import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const ACCEPTED_VIDEO_TYPES = new Set([
  'video/webm',
  'video/mp4',
  'video/quicktime',
])

const MAX_IMAGE_SIZE = 12 * 1024 * 1024
const MAX_VIDEO_SIZE = 45 * 1024 * 1024
const MAX_CAPTION_LENGTH = 280

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

async function uploadToMediaBucket(file: File, folder: string, ownerId: string) {
  const supabase = await createClient()

  const fileExt = getFileExtension(file.name)
  const safeName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, '')) || 'capture'
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

export async function POST(request: Request) {
  try {
    const { profileId } = await getDevSession()
    const supabase = await createClient()

    if (!profileId) {
      return NextResponse.json(
        { ok: false, error: 'missing_profile_id' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const target = String(formData.get('target') || '').trim()
    const mediaType = String(formData.get('media_type') || '').trim()
    const caption = String(formData.get('caption') || '').trim()
    const categoryId = String(formData.get('category_id') || '').trim()
    const returnTo = String(formData.get('return_to') || '/feed').trim()

    const mediaFile = formData.get('media_file')
    const upload = mediaFile instanceof File && mediaFile.size > 0 ? mediaFile : null

    if (target !== 'post' && target !== 'story') {
      return NextResponse.json(
        { ok: false, error: 'invalid_target' },
        { status: 400 }
      )
    }

    if (mediaType !== 'image' && mediaType !== 'video') {
      return NextResponse.json(
        { ok: false, error: 'invalid_media_type' },
        { status: 400 }
      )
    }

    if (!upload) {
      return NextResponse.json(
        { ok: false, error: 'media_file_required' },
        { status: 400 }
      )
    }

    if (caption.length > MAX_CAPTION_LENGTH) {
      return NextResponse.json(
        { ok: false, error: 'caption_too_long' },
        { status: 400 }
      )
    }

    if (mediaType === 'image') {
      if (!upload.type || !ACCEPTED_IMAGE_TYPES.has(upload.type)) {
        return NextResponse.json(
          { ok: false, error: 'invalid_image_file' },
          { status: 400 }
        )
      }

      if (upload.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { ok: false, error: 'image_too_large' },
          { status: 400 }
        )
      }
    }

    if (mediaType === 'video') {
      if (!upload.type || !ACCEPTED_VIDEO_TYPES.has(upload.type)) {
        return NextResponse.json(
          { ok: false, error: 'invalid_video_file' },
          { status: 400 }
        )
      }

      if (upload.size > MAX_VIDEO_SIZE) {
        return NextResponse.json(
          { ok: false, error: 'video_too_large' },
          { status: 400 }
        )
      }
    }

    const mediaPath = await uploadToMediaBucket(
      upload,
      target === 'story'
        ? mediaType === 'video'
          ? 'camera-story-videos'
          : 'camera-story-images'
        : mediaType === 'video'
          ? 'camera-post-videos'
          : 'camera-post-images',
      profileId
    )

    if (target === 'story') {
      const { error } = await supabase.from('stories').insert({
        author_id: profileId,
        media_type: mediaType,
        media_path: mediaPath,
        thumbnail_path: null,
        caption: caption || null,
      })

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        ok: true,
        redirectUrl: `${returnTo}?story_created=1`,
      })
    }

    const { data: insertedPost, error: postError } = await supabase
      .from('posts')
      .insert({
        author_id: profileId,
        caption: caption || null,
        media_type: mediaType,
        media_path: mediaPath,
        thumbnail_path: null,
      })
      .select('id')
      .single()

    if (postError) {
      return NextResponse.json(
        { ok: false, error: postError.message },
        { status: 400 }
      )
    }

    if (categoryId) {
      const { error: categoryError } = await supabase
        .from('post_categories')
        .insert({
          post_id: insertedPost.id,
          category_id: categoryId,
        })

      if (categoryError) {
        return NextResponse.json(
          { ok: false, error: categoryError.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      redirectUrl: `${returnTo}?post_created=1`,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'camera_publish_failed',
      },
      { status: 500 }
    )
  }
}