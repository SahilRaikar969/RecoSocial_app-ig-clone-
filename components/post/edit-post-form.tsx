'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { updatePost } from '@/actions/posts'

type CategoryOption = {
  id: string
  name: string
  slug: string
  description?: string | null
}

type EditablePost = {
  id: string
  author_id: string
  caption: string
  media_type: 'image' | 'video'
  media_path: string
  thumbnail_path: string
  created_at: string
  post_categories: Array<{
    category_id: string
    categories?: {
      id: string
      name: string
      slug: string
    } | null
  }>
}

type EditPostFormProps = {
  profileId: string
  post: EditablePost
  categories: CategoryOption[]
  errorMessage?: string
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

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatCategoryDescription(category: CategoryOption) {
  return category.description?.trim() || `${category.name} discovery topic`
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl border border-white bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-700"
    >
      {pending ? 'Saving changes...' : 'Save changes'}
    </button>
  )
}

export function EditPostForm({
  profileId,
  post,
  categories,
  errorMessage = '',
}: EditPostFormProps) {
  const existingCategoryNames = useMemo(
    () =>
      post.post_categories
        .map((item) => item.categories?.name)
        .filter(Boolean) as string[],
    [post.post_categories]
  )

  const [mediaSourceMode, setMediaSourceMode] = useState<'url' | 'upload'>('url')
  const [thumbnailSourceMode, setThumbnailSourceMode] = useState<'url' | 'upload'>(
    post.media_type === 'video' ? 'url' : 'upload'
  )

  const [mediaType, setMediaType] = useState<'image' | 'video'>(post.media_type)
  const [caption, setCaption] = useState(post.caption || '')
  const [mediaUrl, setMediaUrl] = useState(post.media_path || '')
  const [thumbnailUrl, setThumbnailUrl] = useState(post.thumbnail_path || '')

  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)

  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('')
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('')

  const [selectedCategories, setSelectedCategories] = useState<string[]>(existingCategoryNames)
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
    mediaType,
    caption,
    mediaUrl,
    thumbnailUrl,
    mediaFile,
    thumbnailFile,
    selectedCategories,
  ])

  useEffect(() => {
    if (mediaType === 'image') {
      setThumbnailFile(null)
      setThumbnailUrl('')
    } else if (!thumbnailUrl && post.thumbnail_path) {
      setThumbnailUrl(post.thumbnail_path)
    }
  }, [mediaType, post.thumbnail_path, thumbnailUrl])

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
  const selectedCategoryObjects = categories.filter((category) =>
    selectedCategories.includes(category.name)
  )

  const editReadiness = useMemo(() => {
    const mediaReady =
      mediaSourceMode === 'upload'
        ? Boolean(mediaFile) || Boolean(mediaUrl.trim())
        : Boolean(mediaUrl.trim() && isPreviewableUrl)

    const categoriesReady = selectedCategories.length > 0
    const captionReady = caption.length <= MAX_CAPTION_LENGTH

    const thumbnailReady =
      mediaType === 'image'
        ? true
        : thumbnailSourceMode === 'upload'
          ? !thumbnailFile || Boolean(thumbnailFile) || Boolean(thumbnailUrl.trim())
          : !thumbnailUrl.trim() || isPreviewableThumbnailUrl

    return {
      mediaReady,
      categoriesReady,
      captionReady,
      thumbnailReady,
      ready:
        mediaReady &&
        categoriesReady &&
        captionReady &&
        thumbnailReady,
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
      if (mediaFile) {
        if (mediaType === 'image' && mediaFile.size > MAX_IMAGE_FILE_SIZE) {
          return 'Image file is too large. Keep it under 15 MB.'
        }

        if (mediaType === 'video' && mediaFile.size > MAX_VIDEO_FILE_SIZE) {
          return 'Video file is too large. Keep it under 50 MB.'
        }
      } else if (!mediaUrl.trim()) {
        return 'Keep the current media URL or upload a new media file.'
      }
    } else {
      if (!mediaUrl.trim()) {
        return 'Paste a direct media URL before saving.'
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
      } else if (thumbnailUrl.trim() && !isDirectPreviewableUrl(thumbnailUrl)) {
        return 'Use a direct thumbnail image URL ending in .jpg, .png, .gif, or .webp.'
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form
        action={updatePost}
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black"
      >
        <input type="hidden" name="post_id" value={post.id} />
        <input type="hidden" name="dev_profile_id" value={profileId} />
        <input type="hidden" name="return_to" value={`/post/${post.id}/edit`} />
        <input type="hidden" name="media_type" value={mediaType} />

        {selectedCategories.map((category) => (
          <input key={category} type="hidden" name="categories" value={category} />
        ))}

        {mediaSourceMode === 'upload' ? (
          <input type="hidden" name="media_path" value={mediaUrl} />
        ) : null}

        {mediaType === 'video' && thumbnailSourceMode === 'upload' ? (
          <input type="hidden" name="thumbnail_path" value={thumbnailUrl} />
        ) : null}

        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <h2 className="text-xl font-semibold text-white">Edit post</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Update the existing post without breaking its live surface.
          </p>

          {effectiveError ? (
            <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {effectiveError}
            </div>
          ) : null}
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-6">
          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Step 1
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">
              Keep or change post type
            </h3>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setMediaType('image')}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  mediaType === 'image'
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:text-white'
                }`}
              >
                Image post
              </button>

              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  mediaType === 'video'
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:text-white'
                }`}
              >
                Video post
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5">
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
                  onClick={() => setMediaSourceMode('url')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    mediaSourceMode === 'url'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  Keep or change URL
                </button>

                <button
                  type="button"
                  onClick={() => setMediaSourceMode('upload')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    mediaSourceMode === 'upload'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  Upload replacement
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                {mediaSourceMode === 'url' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Media URL
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
                      className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-700"
                    />

                    <p className="mt-2 text-xs text-zinc-500">
                      Keep the current source or replace it with another direct media URL.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Upload replacement {mediaType}
                    </label>

                    <input
                      name="media_file"
                      type="file"
                      accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                      onChange={(event) => setMediaFile(event.target.files?.[0] ?? null)}
                      className="block w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
                    />

                    <p className="mt-2 text-xs text-zinc-500">
                      Current media stays as fallback until you upload a replacement. Image max {formatBytes(MAX_IMAGE_FILE_SIZE)}. Video max {formatBytes(MAX_VIDEO_FILE_SIZE)}.
                    </p>
                  </div>
                )}
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
                        alt="Edited media preview"
                        className="aspect-[4/5] w-full bg-black object-cover"
                      />
                    )
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center text-sm text-zinc-500">
                      Media preview
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {mediaType === 'video' ? (
            <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5">
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
                    onClick={() => setThumbnailSourceMode('url')}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      thumbnailSourceMode === 'url'
                        ? 'border-white bg-white text-black'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    Keep or change URL
                  </button>

                  <button
                    type="button"
                    onClick={() => setThumbnailSourceMode('upload')}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      thumbnailSourceMode === 'upload'
                        ? 'border-white bg-white text-black'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    Upload replacement
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                  {thumbnailSourceMode === 'url' ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">
                        Thumbnail URL
                      </label>

                      <input
                        name="thumbnail_path"
                        type="text"
                        value={thumbnailUrl}
                        onChange={(event) => setThumbnailUrl(event.target.value)}
                        placeholder="https://example.com/video-thumbnail.jpg"
                        className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-700"
                      />

                      <p className="mt-2 text-xs text-zinc-500">
                        Keep the current thumbnail or replace it with another direct image URL.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">
                        Upload replacement thumbnail
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
                        Optional replacement thumbnail. Keep it under {formatBytes(MAX_THUMBNAIL_FILE_SIZE)}.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-zinc-800 bg-black p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Thumbnail preview
                  </p>

                  <div className="mt-3 overflow-hidden rounded-[22px] border border-zinc-800 bg-zinc-950">
                    {resolvedThumbnailPreview ? (
                      <img
                        src={resolvedThumbnailPreview}
                        alt="Edited thumbnail preview"
                        className="aspect-[4/5] w-full bg-black object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center text-sm text-zinc-500">
                        Thumbnail preview
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5">
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
                  placeholder="Update the caption..."
                  className="w-full rounded-[24px] border border-zinc-800 bg-black px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-zinc-500 focus:border-zinc-700"
                />

                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-500">
                    Keep the caption sharper and easier to scan.
                  </span>
                  <span
                    className={
                      MAX_CAPTION_LENGTH - caption.length < 30
                        ? 'text-amber-300'
                        : 'text-zinc-500'
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
                            ? 'border-white bg-white text-black'
                            : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{category.name}</p>
                            <p
                              className={`mt-2 text-xs leading-6 ${
                                active ? 'text-black/70' : 'text-zinc-500'
                              }`}
                            >
                              {formatCategoryDescription(category)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                              active
                                ? 'bg-black/10 text-black'
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
              href={`/post/${post.id}`}
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Cancel
            </Link>

            <div className="w-full sm:w-auto sm:min-w-[220px]">
              <SubmitButton />
            </div>
          </div>
        </div>
      </form>

      <aside className="space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
          <div className="border-b border-zinc-800/80 px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Live preview
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Updated post preview
            </h3>
          </div>

          <div className="p-5">
            <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-black text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  You
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    your_profile
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    Editing existing post
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
                <p className="text-sm font-semibold text-white">Existing post</p>

                <p className="text-sm leading-7 text-zinc-300">
                  <span className="mr-2 font-semibold text-white">your_profile</span>
                  {caption.trim() || 'Your updated caption will preview here.'}
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

        <section className="rounded-[32px] border border-zinc-800/90 bg-black p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Edit checklist
          </p>

          <div className="mt-4 space-y-3">
            <div className="rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4">
              <p className="text-sm font-medium text-white">Media</p>
              <p className="mt-2 text-sm text-zinc-400">
                {editReadiness.mediaReady
                  ? 'Media source is valid'
                  : 'Keep the existing source or provide a valid replacement'}
              </p>
            </div>

            <div className="rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4">
              <p className="text-sm font-medium text-white">Caption</p>
              <p className="mt-2 text-sm text-zinc-400">
                {editReadiness.captionReady
                  ? caption.trim()
                    ? 'Caption looks valid'
                    : 'Caption can remain empty'
                  : 'Caption is too long'}
              </p>
            </div>

            <div className="rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4">
              <p className="text-sm font-medium text-white">Categories</p>
              <p className="mt-2 text-sm text-zinc-400">
                {editReadiness.categoriesReady
                  ? `${selectedCategories.length} category${selectedCategories.length === 1 ? '' : 'ies'} selected`
                  : 'Select at least one category'}
              </p>
            </div>

            {mediaType === 'video' ? (
              <div className="rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4">
                <p className="text-sm font-medium text-white">Thumbnail</p>
                <p className="mt-2 text-sm text-zinc-400">
                  {editReadiness.thumbnailReady
                    ? resolvedThumbnailPreview
                      ? 'Thumbnail preview is ready'
                      : 'Existing thumbnail can remain'
                    : 'Thumbnail input is invalid'}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4">
            <p className="text-sm font-medium text-white">Status</p>
            <p className="mt-2 text-sm text-zinc-400">
              {editReadiness.ready
                ? 'Ready to save changes'
                : 'Complete the missing pieces before saving'}
            </p>
          </div>
        </section>
      </aside>
    </div>
  )
}