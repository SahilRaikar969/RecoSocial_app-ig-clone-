'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'

function subscribeStorage(notify: () => void) {
  window.addEventListener('storage', notify)
  return () => window.removeEventListener('storage', notify)
}
const mutedOnServer = () => true

/** Read browser preferences after hydration; only a user toggle writes them. */
export function useMutedPreference(storageKey: string) {
  const readMuted = useCallback(() => {
    try { return window.localStorage.getItem(storageKey) !== '0' }
    catch { return true }
  }, [storageKey])
  const storedMuted = useSyncExternalStore(subscribeStorage, readMuted, mutedOnServer)
  const [override, setOverride] = useState<boolean | null>(null)
  const muted = override ?? storedMuted

  function toggleMuted() {
    const next = !muted
    setOverride(next)
    try { window.localStorage.setItem(storageKey, next ? '1' : '0') }
    catch { /* Playback controls still work when browser storage is unavailable. */ }
  }

  return [muted, toggleMuted] as const
}
