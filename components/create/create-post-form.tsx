'use client'

import Link from 'next/link'
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
      pathname.endsWith('.mov')
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

  const [mediaUrl, setMediaUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [caption, setCaption] = useState('')

  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)

  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('')
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('')

  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [clientError, setClientError] = useState('')

  useEffect(() => {
    if (!mediaFile) {
      setMediaPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(mediaFile)
    setMediaPreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [mediaFile])

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(thumbnailFile)
    setThumbnailPreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [thumbnailFile])

  useEffect(() => {
    setClientError('')
  }, [
    mediaSourceMode,
    thumbnailSourceMode,
    mediaUrl,
    thumbnailUrl,
    mediaType,
    caption,
    mediaFile,
    thumbnailFile,
    selectedCategories,
  ])

  useEffect(() => {
    if (mediaType === 'image') {
      setThumbnailFile(null)
      setThumbnailUrl('')
    }
  }, [mediaType])

  const isPreviewableUrl = useMemo(() => isDirectPreviewableUrl(mediaUrl), [mediaUrl])
  const isPreviewableThumbnailUrl = useMemo(
    () => isDirectPreviewableUrl(thumbnailUrl),
    [thumbnailUrl]
  )

  const resolvedMediaPreview =
    mediaSourceMode === 'upload'
      ? mediaPreviewUrl
      : isPreviewableUrl
        ? mediaUrl
        : ''

  const resolvedThumbnailPreview =
    thumbnailSourceMode === 'upload'
      ? thumbnailPreviewUrl
      : isPreviewableThumbnailUrl
        ? thumbnailUrl
        : ''

  const effectiveError = clientError || errorMessage
  const captionCharactersLeft = MAX_CAPTION_LENGTH - caption.length
  const creatorUsername = `creator_${getCompactId(profileId, 6).toLowerCase()}`
  const creatorDisplayName = `Creator ${getCompactId(profileId, 6)}`
  const selectedCategoryObjects = categories.filter((category) =>
    selectedCategories.includes(category.name)
  )

  const publishReadiness = useMemo(() => {
    const mediaReady =
      mediaSourceMode === 'upload'
        ? Boolean(mediaFile)
        : Boolean(mediaUrl.trim() && isPreviewableUrl)

    const thumbnailReady =
      mediaType === 'image'
        ? true
        : thumbnailSourceMode === 'upload'
          ? !thumbnailFile || Boolean(thumbnailFile)
          : !thumbnailUrl.trim() || isPreviewableThumbnailUrl

    const categoriesReady = selectedCategories.length > 0
    const captionReady = caption.length <= MAX_CAPTION_LENGTH

    return {
      mediaReady,
      thumbnailReady,
      categoriesReady,
      captionReady,
      ready: mediaReady && thumbnailReady && categoriesReady && captionReady,
    }
  }, [
    caption.length,
    isPreviewableThumbnailUrl,
    isPreviewableUrl,
    mediaFile,
    mediaSourceMode,
    mediaType,
    mediaUrl,
    selectedCategories.length,
    thumbnailFile,
    thumbnailSourceMode,
    thumbnailUrl,
  ])

  const readinessScore = [
    publishReadiness.mediaReady,
    publishReadiness.captionReady,
    publishReadiness.categoriesReady,
    mediaType === 'video' ? publishReadiness.thumbnailReady : true,
  ].filter(Boolean).length

  const readinessMax = mediaType === 'video' ? 4 : 3
  const readinessPercent = Math.round((readinessScore / readinessMax) * 100)

  function handleCategoryToggle(categoryName: string) {
    setSelectedCategories((current) =>
      current.includes(categoryName)
        ? current.filter((item) => item !== categoryName)
        : [...current, categoryName]
    )
  }

  function validateBeforeSubmit() {
    if (caption.length > MAX_CAPTION_LENGTH) {
      return 'Caption is too long. Keep it within 280 characters.'
    }

    if (mediaSourceMode === 'upload') {
      if (!mediaFile) {
        return 'Choose a media file before publishing.'
      }

      if (mediaType === 'image' && mediaFile.size > MAX_IMAGE_FILE_SIZE) {
        return 'Image file is too large. Keep it under 15 MB.'
      }

      if (mediaType === 'video' && mediaFile.size > MAX_VIDEO_FILE_SIZE) {
        return 'Video file is too large. Keep it under 50 MB.'
      }
    } else {
      if (!mediaUrl.trim()) {
        return 'Paste a direct media URL before publishing.'
      }

      if (!isDirectPreviewableUrl(mediaUrl)) {
        return 'Use a direct media URL ending in an image or video file extension.'
      }
    }

    if (mediaType === 'video') {
      if (thumbnailSourceMode === 'upload') {
        if (thumbnailFile && thumbnailFile.size > MAX_THUMBNAIL_FILE_SIZE) {
          return 'Thumbnail file is too large. Keep it under 10 MB.'
        }
      } else {
        if (thumbnailUrl.trim() && !isDirectPreviewableUrl(thumbnailUrl)) {
          return 'Use a direct thumbnail image URL ending in .jpg, .png, .gif, or .webp.'
        }
      }
    }

    if (selectedCategories.length === 0) {
      return 'Select at least one category.'
    }

    return ''
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const validationError = validateBeforeSubmit()

    if (validationError) {
      event.preventDefault()
      setClientError(validationError)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form
        action={createPost}
        onSubmit={handleSubmit}
        className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(16,16,22,0.96),rgba(8,8,10,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_70px_rgba(0,0,0,0.30)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_24%)]" />

        <input type="hidden" name="dev_profile_id" value={profileId} />
        <input type="hidden" name="media_type" value={mediaType} />

        {selectedCategories.map((category) => (
          <input key={category} type="hidden" name="categories" value={category} />
        ))}

        <div className="relative border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-100">
                Create flow
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white">Compose post</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                Build the post as a product-grade publishing surface before it goes live.
              </p>
            </div>

            <div className="min-w-[220px] rounded-[24px] border border-zinc-800 bg-zinc-950/75 px-4 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Publish readiness
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(120,119,255,0.95),rgba(236,72,153,0.8))] transition-all"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-zinc-200">
                {readinessScore}/{readinessMax} steps ready
              </p>
            </div>
          </div>

          {effectiveError ? (
            <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {effectiveError}
            </div>
          ) : null}
        </div>

        <div className="relative space-y-6 px-5 py-5 sm:px-6">
          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5 transition hover:border-zinc-700">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Step 1
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">
              Choose post type
            </h3>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setMediaType('image')}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  mediaType === 'image'
                    ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_14px_30px_rgba(120,119,255,0.12)]'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
                }`}
              >
                Image post
              </button>

              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  mediaType === 'video'
                    ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_14px_30px_rgba(120,119,255,0.12)]'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
                }`}
              >
                Video post
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5 transition hover:border-zinc-700">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Step 2
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  Main media
                </h3>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setMediaSourceMode('upload')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    mediaSourceMode === 'upload'
                      ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_14px_30px_rgba(120,119,255,0.12)]'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  Upload file
                </button>

                <button
                  type="button"
                  onClick={() => setMediaSourceMode('url')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    mediaSourceMode === 'url'
                      ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_14px_30px_rgba(120,119,255,0.12)]'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  Use direct URL
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                {mediaSourceMode === 'upload' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Upload {mediaType}
                    </label>

                    <input
                      name="media_file"
                      type="file"
                      accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                      onChange={(event) => setMediaFile(event.target.files?.[0] ?? null)}
                      className="block w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
                    />

                    <p className="mt-2 text-xs text-zinc-500">
                      {mediaType === 'image'
                        ? `Accepted image upload. Keep it under ${formatBytes(MAX_IMAGE_FILE_SIZE)}.`
                        : `Accepted video upload. Keep it under ${formatBytes(MAX_VIDEO_FILE_SIZE)}.`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Direct media URL
                    </label>

                    <input
                      name="media_path"
                      type="text"
                      value={mediaUrl}
                      onChange={(event) => setMediaUrl(event.target.value)}
                      placeholder={
                        mediaType === 'image'
                          ? 'https://example.com/post-image.jpg'
                          : 'https://example.com/post-video.mp4'
                      }
                      className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-500/30 focus:shadow-[0_0_0_1px_rgba(120,119,255,0.12)]"
                    />

                    <p className="mt-2 text-xs text-zinc-500">
                      Use a direct file URL ending in a valid image or video extension.
                    </p>
                  </div>
                )}

                <div className="rounded-[24px] border border-zinc-800 bg-black px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Media status
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {mediaSourceMode === 'upload'
                      ? mediaFile
                        ? `${mediaFile.name} · ${formatBytes(mediaFile.size)}`
                        : 'No file selected yet'
                      : mediaUrl.trim()
                        ? isPreviewableUrl
                          ? 'Direct media URL looks previewable'
                          : 'Current URL does not look like a direct file'
                        : 'No direct media URL added yet'}
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-zinc-800 bg-black p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Preview
                </p>

                <div className="mt-3 overflow-hidden rounded-[22px] border border-zinc-800 bg-zinc-950">
                  {resolvedMediaPreview ? (
                    mediaType === 'video' ? (
                      <video
                        src={resolvedMediaPreview}
                        controls
                        playsInline
                        poster={resolvedThumbnailPreview || undefined}
                        className="aspect-[4/5] w-full bg-black object-cover"
                      />
                    ) : (
                      <img
                        src={resolvedMediaPreview}
                        alt="Selected post preview"
                        className="aspect-[4/5] w-full bg-black object-cover"
                      />
                    )
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center px-6 text-center text-sm text-zinc-500">
                      Media preview will appear here
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {mediaType === 'video' ? (
            <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5 transition hover:border-zinc-700">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Step 3
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-white">
                    Video thumbnail
                  </h3>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setThumbnailSourceMode('upload')}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      thumbnailSourceMode === 'upload'
                        ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_14px_30px_rgba(120,119,255,0.12)]'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    Upload thumbnail
                  </button>

                  <button
                    type="button"
                    onClick={() => setThumbnailSourceMode('url')}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      thumbnailSourceMode === 'url'
                        ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_14px_30px_rgba(120,119,255,0.12)]'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    Use direct URL
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-4">
                  {thumbnailSourceMode === 'upload' ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">
                        Upload thumbnail
                      </label>

                      <input
                        name="thumbnail_file"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setThumbnailFile(event.target.files?.[0] ?? null)
                        }
                        className="block w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
                      />

                      <p className="mt-2 text-xs text-zinc-500">
                        Optional but strongly recommended. Keep it under {formatBytes(MAX_THUMBNAIL_FILE_SIZE)}.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">
                        Direct thumbnail URL
                      </label>

                      <input
                        name="thumbnail_path"
                        type="text"
                        value={thumbnailUrl}
                        onChange={(event) => setThumbnailUrl(event.target.value)}
                        placeholder="https://example.com/video-thumbnail.jpg"
                        className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-500/30 focus:shadow-[0_0_0_1px_rgba(120,119,255,0.12)]"
                      />

                      <p className="mt-2 text-xs text-zinc-500">
                        Use a direct image file URL for the video thumbnail.
                      </p>
                    </div>
                  )}

                  <div className="rounded-[24px] border border-zinc-800 bg-black px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      Thumbnail status
                    </p>
                    <p className="mt-2 text-sm text-zinc-300">
                      {thumbnailSourceMode === 'upload'
                        ? thumbnailFile
                          ? `${thumbnailFile.name} · ${formatBytes(thumbnailFile.size)}`
                          : 'No thumbnail file selected'
                        : thumbnailUrl.trim()
                          ? isPreviewableThumbnailUrl
                            ? 'Direct thumbnail URL looks previewable'
                            : 'Current thumbnail URL does not look like a direct image'
                          : 'No thumbnail URL added yet'}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-zinc-800 bg-black p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Thumbnail preview
                  </p>

                  <div className="mt-3 overflow-hidden rounded-[22px] border border-zinc-800 bg-zinc-950">
                    {resolvedThumbnailPreview ? (
                      <img
                        src={resolvedThumbnailPreview}
                        alt="Selected thumbnail preview"
                        className="aspect-[4/5] w-full bg-black object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center px-6 text-center text-sm text-zinc-500">
                        Thumbnail preview will appear here
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5 transition hover:border-zinc-700">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Step {mediaType === 'video' ? '4' : '3'}
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">
              Caption and categories
            </h3>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Caption
                </label>

                <textarea
                  name="caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  rows={6}
                  maxLength={MAX_CAPTION_LENGTH}
                  placeholder="Write a caption for this post..."
                  className="w-full rounded-[24px] border border-zinc-800 bg-black px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-zinc-500 focus:border-violet-500/30 focus:shadow-[0_0_0_1px_rgba(120,119,255,0.12)]"
                />

                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-500">
                    Keep the caption short but useful for discovery.
                  </span>
                  <span
                    className={
                      captionCharactersLeft < 30 ? 'text-amber-300' : 'text-zinc-500'
                    }
                  >
                    {caption.length}/{MAX_CAPTION_LENGTH}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-zinc-300">
                    Categories
                  </label>
                  <span className="text-xs text-zinc-500">
                    {selectedCategories.length} selected
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {categories.map((category) => {
                    const active = selectedCategories.includes(category.name)

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleCategoryToggle(category.name)}
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
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-2">
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
                      className="aspect-[4/5] w-full bg-black object-cover"
                    />
                  ) : (
                    <img
                      src={resolvedMediaPreview}
                      alt="Preview"
                      className="aspect-[4/5] w-full bg-black object-cover"
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