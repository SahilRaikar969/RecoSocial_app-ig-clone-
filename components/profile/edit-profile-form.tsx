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
      className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-700"
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

function buildProfileLinkPreview(username: string) {
  const safe = normalizeUsernameInput(username) || 'username'
  return `/profile/${safe}`
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
    <section className="rounded-[32px] border border-zinc-800/90 bg-black p-5 sm:p-6">
      {effectiveError ? (
        <div className="mb-5 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {effectiveError}
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-400">
          Identity updates immediately affect how you appear across feed, explore, activity, search, and profile surfaces.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <form action={submitMedia} onSubmit={handleSubmit} className="space-y-5">
          <input type="hidden" name="profile_id" value={profile.id} />
          <input type="hidden" name="remove_avatar" value={removeAvatar ? 'true' : 'false'} />
          <input type="hidden" name="return_to" value="/profile/edit" />
          <input type="hidden" name="avatar_crop_data_url" value={avatarCropDataUrl} />

          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Step 1
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Core identity
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-white">
                    Display name
                  </label>
                  <span className="text-xs text-zinc-500">
                    {displayName.length}/{MAX_DISPLAY_NAME_LENGTH}
                  </span>
                </div>

                <input
                  type="text"
                  name="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  placeholder="Your display name"
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-white">
                    Username
                  </label>
                  <span className="text-xs text-zinc-500">
                    {normalizeUsernameInput(username).length}/{MAX_USERNAME_LENGTH}
                  </span>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-black">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span className="text-sm text-zinc-500">@</span>
                    <input
                      type="text"
                      name="username"
                      value={username}
                      onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))}
                      maxLength={MAX_USERNAME_LENGTH}
                      placeholder="username"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                    />
                  </div>
                </div>

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Lowercase letters, numbers, dots, and underscores only.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-white">
                    Bio
                  </label>
                  <span className="text-xs text-zinc-500">
                    {bio.length}/{MAX_BIO_LENGTH}
                  </span>
                </div>

                <textarea
                  name="bio"
                  rows={5}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={MAX_BIO_LENGTH}
                  placeholder="Tell people what this profile is about."
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Step 2
                </p>
                <h2 className="mt-1 text-base font-semibold text-white">
                  Avatar
                </h2>
              </div>

              <span className="text-xs text-zinc-500">
                Max {MAX_AVATAR_FILE_SIZE_MB} MB
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Upload avatar
                </label>

                <input
                  type="file"
                  name="avatar_file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const nextFile = e.target.files?.[0] || null
                    const lowerName = String(nextFile?.name || '').toLowerCase()
                    const lowerType = String(nextFile?.type || '').toLowerCase()

                    if (
                      nextFile &&
                      (
                        lowerType.includes('heic') ||
                        lowerType.includes('heif') ||
                        lowerName.endsWith('.heic') ||
                        lowerName.endsWith('.heif')
                      )
                    ) {
                      setAvatarFile(null)
                      setAvatarCropDataUrl('')
                      setClientError('HEIC and HEIF are not supported for avatar upload in this build yet.')
                      e.currentTarget.value = ''
                      return
                    }

                    setAvatarFile(nextFile)
                    setAvatarCropDataUrl('')
                    if (nextFile) {
                      setAvatarUrl('')
                      setRemoveAvatar(false)
                    }
                  }}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
                />

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Recommended: JPG, PNG, WEBP, or GIF.
                </p>

                <AvatarCropEditor
                  file={avatarFile}
                  onCroppedChange={(value) => setAvatarCropDataUrl(value)}
                  onErrorChange={setClientError}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Avatar URL fallback
                </label>

                <input
                  type="text"
                  name="avatar_url"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value)
                    if (e.target.value.trim()) {
                      setAvatarFile(null)
                      setAvatarCropDataUrl('')
                      setRemoveAvatar(false)
                    }
                  }}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Used only when you do not upload a file.
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={removeAvatar}
                  onChange={(e) => {
                    setRemoveAvatar(e.target.checked)
                    if (e.target.checked) {
                      setAvatarFile(null)
                      setAvatarCropDataUrl('')
                      setAvatarUrl('')
                    }
                  }}
                  className="h-4 w-4 accent-white"
                />
                <span>Remove current avatar and use initials fallback</span>
              </label>
            </div>
          </section>

          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Step 3
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Identity checks
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Public name
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {displayName.trim() || 'Missing'}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Username
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  @{previewUsername}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Link shape
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {buildProfileLinkPreview(previewUsername)}
                </p>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/profile"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Cancel
              </Link>
            </div>

            <SubmitButton />
          </div>
        </form>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="mx-auto w-full max-w-[370px] rounded-[36px] border border-zinc-800 bg-zinc-950 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="overflow-hidden rounded-[30px] border border-zinc-800 bg-black">
              <div className="border-b border-zinc-800 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Profile preview</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Live identity surface
                    </p>
                  </div>

                  <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Preview
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-start gap-4">
                  {resolvedAvatarPreview ? (
                    <img
                      src={resolvedAvatarPreview}
                      alt={previewName}
                      className="h-20 w-20 rounded-full border border-zinc-800 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-lg font-semibold text-white">
                      {previewInitials}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-semibold text-white">
                        {previewUsername}
                      </p>

                      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                        Creator
                      </span>
                    </div>

                    <p className="mt-1 truncate text-sm text-zinc-400">
                      {previewName}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Posts
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">—</p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Followers
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">—</p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Following
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">—</p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-zinc-300">
                      {bio.trim() || 'Your bio preview will appear here.'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Affects
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    Feed author rows, explore creator cards, public profile headers, activity rows, comments, and search results.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}