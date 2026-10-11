'use client'

import { SmartImage } from '@/components/ui/smart-image'

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

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rs-button rs-button-primary" aria-live="polite"
    >
      {pending ? 'Uploading and publishing…' : 'Publish post'}
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

  const mediaObjectUrl = useObjectUrl(mediaFile)
  const thumbnailObjectUrl = useObjectUrl(thumbnailFile)
  const resolvedMediaPreview = mediaSourceMode === 'upload' ? mediaObjectUrl : isDirectPreviewableUrl(mediaPath) ? mediaPath.trim() : ''
  const resolvedThumbnailPreview = mediaType === 'video' ? thumbnailSourceMode === 'upload' ? thumbnailObjectUrl : isDirectPreviewableUrl(thumbnailPath) ? thumbnailPath.trim() : '' : ''

  const selectedCategoryObjects = useMemo(
    () =>
      categories.filter((category) => selectedCategories.includes(category.name)),
    [categories, selectedCategories]
  )

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
        return 'HEIC and HEIF are not supported. Convert the image to JPG, PNG, or WEBP first.'
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
          return 'HEIC and HEIF thumbnails are not supported.'
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
    <form action={submitMedia} onSubmit={handleSubmit} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="media_type" value={mediaType} />
      {selectedCategories.map((name) => <input key={name} type="hidden" name="categories" value={name} />)}
      <div className="min-w-0 space-y-6">
        {effectiveError ? <div role="alert" id="create-error" className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{effectiveError}</div> : null}
        <fieldset className="min-w-0 space-y-4 rounded-xl border border-zinc-800 p-4 sm:p-5">
          <legend className="px-1 text-base font-semibold text-white">Media</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Media type">
            <button type="button" aria-pressed={mediaType === 'image'} onClick={() => setMediaType('image')} className={`rs-button ${mediaType === 'image' ? 'rs-button-primary' : ''}`}>Image</button>
            <button type="button" aria-pressed={mediaType === 'video'} onClick={() => setMediaType('video')} className={`rs-button ${mediaType === 'video' ? 'rs-button-primary' : ''}`}>Video</button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Media source">
            <button type="button" aria-pressed={mediaSourceMode === 'upload'} onClick={() => setMediaSourceMode('upload')} className={`rs-button ${mediaSourceMode === 'upload' ? 'border-violet-400 text-violet-200' : ''}`}>Upload file</button>
            <button type="button" aria-pressed={mediaSourceMode === 'url'} onClick={() => setMediaSourceMode('url')} className={`rs-button ${mediaSourceMode === 'url' ? 'border-violet-400 text-violet-200' : ''}`}>Use a link</button>
          </div>
          {mediaSourceMode === 'upload' ? (
            <div>
              <label htmlFor="post-media" className="mb-2 block text-sm font-medium text-zinc-200">{mediaType === 'image' ? 'Image file' : 'Video file'}</label>
              <input id="post-media" name="media_file" type="file" accept={mediaType === 'image' ? IMAGE_UPLOAD_ACCEPT : VIDEO_UPLOAD_ACCEPT} aria-describedby="post-media-hint" onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null
                if (isHeicLikeFile(nextFile)) {
                  setMediaFile(null)
                  setClientError('HEIC and HEIF are not supported. Use JPG, PNG, or WEBP.')
                  event.currentTarget.value = ''
                  return
                }
                setMediaFile(nextFile)
              }} className="rs-input file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-white" />
              <p id="post-media-hint" className="mt-2 break-words text-xs leading-5 text-zinc-400">{mediaType === 'image' ? 'JPG, PNG, WEBP, or GIF. Maximum 15 MB.' : 'MP4, WEBM, MOV, M4V, OGG, 3GP, or 3G2. Maximum 50 MB.'}{mediaFile ? ` Selected: ${mediaFile.name}.` : ''}</p>
            </div>
          ) : (
            <div>
              <label htmlFor="post-media-url" className="mb-2 block text-sm font-medium text-zinc-200">Media link</label>
              <input id="post-media-url" name="media_path" type="url" value={mediaPath} onChange={(event) => setMediaPath(event.target.value)} className="rs-input" placeholder="https://example.com/photo.jpg" aria-describedby="post-url-hint" />
              <p id="post-url-hint" className="mt-2 text-xs leading-5 text-zinc-400">Use a direct link to an image or video file.</p>
            </div>
          )}
          {mediaType === 'video' ? (
            <fieldset className="min-w-0 space-y-3 border-t border-zinc-800 pt-4">
              <legend className="text-sm font-medium text-zinc-200">Cover image (optional)</legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Cover image source">
                <button type="button" aria-pressed={thumbnailSourceMode === 'upload'} onClick={() => setThumbnailSourceMode('upload')} className="rs-button">Upload cover</button>
                <button type="button" aria-pressed={thumbnailSourceMode === 'url'} onClick={() => setThumbnailSourceMode('url')} className="rs-button">Use cover link</button>
              </div>
              {thumbnailSourceMode === 'upload' ? (
                <div>
                  <label htmlFor="post-thumbnail" className="mb-2 block text-sm text-zinc-200">Cover file</label>
                  <input id="post-thumbnail" name="thumbnail_file" type="file" accept={IMAGE_UPLOAD_ACCEPT} onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null
                    if (isHeicLikeFile(nextFile)) {
                      setThumbnailFile(null)
                      setClientError('HEIC and HEIF covers are not supported. Use JPG, PNG, WEBP, or GIF.')
                      event.currentTarget.value = ''
                      return
                    }
                    setThumbnailFile(nextFile)
                  }} className="rs-input file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-white" />
                  <p className="mt-2 text-xs text-zinc-400">Maximum 10 MB.</p>
                </div>
              ) : (
                <div>
                  <label htmlFor="post-thumbnail-url" className="mb-2 block text-sm text-zinc-200">Cover link</label>
                  <input id="post-thumbnail-url" name="thumbnail_path" type="url" value={thumbnailPath} onChange={(event) => setThumbnailPath(event.target.value)} className="rs-input" placeholder="https://example.com/cover.jpg" />
                </div>
              )}
            </fieldset>
          ) : null}
        </fieldset>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="post-caption" className="text-sm font-medium text-zinc-200">Caption (optional)</label>
            <span id="post-caption-count" className="text-xs text-zinc-400">{caption.length}/{MAX_CAPTION_LENGTH}</span>
          </div>
          <textarea id="post-caption" name="caption" rows={4} value={caption} onChange={(event) => setCaption(event.target.value)} aria-describedby="post-caption-count" placeholder="Add a caption…" className="rs-input resize-y" />
        </div>
        <fieldset className="min-w-0">
          <legend className="text-sm font-medium text-zinc-200">Topics</legend>
          <p id="post-topics-hint" className="mt-1 text-xs leading-5 text-zinc-400">Choose at least one topic.</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-describedby="post-topics-hint">
            {categories.map((category) => {
              const active = selectedCategories.includes(category.name)
              return <button key={category.id} type="button" aria-pressed={active} onClick={() => toggleCategory(category.name)} className={`rs-button max-w-full break-words ${active ? 'border-violet-400 bg-violet-500/15 text-violet-200' : ''}`}>{category.name}</button>
            })}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5">
          <Link href="/feed" className="rs-button">Cancel</Link>
          <SubmitButton />
        </div>
      </div>
      <aside className="min-w-0 self-start rounded-xl border border-zinc-800 lg:sticky lg:top-24">
        <h2 className="border-b border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-200">Preview</h2>
        {resolvedMediaPreview ? (
          mediaType === 'video' ? <video src={resolvedMediaPreview} controls playsInline preload="metadata" poster={resolvedThumbnailPreview || undefined} aria-label="Post video preview" className="aspect-[4/5] max-h-[520px] w-full bg-black object-contain" /> : <SmartImage src={resolvedMediaPreview} alt="Selected post image preview" loading="eager" className="aspect-[4/5] max-h-[520px] w-full bg-black object-contain" fallbackClassName="flex aspect-[4/5] max-h-[520px] w-full items-center justify-center bg-black p-6 text-center text-sm text-zinc-400" fallbackText="Image preview unavailable. Choose another file or link." />
        ) : <div className="flex aspect-square items-center justify-center p-6 text-center text-sm text-zinc-400">Choose media to see a preview.</div>}
        {caption.trim() ? <p className="whitespace-pre-wrap break-words border-t border-zinc-800 p-4 text-sm leading-6 text-zinc-200">{caption}</p> : null}
        {selectedCategoryObjects.length ? <p className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">{selectedCategoryObjects.map((category) => category.name).join(' · ')}</p> : null}
      </aside>
    </form>
  )
}
