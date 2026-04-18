import Link from 'next/link'
import { Plus } from 'lucide-react'
import { SmartImage } from '@/components/ui/smart-image'

type StoryRailItem = {
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string | null
  }
  story_count: number
  first_story_id: string
  preview_url?: string | null
  has_unviewed: boolean
  is_own_story: boolean
}

type StoryRailProps = {
  items: StoryRailItem[]
}

export function StoryRail({ items }: StoryRailProps) {
  return (
    <section className="rounded-[26px] md:rounded-[28px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.20)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-violet-200">
            Stories
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Lightweight image and video stories that disappear after 6 hours.
          </p>
        </div>

        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-2xl border border-white bg-[linear-gradient(90deg,#ffffff_0%,#f3f3ff_100%)] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Profile
        </Link>
      </div>

      <div className="-mx-1 overflow-x-auto px-1" data-disable-camera-swipe="true">
        <div className="flex min-w-max gap-3 md:gap-4">
          {items.map((item) => (
            <Link
              key={item.author.id}
              href={`/stories/${item.first_story_id}`}
              className="group flex w-[78px] md:w-[84px] shrink-0 flex-col items-center gap-2"
            >
              <div
                className={`rounded-full p-[2px] transition ${
                  item.has_unviewed
                    ? 'bg-[linear-gradient(180deg,rgba(236,72,153,0.95),rgba(120,119,255,0.95))]'
                    : 'bg-zinc-800'
                }`}
              >
                <div className="rounded-full bg-black p-[2px]">
                  <SmartImage
                    src={item.author.avatar_url}
                    alt={item.author.display_name}
                    className="h-[66px] w-[66px] md:h-[72px] md:w-[72px] rounded-full object-cover"
                    fallbackClassName="flex h-[66px] w-[66px] md:h-[72px] md:w-[72px] items-center justify-center rounded-full bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500"
                    fallbackText="Story"
                  />
                </div>
              </div>

              <span className="max-w-[78px] md:max-w-[84px] truncate text-center text-[11px] md:text-xs leading-4 text-zinc-300 group-hover:text-white">
                {item.is_own_story ? 'Your story' : item.author.username}
              </span>
            </Link>
          ))}

          {!items.length ? (
            <div className="flex h-[102px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 px-5 text-sm text-zinc-500">
              No active stories yet
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}