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
  if (!items.length) {
    return (
      <section aria-label="Stories" className="border-b border-zinc-800">
        <Link href="/stories/create" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white">
          <Plus aria-hidden="true" className="h-4 w-4" />Add story
        </Link>
      </section>
    )
  }

  return (
    <section className="border-b border-zinc-800 pb-4" aria-label="Stories">
      <div className="overflow-x-auto pb-1" data-disable-camera-swipe="true">
        <div className="flex min-w-max gap-3">
          <Link href="/stories/create" className="flex w-[68px] shrink-0 flex-col items-center gap-2 rounded-lg text-zinc-300 hover:text-white">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-zinc-600 bg-zinc-900"><Plus className="h-5 w-5" /></span>
            <span className="text-xs">Add story</span>
          </Link>
          {items.map(item => <Link key={item.author.id} href={'/stories/' + item.first_story_id}
            aria-label={(item.is_own_story ? 'Your story' : item.author.username + ' story') + (item.has_unviewed ? ', unseen' : ', viewed')}
            className="group flex w-[68px] shrink-0 flex-col items-center gap-2 rounded-lg">
            <span className={'rounded-full border-2 p-0.5 ' + (item.has_unviewed ? 'border-violet-400' : 'border-zinc-700')}>
              <SmartImage src={item.author.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover"
                fallbackClassName="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-sm text-zinc-300" fallbackText={item.author.username.slice(0, 1).toUpperCase()} />
            </span>
            <span className="max-w-[68px] truncate text-xs text-zinc-300 group-hover:text-white">{item.is_own_story ? 'Your story' : item.author.username}</span>
          </Link>)}
        </div>
      </div>
    </section>
  )
}
