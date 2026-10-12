'use client'

import { SmartImage } from '@/components/ui/smart-image'

import Link from 'next/link'
import { useObjectUrl } from '@/lib/media/use-object-url'
import { useMediaFormAction } from '@/lib/media/use-media-form-action'
import { useMemo, useState } from 'react'
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
  thumbnail_path: string | null
  updated_at: string
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

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rs-button rs-button-primary" aria-live="polite"
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
        .filter((name): name is string => Boolean(name)),
    [post.post_categories]
  )

  const [mediaSourceMode, setMediaSourceMode] = useState<'url' | 'upload'>('url')
  const [thumbnailSourceMode, setThumbnailSourceMode] = useState<'url' | 'upload'>(
    post.media_type === 'video' ? 'url' : 'upload'
  )

  const [mediaType, setMediaType] = useState<'image' | 'video'>(post.media_type)
  const [caption, setCaption] = useState(post.caption || '')
  const [mediaUrl, setMediaUrl] = useState(post.media_path || '')
  const [enteredThumbnailUrl, setThumbnailUrl] = useState(post.thumbnail_path || '')
  const thumbnailUrl = mediaType === 'video' ? enteredThumbnailUrl || post.thumbnail_path || '' : ''

  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)

  const mediaPreviewUrl = useObjectUrl(mediaFile)
  const thumbnailPreviewUrl = useObjectUrl(thumbnailFile)

  const [selectedCategories, setSelectedCategories] = useState<string[]>(existingCategoryNames)
  const [clientError, setClientError] = useState('')
  const submitMedia = useMediaFormAction(updatePost, 'post', setClientError, {
    media_file: mediaSourceMode === 'upload' ? mediaFile : null,
    thumbnail_file: mediaType === 'video' && thumbnailSourceMode === 'upload' ? thumbnailFile : null,
  })

  function changeMediaType(nextType: 'image' | 'video') {
    setClientError('')
    setMediaType(nextType)
    if (nextType === 'image') {
      setThumbnailFile(null)
      setThumbnailUrl('')
    }
  }

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
    <form action={submitMedia} onSubmit={handleSubmit} onChangeCapture={() => setClientError('')} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <input type="hidden" name="post_id" value={post.id} />
      <input type="hidden" name="expected_updated_at" value={post.updated_at} />
      <input type="hidden" name="dev_profile_id" value={profileId} />
      <input type="hidden" name="return_to" value={`/post/${post.id}/edit`} />
      {mediaSourceMode === 'upload' ? <input type="hidden" name="media_path" value={mediaUrl} /> : null}
      {mediaType === 'video' && thumbnailSourceMode === 'upload' ? <input type="hidden" name="thumbnail_path" value={thumbnailUrl} /> : null}
      <input type="hidden" name="media_type" value={mediaType} />
      {selectedCategories.map((name) => <input key={name} type="hidden" name="categories" value={name} />)}
      <div className="min-w-0 space-y-6">
        {effectiveError ? <div role="alert" id="create-error" className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{effectiveError}</div> : null}
        <fieldset className="min-w-0 space-y-4 rounded-xl border border-zinc-800 p-4 sm:p-5">
          <legend className="px-1 text-base font-semibold text-white">Media</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Media type">
            <button type="button" aria-pressed={mediaType === 'image'} onClick={() => changeMediaType('image')} className={`rs-button ${mediaType === 'image' ? 'rs-button-primary' : ''}`}>Image</button>
            <button type="button" aria-pressed={mediaType === 'video'} onClick={() => changeMediaType('video')} className={`rs-button ${mediaType === 'video' ? 'rs-button-primary' : ''}`}>Video</button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Media source">
            <button type="button" aria-pressed={mediaSourceMode === 'upload'} onClick={() => { setClientError(''); setMediaSourceMode('upload') }} className={`rs-button ${mediaSourceMode === 'upload' ? 'border-violet-400 text-violet-200' : ''}`}>Upload replacement</button>
            <button type="button" aria-pressed={mediaSourceMode === 'url'} onClick={() => { setClientError(''); setMediaSourceMode('url') }} className={`rs-button ${mediaSourceMode === 'url' ? 'border-violet-400 text-violet-200' : ''}`}>Keep or change link</button>
          </div>
          {mediaSourceMode === 'upload' ? (
            <div>
              <label htmlFor="post-media" className="mb-2 block text-sm font-medium text-zinc-200">{mediaType === 'image' ? 'Image file' : 'Video file'}</label>
              <input id="post-media" name="media_file" type="file" accept={mediaType === 'image' ? 'image/*' : 'video/*'} aria-describedby="post-media-hint" onChange={(event) => setMediaFile(event.target.files?.[0] ?? null)} className="rs-input file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-white" />
              <p id="post-media-hint" className="mt-2 break-words text-xs leading-5 text-zinc-400">{mediaType === 'image' ? 'JPG, PNG, WEBP, or GIF. Maximum 15 MB.' : 'MP4, WEBM, MOV, M4V, OGG, 3GP, or 3G2. Maximum 50 MB.'}{mediaFile ? ` Selected: ${mediaFile.name}.` : ''}</p>
            </div>
          ) : (
            <div>
              <label htmlFor="post-media-url" className="mb-2 block text-sm font-medium text-zinc-200">Media link</label>
              <input id="post-media-url" name="media_path" type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} className="rs-input" placeholder="https://example.com/photo.jpg" aria-describedby="post-url-hint" />
              <p id="post-url-hint" className="mt-2 text-xs leading-5 text-zinc-400">Keep the existing link or enter a new direct media link.</p>
            </div>
          )}
          {mediaType === 'video' ? (
            <fieldset className="min-w-0 space-y-3 border-t border-zinc-800 pt-4">
              <legend className="text-sm font-medium text-zinc-200">Cover image (optional)</legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Cover image source">
                <button type="button" aria-pressed={thumbnailSourceMode === 'upload'} onClick={() => { setClientError(''); setThumbnailSourceMode('upload') }} className="rs-button">Upload cover</button>
                <button type="button" aria-pressed={thumbnailSourceMode === 'url'} onClick={() => { setClientError(''); setThumbnailSourceMode('url') }} className="rs-button">Use cover link</button>
              </div>
              {thumbnailSourceMode === 'upload' ? (
                <div>
                  <label htmlFor="post-thumbnail" className="mb-2 block text-sm text-zinc-200">Cover file</label>
                  <input id="post-thumbnail" name="thumbnail_file" type="file" accept={'image/*'} onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)} className="rs-input file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-white" />
                  <p className="mt-2 text-xs text-zinc-400">Maximum 10 MB.</p>
                </div>
              ) : (
                <div>
                  <label htmlFor="post-thumbnail-url" className="mb-2 block text-sm text-zinc-200">Cover link</label>
                  <input id="post-thumbnail-url" name="thumbnail_path" type="url" value={thumbnailUrl} onChange={(event) => setThumbnailUrl(event.target.value)} className="rs-input" placeholder="https://example.com/cover.jpg" />
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
          <textarea id="post-caption" name="caption" rows={4} maxLength={MAX_CAPTION_LENGTH} value={caption} onChange={(event) => setCaption(event.target.value)} aria-describedby="post-caption-count" placeholder="Add a caption…" className="rs-input resize-y" />
        </div>
        <fieldset className="min-w-0">
          <legend className="text-sm font-medium text-zinc-200">Topics</legend>
          <p id="post-topics-hint" className="mt-1 text-xs leading-5 text-zinc-400">Choose at least one topic.</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-describedby="post-topics-hint">
            {categories.map((category) => {
              const active = selectedCategories.includes(category.name)
              return <button key={category.id} type="button" aria-pressed={active} onClick={() => { setClientError(''); handleCategoryToggle(category.name) }} className={`rs-button max-w-full break-words ${active ? 'border-violet-400 bg-violet-500/15 text-violet-200' : ''}`}>{category.name}</button>
            })}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5">
          <Link href={`/post/${post.id}`} className="rs-button">Cancel</Link>
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
