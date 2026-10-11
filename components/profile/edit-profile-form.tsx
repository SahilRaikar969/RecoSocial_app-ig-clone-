'use client'

import Link from 'next/link'
import { useMediaFormAction } from '@/lib/media/use-media-form-action'
import { useEffect, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateProfile } from '@/actions/profile'
import { AvatarCropEditor } from '@/components/profile/avatar-crop-editor'

type EditableProfile = {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
}

type EditProfileFormProps = {
  profile: EditableProfile
  errorMessage?: string
}

const MAX_DISPLAY_NAME_LENGTH = 40
const MAX_USERNAME_LENGTH = 30
const MAX_BIO_LENGTH = 200
const MAX_AVATAR_FILE_SIZE_MB = 10

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rs-button rs-button-primary" aria-live="polite"
    >
      {pending ? 'Saving...' : 'Save profile'}
    </button>
  )
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return 'NA'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}

function normalizeUsernameInput(value: string) {
  return value.replace(/\s+/g, '').replace(/^@+/, '').toLowerCase()
}

export function EditProfileForm({
  profile,
  errorMessage = '',
}: EditProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [username, setUsername] = useState(profile.username || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')
  const [avatarCropDataUrl, setAvatarCropDataUrl] = useState('')
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [clientError, setClientError] = useState('')
  const submitMedia = useMediaFormAction(updateProfile, 'profile', setClientError, { avatar_file: removeAvatar ? null : avatarFile })

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(avatarFile)
    setAvatarPreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [avatarFile])

  useEffect(() => {
    setClientError('')
  }, [displayName, username, bio, avatarUrl, avatarFile, avatarCropDataUrl, removeAvatar])

  const previewName = displayName.trim() || 'Unnamed profile'
  const previewUsername = normalizeUsernameInput(username) || 'username'
  const previewInitials = useMemo(() => getInitials(previewName), [previewName])

  const resolvedAvatarPreview = removeAvatar
    ? ''
    : avatarCropDataUrl || avatarPreviewUrl || avatarUrl.trim()

  const effectiveError = clientError || errorMessage

  function validateBeforeSubmit() {
    const cleanUsername = normalizeUsernameInput(username)

    if (!displayName.trim()) {
      return 'Display name is required.'
    }

    if (!cleanUsername) {
      return 'Username is required.'
    }

    if (displayName.trim().length > MAX_DISPLAY_NAME_LENGTH) {
      return `Display name must stay within ${MAX_DISPLAY_NAME_LENGTH} characters.`
    }

    if (cleanUsername.length > MAX_USERNAME_LENGTH) {
      return `Username must stay within ${MAX_USERNAME_LENGTH} characters.`
    }

    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      return 'Username can only use lowercase letters, numbers, dots, and underscores.'
    }

    if (bio.length > MAX_BIO_LENGTH) {
      return `Bio must stay within ${MAX_BIO_LENGTH} characters.`
    }

    if (avatarFile && avatarFile.size > MAX_AVATAR_FILE_SIZE_MB * 1024 * 1024) {
      return `Avatar file must stay under ${MAX_AVATAR_FILE_SIZE_MB} MB.`
    }

    if (avatarFile && !avatarCropDataUrl) {
      return 'Adjust the avatar crop before saving.'
    }

    return ''
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const nextError = validateBeforeSubmit()

    if (nextError) {
      event.preventDefault()
      setClientError(nextError)
    }
  }

  return (
    <form action={submitMedia} onSubmit={handleSubmit} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
      <input type="hidden" name="profile_id" value={profile.id} />
      <input type="hidden" name="remove_avatar" value={removeAvatar ? 'true' : 'false'} />
      <input type="hidden" name="return_to" value="/profile/edit" />
      <input type="hidden" name="avatar_crop_data_url" value={avatarCropDataUrl} />
      <div className="min-w-0 space-y-5">
        {effectiveError ? <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{effectiveError}</div> : null}
        <div>
          <label htmlFor="profile-display-name" className="mb-2 block text-sm font-medium text-zinc-200">Display name</label>
          <input id="profile-display-name" type="text" name="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={MAX_DISPLAY_NAME_LENGTH} placeholder="Your name" className="rs-input" />
        </div>
        <div>
          <label htmlFor="profile-username" className="mb-2 block text-sm font-medium text-zinc-200">Username</label>
          <input id="profile-username" type="text" name="username" value={username} onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))} maxLength={MAX_USERNAME_LENGTH} placeholder="username" className="rs-input" aria-describedby="profile-username-hint" autoCapitalize="none" spellCheck={false} />
          <p id="profile-username-hint" className="mt-2 text-xs leading-5 text-zinc-400">Lowercase letters, numbers, dots, and underscores.</p>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="profile-bio" className="text-sm font-medium text-zinc-200">Bio</label>
            <span id="profile-bio-count" className="text-xs text-zinc-400">{bio.length}/{MAX_BIO_LENGTH}</span>
          </div>
          <textarea id="profile-bio" name="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={MAX_BIO_LENGTH} placeholder="A little about you…" className="rs-input resize-y" aria-describedby="profile-bio-count" />
        </div>
        <fieldset className="min-w-0 space-y-4 rounded-xl border border-zinc-800 p-4">
          <legend className="px-1 text-sm font-medium text-zinc-200">Profile photo</legend>
          <div>
            <label htmlFor="profile-avatar" className="mb-2 block text-sm font-medium text-zinc-200">Upload photo</label>
            <input id="profile-avatar" type="file" name="avatar_file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" aria-describedby="profile-avatar-hint" onChange={(e) => {
              const nextFile = e.target.files?.[0] || null
              const lowerName = String(nextFile?.name || '').toLowerCase()
              const lowerType = String(nextFile?.type || '').toLowerCase()
              if (nextFile && (lowerType.includes('heic') || lowerType.includes('heif') || lowerName.endsWith('.heic') || lowerName.endsWith('.heif'))) {
                setAvatarFile(null)
                setAvatarCropDataUrl('')
                setClientError('HEIC and HEIF are not supported. Use JPG, PNG, WEBP, or GIF.')
                e.currentTarget.value = ''
                return
              }
              setAvatarFile(nextFile)
              setAvatarCropDataUrl('')
              if (nextFile) {
                setAvatarUrl('')
                setRemoveAvatar(false)
              }
            }} className="rs-input file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-white" />
            <p id="profile-avatar-hint" className="mt-2 text-xs leading-5 text-zinc-400">JPG, PNG, WEBP, or GIF. Maximum {MAX_AVATAR_FILE_SIZE_MB} MB.</p>
            <AvatarCropEditor file={avatarFile} onCroppedChange={(value) => setAvatarCropDataUrl(value)} onErrorChange={setClientError} />
          </div>
          <div>
            <label htmlFor="profile-avatar-url" className="mb-2 block text-sm font-medium text-zinc-200">Or use a photo link</label>
            <input id="profile-avatar-url" type="url" name="avatar_url" value={avatarUrl} onChange={(e) => {
              setAvatarUrl(e.target.value)
              if (e.target.value.trim()) {
                setAvatarFile(null)
                setAvatarCropDataUrl('')
                setRemoveAvatar(false)
              }
            }} placeholder="https://example.com/photo.jpg" className="rs-input" />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-zinc-200">
            <input type="checkbox" checked={removeAvatar} onChange={(e) => {
              setRemoveAvatar(e.target.checked)
              if (e.target.checked) {
                setAvatarFile(null)
                setAvatarCropDataUrl('')
                setAvatarUrl('')
              }
            }} className="h-5 w-5 accent-violet-500" />
            Remove profile photo
          </label>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5">
          <Link href="/profile" className="rs-button">Cancel</Link>
          <SubmitButton />
        </div>
      </div>
      <aside className="min-w-0 self-start rounded-xl border border-zinc-800 p-5 lg:sticky lg:top-24">
        <h2 className="mb-5 text-sm font-medium text-zinc-400">Profile preview</h2>
        <div className="flex min-w-0 items-center gap-4">
          {resolvedAvatarPreview ? <img src={resolvedAvatarPreview} alt="Profile photo preview" className="h-20 w-20 shrink-0 rounded-full object-cover" /> : <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xl font-semibold text-white">{previewInitials}</div>}
          <div className="min-w-0">
            <p className="break-words text-base font-semibold text-white">{previewName}</p>
            <p className="mt-1 break-all text-sm text-zinc-400">@{previewUsername}</p>
          </div>
        </div>
        {bio.trim() ? <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{bio}</p> : null}
      </aside>
    </form>
  )
}
