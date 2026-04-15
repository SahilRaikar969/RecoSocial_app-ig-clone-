'use server'

import { randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { isValidMediaUrl } from '@/lib/media/is-valid-media-url'

const MAX_DISPLAY_NAME_LENGTH = 60
const MAX_USERNAME_LENGTH = 30
const MAX_BIO_LENGTH = 280
const MAX_AVATAR_FILE_SIZE = 10 * 1024 * 1024

const ACCEPTED_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

function buildRedirectUrl(returnTo: string, params: Record<string, string>) {
  const cleanReturnTo = returnTo.trim() || '/profile/edit'
  const search = new URLSearchParams(params).toString()
  return search ? `${cleanReturnTo}?${search}` : cleanReturnTo
}

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

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, '')
}

function isValidUsername(value: string) {
  return /^[a-z0-9._]+$/.test(value)
}

async function uploadAvatarToMediaBucket(file: File, profileId: string) {
  const supabase = await createClient()

  const fileExt = getFileExtension(file.name)
  const safeName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, '')) || 'avatar'
  const filePath = `avatars/${profileId}/${Date.now()}-${randomUUID()}-${safeName}.${fileExt}`

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

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { profileId } = await getDevSession()

  const returnTo = String(
    formData.get('return_to') || '/profile/edit'
  ).trim()

  const username = normalizeUsername(
    String(formData.get('username') || '').trim()
  )

  const displayName = String(
    formData.get('display_name') || formData.get('displayName') || ''
  ).trim()

  const bio = String(formData.get('bio') || '').trim()

  const avatarUrlInput = String(
    formData.get('avatar_url') || formData.get('avatarUrl') || ''
  ).trim()

  const avatarFileValue = formData.get('avatar_file') || formData.get('avatar')
  const avatarFile =
    avatarFileValue instanceof File && avatarFileValue.size > 0
      ? avatarFileValue
      : null

  if (!profileId) {
    redirect(buildRedirectUrl(returnTo, { error: 'missing_profile_id' }))
  }

  if (!username) {
    redirect(buildRedirectUrl(returnTo, { error: 'username_required' }))
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    redirect(buildRedirectUrl(returnTo, { error: 'username_too_long' }))
  }

  if (!isValidUsername(username)) {
    redirect(buildRedirectUrl(returnTo, { error: 'invalid_username' }))
  }

  if (!displayName) {
    redirect(buildRedirectUrl(returnTo, { error: 'display_name_required' }))
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    redirect(buildRedirectUrl(returnTo, { error: 'display_name_too_long' }))
  }

  if (bio.length > MAX_BIO_LENGTH) {
    redirect(buildRedirectUrl(returnTo, { error: 'bio_too_long' }))
  }

  if (avatarFile) {
    if (!avatarFile.type || !ACCEPTED_AVATAR_TYPES.has(avatarFile.type)) {
      redirect(buildRedirectUrl(returnTo, { error: 'invalid_avatar_file_type' }))
    }

    if (avatarFile.size > MAX_AVATAR_FILE_SIZE) {
      redirect(buildRedirectUrl(returnTo, { error: 'avatar_file_too_large' }))
    }
  }

  if (avatarUrlInput && !isValidMediaUrl(avatarUrlInput)) {
    redirect(buildRedirectUrl(returnTo, { error: 'invalid_avatar_url' }))
  }

  const { data: existingUsernameRow, error: usernameLookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', profileId)
    .maybeSingle()

  if (usernameLookupError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(usernameLookupError.message),
      })
    )
  }

  if (existingUsernameRow) {
    redirect(buildRedirectUrl(returnTo, { error: 'username_taken' }))
  }

  let resolvedAvatarUrl: string | null = avatarUrlInput || null

  if (avatarFile) {
    try {
      resolvedAvatarUrl = await uploadAvatarToMediaBucket(avatarFile, profileId)
    } catch (error: any) {
      redirect(
        buildRedirectUrl(returnTo, {
          error: encodeURIComponent(error?.message || 'avatar_upload_failed'),
        })
      )
    }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      username,
      display_name: displayName,
      bio,
      avatar_url: resolvedAvatarUrl,
    })
    .eq('id', profileId)

  if (updateError) {
    redirect(
      buildRedirectUrl(returnTo, {
        error: encodeURIComponent(updateError.message),
      })
    )
  }

  redirect('/profile?profile_updated=1')
}