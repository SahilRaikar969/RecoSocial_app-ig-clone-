'use client'

import Link from 'next/link'
import { SmartImage } from '@/components/ui/smart-image'
import { useObjectUrl } from '@/lib/media/use-object-url'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useMediaFormAction } from '@/lib/media/use-media-form-action'
import { createStory } from '@/actions/stories'

type CreateStoryFormProps = {
  errorMessage?: string
}

function StorySubmit() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="rs-button rs-button-primary" aria-live="polite">{pending ? 'Publishing...' : 'Publish story'}</button>
}

export function CreateStoryForm({ errorMessage = '' }: CreateStoryFormProps) {
  const [clientError, setClientError] = useState('')
  const [mediaType, setMediaType] = useState('image')
  const [caption, setCaption] = useState('')
  const [mediaPath, setMediaPath] = useState('')
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const submitMedia = useMediaFormAction(createStory, 'story', setClientError, { media_file: mediaFile, thumbnail_file: mediaType === 'video' ? thumbnailFile : null })
  const preview = useObjectUrl(mediaFile)
  const coverPreview = useObjectUrl(thumbnailFile)
  const safeLink = (value: string) => { try { return ['https:', 'http:'].includes(new URL(value).protocol) ? value : '' } catch { return '' } }
  const mediaPreview = preview || safeLink(mediaPath)
  const effectiveError = clientError || errorMessage
  return (
    <form
      action={submitMedia}
      className="space-y-5"
    >
      <h1 className="mt-4 text-2xl font-semibold text-white">Create story</h1>
      <p className="mt-3 text-sm leading-7 text-zinc-400">
        Stories disappear after 6 hours.
      </p>

      {effectiveError ? (
        <div role="alert" className="mt-5 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {effectiveError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="story-media-type" className="mb-2 block text-sm font-medium text-zinc-300">
            Media type
          </label>
          <select
            id="story-media-type" name="media_type"
            className="rs-input"
            value={mediaType} onChange={event => { setMediaType(event.target.value); setMediaFile(null); setMediaPath(''); setThumbnailFile(null); setThumbnailPath(''); setClientError('') }}
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>

        <div>
          <label htmlFor="story-caption" className="mb-2 block text-sm font-medium text-zinc-300">
            Caption
          </label>
          <input
            id="story-caption" name="caption" value={caption} onChange={event => setCaption(event.target.value)}
            type="text"
            maxLength={180}
            placeholder="Optional short caption"
            className="rs-input"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="story-media_file" className="mb-2 block text-sm font-medium text-zinc-300">
            Upload media
          </label>
          <input
            id="story-media_file" name="media_file" key={mediaType} onChange={event => {
              const file = event.target.files?.[0] || null
              if (file && (!file.size || file.size > (mediaType === 'image' ? 12 : 35) * 1024 * 1024 || !file.type.startsWith(mediaType + '/'))) {
                setClientError(mediaType === 'image' ? 'Choose an image up to 12 MB.' : 'Choose a video up to 35 MB.')
                event.target.value = ''
                setMediaFile(null)
                return
              }
              setMediaFile(file); setMediaPath(''); setClientError('')
            }}
            type="file"
            accept={mediaType === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : 'video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg,video/3gpp,video/3gpp2'}
            className="rs-input file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-white"
          />
          <p className="mt-2 break-words text-xs text-zinc-400">
            {mediaFile ? `Selected: ${mediaFile.name}. Retained for retry.` : 'Choose a file, or paste a direct media link below.'}
          </p>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="story-media_path" className="mb-2 block text-sm font-medium text-zinc-300">
            Or use a media link
          </label>
          <input
            id="story-media_path" name="media_path" value={mediaPath} onChange={event => { setMediaPath(event.target.value); setMediaFile(null) }}
            type="text"
            placeholder="https://example.com/story.jpg"
            className="rs-input"
          />
        </div>

        {mediaType === 'video' ? <><div className="md:col-span-2">
          <label htmlFor="story-thumbnail_file" className="mb-2 block text-sm font-medium text-zinc-300">
            Video cover (optional)
          </label>
          <input
            id="story-thumbnail_file" name="thumbnail_file" onChange={event => setThumbnailFile(event.target.files?.[0] || null)}
            type="file"
            accept="image/*"
            className="rs-input file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-white"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="story-thumbnail_path" className="mb-2 block text-sm font-medium text-zinc-300">
            Or use a cover link
          </label>
          <input
            id="story-thumbnail_path" name="thumbnail_path" value={thumbnailPath} onChange={event => { setThumbnailPath(event.target.value); setThumbnailFile(null) }}
            type="text"
            placeholder="https://example.com/story-thumb.jpg"
            className="rs-input"
          />
        </div></> : null}
      </div>

      {mediaPreview ? <section aria-label="Story preview" className="mx-auto aspect-[9/16] max-h-[60svh] max-w-sm overflow-hidden rounded-xl bg-black">
        {mediaType === 'image' ? <SmartImage src={mediaPreview} alt={caption || 'Selected story image preview'} loading="eager" className="h-full w-full object-contain" fallbackClassName="flex h-full w-full items-center justify-center px-6 text-center text-sm text-zinc-400" fallbackText="Image preview unavailable. Choose another file or link." /> : <video key={mediaPreview} src={mediaPreview} poster={coverPreview || safeLink(thumbnailPath) || undefined} controls playsInline preload="metadata" className="h-full w-full object-contain" onError={() => setClientError('This video could not be previewed. Check its format or choose another file.')} />}
      </section> : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/feed"
          className="rs-button"
        >
          Cancel
        </Link>

        <StorySubmit />
      </div>
    </form>
  )
}