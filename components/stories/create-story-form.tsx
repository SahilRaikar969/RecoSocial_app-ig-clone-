'use client'

import Link from 'next/link'
import { createStory } from '@/actions/stories'

type CreateStoryFormProps = {
  errorMessage?: string
}

export function CreateStoryForm({ errorMessage = '' }: CreateStoryFormProps) {
  return (
    <form
      action={createStory}
      className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
    >
      <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-violet-200">
        Story composer
      </div>

      <h1 className="mt-4 text-2xl font-semibold text-white">Create story</h1>
      <p className="mt-3 text-sm leading-7 text-zinc-400">
        Upload a lightweight image or video story. Stories automatically expire after 6 hours.
      </p>

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Media type
          </label>
          <select
            name="media_type"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
            defaultValue="image"
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Caption
          </label>
          <input
            name="caption"
            type="text"
            maxLength={180}
            placeholder="Optional short caption"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Upload media
          </label>
          <input
            name="media_file"
            type="file"
            accept="image/*,video/*"
            className="block w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Use upload first. Direct URL is optional if you already host media elsewhere.
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Media URL fallback
          </label>
          <input
            name="media_path"
            type="text"
            placeholder="https://example.com/story.jpg"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Thumbnail for video
          </label>
          <input
            name="thumbnail_file"
            type="file"
            accept="image/*"
            className="block w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Thumbnail URL fallback
          </label>
          <input
            name="thumbnail_path"
            type="text"
            placeholder="https://example.com/story-thumb.jpg"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/feed"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Cancel
        </Link>

        <button
          type="submit"
          className="rounded-2xl border border-white bg-[linear-gradient(90deg,#ffffff_0%,#f4f4ff_100%)] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Publish story
        </button>
      </div>
    </form>
  )
}