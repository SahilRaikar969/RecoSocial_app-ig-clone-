'use client'

import Link from 'next/link'
import { useObjectUrl } from '@/lib/media/use-object-url'
import { useMediaFormAction } from '@/lib/media/use-media-form-action'
import { useEffect, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { createPost } from '@/actions/posts'

type CategoryOption = {
  id: string
  name: string
  slug: string
  description?: string | null
}

type CreatePostFormProps = {
  profileId: string
  errorMessage?: string
  categories: CategoryOption[]
}

const MAX_CAPTION_LENGTH = 280
const MAX_IMAGE_FILE_SIZE = 15 * 1024 * 1024
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024
const MAX_THUMBNAIL_FILE_SIZE = 10 * 1024 * 1024

const IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/gif'
const VIDEO_UPLOAD_ACCEPT =
  'video/mp4,video/webm,video/quicktime,video/x-m4v,video/3gpp,video/3gpp2,video/ogg'

function isDirectPreviewableUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false

  try {
    const url = new URL(trimmed)
    if (!['http:', 'https:'].includes(url.protocol)) return false

    const pathname = url.pathname.toLowerCase()

    return (
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.webp') ||
      pathname.endsWith('.gif') ||
      pathname.endsWith('.mp4') ||
      pathname.endsWith('.webm') ||
      pathname.endsWith('.mov') ||
      pathname.endsWith('.m4v') ||
      pathname.endsWith('.3gp') ||
      pathname.endsWith('.3g2') ||
      pathname.endsWith('.ogv') ||
      pathname.endsWith('.ogg')
    )
  } catch {
    return false
  }
}

function getCompactId(value: string, length = 6) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, length) || 'creator'
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatCategoryDescription(category: CategoryOption) {
  return category.description?.trim() || `${category.name} discovery topic`
}

function isHeicLikeFile(file: File | null) {
  if (!file) return false

  const type = String(file.type || '').toLowerCase().trim()
  const lowerName = String(file.name || '').toLowerCase()

  return (
    type.includes('heic') ||
    type.includes('heif') ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif')
  )
}

function ChecklistItem({
  label,
  value,
  done,
}: {
  label: string
  value: string
  done: boolean
}) {
  return (
    <div className="rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4 transition hover:-translate-y-0.5 hover:border-zinc-700">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">{label}</p>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            done
              ? 'border border-emerald-900/60 bg-emerald-950/40 text-emerald-200'
              : 'border border-zinc-700 bg-black text-zinc-400'
          }`}
        >
          {done ? 'Ready' : 'Pending'}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-400">{value}</p>
    </div>
  )
}

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl border border-white bg-[linear-gradient(90deg,#ffffff_0%,#f4f4ff_100%)] px-5 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-700"
    >
      {pending ? 'Publishing...' : ready ? 'Publish post' : 'Complete setup to publish'}
    </button>
  )
}

export function CreatePostForm({
  profileId,
  errorMessage = '',
  categories,
}: CreatePostFormProps) {
  const [mediaSourceMode, setMediaSourceMode] = useState<'url' | 'upload'>('upload')
  const [thumbnailSourceMode, setThumbnailSourceMode] = useState<'url' | 'upload'>('upload')
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [caption, setCaption] = useState('')
  const [mediaPath, setMediaPath] = useState('')
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [clientError, setClientError] = useState('')
  const submitMedia = useMediaFormAction(createPost, 'post', setClientError, {
    media_file: mediaSourceMode === 'upload' ? mediaFile : null,
    thumbnail_file: mediaType === 'video' && thumbnailSourceMode === 'upload' ? thumbnailFile : null,
  })

  useEffect(() => {
    setClientError('')
  }, [
    caption,
    mediaPath,
    thumbnailPath,
    mediaFile,
    thumbnailFile,
    selectedCategories,
    mediaType,
    mediaSourceMode,
    thumbnailSourceMode,
  ])

  const creatorUsername = useMemo(() => `you_${getCompactId(profileId)}`, [profileId])
  const creatorDisplayName = 'Your profile'

  const mediaObjectUrl = useObjectUrl(mediaFile)
  const thumbnailObjectUrl = useObjectUrl(thumbnailFile)
  const resolvedMediaPreview = mediaSourceMode === 'upload' ? mediaObjectUrl : isDirectPreviewableUrl(mediaPath) ? mediaPath.trim() : ''
  const resolvedThumbnailPreview = mediaType === 'video' ? thumbnailSourceMode === 'upload' ? thumbnailObjectUrl : isDirectPreviewableUrl(thumbnailPath) ? thumbnailPath.trim() : '' : ''

  const selectedCategoryObjects = useMemo(
    () =>
      categories.filter((category) => selectedCategories.includes(category.name)),
    [categories, selectedCategories]
  )

  const publishReadiness = useMemo(() => {
    const mediaReady =
      mediaSourceMode === 'upload'
        ? !!mediaFile
        : mediaPath.trim().length > 0 && isDirectPreviewableUrl(mediaPath)

    const thumbnailReady =
      mediaType !== 'video'
        ? true
        : thumbnailSourceMode === 'upload'
          ? !thumbnailFile || !!thumbnailFile
          : !thumbnailPath.trim() || isDirectPreviewableUrl(thumbnailPath)

    const captionReady = caption.length <= MAX_CAPTION_LENGTH
    const categoriesReady = selectedCategories.length > 0

    return {
      mediaReady,
      thumbnailReady,
      captionReady,
      categoriesReady,
      ready: mediaReady && thumbnailReady && captionReady && categoriesReady,
    }
  }, [
    mediaSourceMode,
    mediaFile,
    mediaPath,
    mediaType,
    thumbnailSourceMode,
    thumbnailFile,
    thumbnailPath,
    caption.length,
    selectedCategories.length,
  ])

  function toggleCategory(name: string) {
    setSelectedCategories((current) =>
      current.includes(name)
        ? current.filter((value) => value !== name)
        : [...current, name]
    )
  }

  function validateBeforeSubmit() {
    if (caption.length > MAX_CAPTION_LENGTH) {
      return `Caption must stay within ${MAX_CAPTION_LENGTH} characters.`
    }

    if (mediaSourceMode === 'upload') {
      if (!mediaFile) {
        return 'Choose a media file before publishing.'
      }

      if (isHeicLikeFile(mediaFile)) {
        return 'HEIC and HEIF are not supported in this build yet. Convert the image to JPG, PNG, or WEBP first.'
      }

      if (
        mediaType === 'image' &&
        mediaFile.size > MAX_IMAGE_FILE_SIZE
      ) {
        return `Image uploads must stay under ${formatBytes(MAX_IMAGE_FILE_SIZE)}.`
      }

      if (
        mediaType === 'video' &&
        mediaFile.size > MAX_VIDEO_FILE_SIZE
      ) {
        return `Video uploads must stay under ${formatBytes(MAX_VIDEO_FILE_SIZE)}.`
      }
    } else {
      if (!mediaPath.trim()) {
        return 'Add a direct media URL before publishing.'
      }

      if (!isDirectPreviewableUrl(mediaPath)) {
        return 'Media URL must point directly to a previewable image or video file.'
      }
    }

    if (mediaType === 'video') {
      if (thumbnailSourceMode === 'upload') {
        if (thumbnailFile && isHeicLikeFile(thumbnailFile)) {
          return 'HEIC and HEIF thumbnails are not supported in this build yet.'
        }

        if (
          thumbnailFile &&
          thumbnailFile.size > MAX_THUMBNAIL_FILE_SIZE
        ) {
          return `Thumbnail uploads must stay under ${formatBytes(MAX_THUMBNAIL_FILE_SIZE)}.`
        }
      } else if (
        thumbnailPath.trim() &&
        !isDirectPreviewableUrl(thumbnailPath)
      ) {
        return 'Thumbnail URL must point directly to a previewable image file.'
      }
    }

    if (selectedCategories.length === 0) {
      return 'Select at least one category.'
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

  const effectiveError = clientError || errorMessage

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_0.92fr]">
      <form action={submitMedia} onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="profile_id" value={profileId} />
        <input type="hidden" name="media_type" value={mediaType} />
        {selectedCategories.map((name) => (
          <input key={name} type="hidden" name="categories" value={name} />
        ))}

        <div className="overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(16,16,22,0.96),rgba(8,8,10,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_70px_rgba(0,0,0,0.30)]">
          <div className="border-b border-zinc-800/80 px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Creator studio
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  Publish a new post
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-400">
                  Build a clean media post with stronger mobile upload handling, clearer framing, and category-ready distribution.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setMediaType('image')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    mediaType === 'image'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Image
                </button>

                <button
                  type="button"
                  onClick={() => setMediaType('video')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    mediaType === 'video'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Video
                </button>
              </div>
            </div>
          </div>

          {effectiveError ? (
            <div className="border-b border-red-900/30 bg-red-950/30 px-5 py-4 text-sm text-red-100">
              {effectiveError}
            </div>
          ) : null}

          <div className="grid gap-6 px-5 py-5">
            <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Step 1
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-white">
                    Media source
                  </h2>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMediaSourceMode('upload')}
                    className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                      mediaSourceMode === 'upload'
                        ? 'border-white bg-white text-black'
                        : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    Upload
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaSourceMode('url')}
                    className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                      mediaSourceMode === 'url'
                        ? 'border-white bg-white text-black'
                        : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    URL
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {mediaSourceMode === 'upload' ? (
                  <div>
                    <input
                      name="media_file"
                      type="file"
                      accept={mediaType === 'image' ? IMAGE_UPLOAD_ACCEPT : VIDEO_UPLOAD_ACCEPT}
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] ?? null

                        if (isHeicLikeFile(nextFile)) {
                          setMediaFile(null)
                          setClientError('HEIC and HEIF are not supported in this build yet. Convert the image to JPG, PNG, or WEBP first.')
                          event.currentTarget.value = ''
                          return
                        }

                        setMediaFile(nextFile)
                      }}
                      className="block w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
                    />

                    <p className="mt-2 text-xs text-zinc-500">
                      {mediaType === 'image'
                        ? `Accepted image upload. JPG, PNG, WEBP, or GIF. Keep it under ${formatBytes(MAX_IMAGE_FILE_SIZE)}.`
                        : `Accepted video upload. MP4, WEBM, MOV, M4V, OGG, 3GP, or 3G2. Keep it under ${formatBytes(MAX_VIDEO_FILE_SIZE)}.`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      name="media_path"
                      type="text"
                      value={mediaPath}
                      onChange={(event) => setMediaPath(event.target.value)}
                      placeholder="https://example.com/file.jpg"
                      className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                    />

                    <p className="mt-2 text-xs text-zinc-500">
                      Direct file link required. The URL must end in a previewable media extension.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {mediaType === 'video' ? (
              <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Step 2
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-white">
                      Thumbnail
                    </h2>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setThumbnailSourceMode('upload')}
                      className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                        thumbnailSourceMode === 'upload'
                          ? 'border-white bg-white text-black'
                          : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      Upload
                    </button>

                    <button
                      type="button"
                      onClick={() => setThumbnailSourceMode('url')}
                      className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                        thumbnailSourceMode === 'url'
                          ? 'border-white bg-white text-black'
                          : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      URL
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  {thumbnailSourceMode === 'upload' ? (
                    <div>
                      <input
                        name="thumbnail_file"
                        type="file"
                        accept={IMAGE_UPLOAD_ACCEPT}
                        onChange={(event) => {
                          const nextFile = event.target.files?.[0] ?? null

                          if (isHeicLikeFile(nextFile)) {
                            setThumbnailFile(null)
                            setClientError('HEIC and HEIF thumbnails are not supported in this build yet. Use JPG, PNG, WEBP, or GIF.')
                            event.currentTarget.value = ''
                            return
                          }

                          setThumbnailFile(nextFile)
                        }}
                        className="block w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
                      />

                      <p className="mt-2 text-xs text-zinc-500">
                        Optional. Video publishing should still work without a manual thumbnail. Keep it under {formatBytes(MAX_THUMBNAIL_FILE_SIZE)}.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <input
                        name="thumbnail_path"
                        type="text"
                        value={thumbnailPath}
                        onChange={(event) => setThumbnailPath(event.target.value)}
                        placeholder="https://example.com/thumbnail.jpg"
                        className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                      />

                      <p className="mt-2 text-xs text-zinc-500">
                        Optional direct thumbnail image URL.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Step {mediaType === 'video' ? '3' : '2'}
              </p>
              <h2 className="mt-1 text-base font-semibold text-white">
                Caption
              </h2>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-white">
                    Caption
                  </label>
                  <span className="text-xs text-zinc-500">
                    {caption.length}/{MAX_CAPTION_LENGTH}
                  </span>
                </div>

                <textarea
                  name="caption"
                  rows={5}
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Write something that adds context to the post."
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Step {mediaType === 'video' ? '4' : '3'}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-white">
                    Categories
                  </h2>
                </div>

                <span className="text-xs text-zinc-500">
                  {selectedCategories.length} selected
                </span>
              </div>

              <div className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {categories.map((category) => {
                    const active = selectedCategories.includes(category.name)

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => toggleCategory(category.name)}
                        className={`rounded-[22px] border p-4 text-left transition ${
                          active
                            ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_14px_30px_rgba(120,119,255,0.12)]'
                            : 'border-zinc-800 bg-black text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-600 hover:text-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{category.name}</p>
                            <p
                              className={`mt-2 text-xs leading-6 ${
                                active ? 'text-zinc-200' : 'text-zinc-500'
                              }`}
                            >
                              {formatCategoryDescription(category)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                              active
                                ? 'bg-white/10 text-white'
                                : 'border border-zinc-700 bg-zinc-950 text-zinc-400'
                            }`}
                          >
                            {active ? 'Selected' : 'Add'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 px-5 py-5">
            <Link
              href="/feed"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white"
            >
              Cancel
            </Link>

            <div className="w-full sm:w-auto sm:min-w-[260px]">
              <SubmitButton ready={publishReadiness.ready} />
            </div>
          </div>
        </div>
      </form>

      <aside className="space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(16,16,22,0.96),rgba(8,8,10,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_70px_rgba(0,0,0,0.30)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.14),transparent_30%)]" />

          <div className="relative border-b border-zinc-800/80 px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Live preview
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Creator surface preview
            </h3>
          </div>

          <div className="relative p-5">
            <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-black text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  You
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {creatorUsername}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {creatorDisplayName}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden border-y border-zinc-800 bg-black">
                {resolvedMediaPreview ? (
                  mediaType === 'video' ? (
                    <video
                      src={resolvedMediaPreview}
                      controls
                      playsInline
                      poster={resolvedThumbnailPreview || undefined}
                      className="aspect-[4/5] w-full bg-black object-contain"
                    />
                  ) : (
                    <img
                      src={resolvedMediaPreview}
                      alt="Preview"
                      className="aspect-[4/5] w-full bg-black object-contain"
                    />
                  )
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center text-sm text-zinc-500">
                    Post preview
                  </div>
                )}
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full border border-zinc-800 bg-black" />
                    <div className="h-10 w-10 rounded-full border border-zinc-800 bg-black" />
                    <div className="h-10 w-10 rounded-full border border-zinc-800 bg-black" />
                  </div>

                  <div className="h-10 w-10 rounded-full border border-zinc-800 bg-black" />
                </div>

                <p className="text-sm font-semibold text-white">0 likes</p>

                <p className="text-sm leading-7 text-zinc-300">
                  <span className="mr-2 font-semibold text-white">
                    {creatorUsername}
                  </span>
                  {caption.trim() || 'Your caption will preview here.'}
                </p>

                {selectedCategoryObjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedCategoryObjects.map((category) => (
                      <span
                        key={category.id}
                        className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-[11px] font-medium text-zinc-300"
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(16,16,22,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_70px_rgba(0,0,0,0.30)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_28%)]" />

          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Publish checklist
            </p>

            <div className="mt-4 space-y-3">
              <ChecklistItem
                label="Media source"
                done={publishReadiness.mediaReady}
                value={
                  publishReadiness.mediaReady
                    ? mediaSourceMode === 'upload'
                      ? 'Media file selected and ready for publishing.'
                      : 'Direct media URL looks valid for preview.'
                    : mediaSourceMode === 'upload'
                      ? 'Choose a file to continue.'
                      : 'Add a direct media URL.'
                }
              />

              <ChecklistItem
                label="Caption"
                done={publishReadiness.captionReady}
                value={
                  publishReadiness.captionReady
                    ? caption.trim()
                      ? 'Caption length is valid.'
                      : 'Caption is optional and currently empty.'
                    : 'Caption is too long.'
                }
              />

              <ChecklistItem
                label="Categories"
                done={publishReadiness.categoriesReady}
                value={
                  publishReadiness.categoriesReady
                    ? `${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} selected.`
                    : 'Select at least one category.'
                }
              />

              {mediaType === 'video' ? (
                <ChecklistItem
                  label="Thumbnail"
                  done={publishReadiness.thumbnailReady}
                  value={
                    publishReadiness.thumbnailReady
                      ? resolvedThumbnailPreview
                        ? 'Thumbnail preview is ready.'
                        : 'Thumbnail is optional and can be skipped.'
                      : 'Thumbnail input is invalid.'
                  }
                />
              ) : null}
            </div>

            <div className="mt-5 rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4">
              <p className="text-sm font-medium text-white">Distribution view</p>
              <p className="mt-2 text-sm text-zinc-400">
                This post will publish into your profile, the main feed, post detail, and discovery surfaces.
              </p>
            </div>

            <div className="mt-4 rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4">
              <p className="text-sm font-medium text-white">Status</p>
              <p className="mt-2 text-sm text-zinc-400">
                {publishReadiness.ready
                  ? 'Ready to publish.'
                  : 'Complete the missing pieces before publishing.'}
              </p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}