export const IMAGE_STORY_MS = 6000

export function advanceStoryTime(elapsed: number, delta: number, duration: number, paused: boolean) {
  if (paused || !Number.isFinite(delta) || delta <= 0) return elapsed
  return Math.min(Math.max(1, duration), Math.max(0, elapsed) + delta)
}

export function storyDestination(index: number, count: number, direction: 'next' | 'previous', adjacent: string | null) {
  const next = index + (direction === 'next' ? 1 : -1)
  if (next >= 0 && next < count) return { index: next, href: null }
  return { index: null, href: adjacent ? '/stories/' + encodeURIComponent(adjacent) : direction === 'next' ? '/feed' : null }
}

export function isStoryExpired(expiresAt: string, now = Date.now()) {
  const deadline = Date.parse(expiresAt)
  return Number.isFinite(deadline) && deadline <= now
}
