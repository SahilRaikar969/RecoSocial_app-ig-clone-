'use client'

import { useState } from 'react'
import { createPost } from '@/actions/posts'

const CATEGORY_OPTIONS = [
  'Tech',
  'Gaming',
  'Fitness',
  'Fashion',
  'Food',
  'Travel',
  'Education',
  'Entertainment',
  'Music',
  'Sports',
]

export function CreatePostForm() {
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')

  return (
    <form action={createPost} className="space-y-6">
      <div>
        <label className="mb-2 block text-sm text-zinc-300">Dev Profile ID</label>
        <input
          name="dev_profile_id"
          type="text"
          defaultValue="cc1f8669-c7b3-4fa5-9393-2f9ffac474a1"
          placeholder="Paste your profile UUID from Supabase"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
        />
        <p className="mt-2 text-xs text-zinc-500">
          Temporary dev bypass until auth session is fixed.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Caption</label>
        <textarea
          name="caption"
          rows={4}
          placeholder="Write a caption..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Media type</label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200">
            <input
              type="radio"
              name="media_type"
              value="image"
              checked={mediaType === 'image'}
              onChange={() => setMediaType('image')}
            />
            <span>Image</span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200">
            <input
              type="radio"
              name="media_type"
              value="video"
              checked={mediaType === 'video'}
              onChange={() => setMediaType('video')}
            />
            <span>Video</span>
          </label>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Media URL</label>
        <input
          name="media_path"
          type="text"
          placeholder="Paste a temporary media URL"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
        />
        <p className="mt-2 text-xs text-zinc-500">
          Temporary input only. Real file upload comes next.
        </p>
      </div>

      {mediaType === 'video' && (
        <div>
          <label className="mb-2 block text-sm text-zinc-300">Thumbnail URL</label>
          <input
            name="thumbnail_path"
            type="text"
            placeholder="Paste a temporary thumbnail URL"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Categories</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CATEGORY_OPTIONS.map((category) => (
            <label
              key={category}
              className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200"
            >
              <input type="checkbox" name="categories" value={category} />
              <span>{category}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
      >
        Create post
      </button>
    </form>
  )
}