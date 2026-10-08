'use client'

import { useRef } from 'react'
import { createMediaUploadSession, type MediaFormKind } from '@/lib/media/direct-upload'

type MediaAction = (form: FormData) => Promise<void | { ok: false; error: string }>

export function useMediaFormAction(action: MediaAction, kind: MediaFormKind, onError: (message: string) => void, retainedFiles: Record<string, File | null> = {}) {
  const session = useRef<ReturnType<typeof createMediaUploadSession> | null>(null)
  const mutationId = useRef('')
  const busy = useRef(false)
  return async (form: FormData) => {
    if (busy.current) return
    busy.current = true
    onError('')
    let prepared: FormData
    try {
      // React resets uncontrolled file inputs when a form action resolves, including
      // a handled failure. Preserve the composer's selected File for an explicit retry.
      for (const [field, file] of Object.entries(retainedFiles)) {
        if (file) form.set(field, file)
        else form.delete(field)
      }
      session.current ??= createMediaUploadSession()
      mutationId.current ||= crypto.randomUUID()
      prepared = await session.current(form, kind, mutationId.current)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to prepare the upload.')
      busy.current = false
      return
    }
    try {
      const result = await action(prepared)
      if (result && !result.ok) onError(result.error)
    } catch (error) {
      // Next uses a thrown redirect for successful actions; let React handle it.
      if (typeof error === 'object' && error !== null && 'digest' in error && String(error.digest).startsWith('NEXT_REDIRECT')) throw error
      onError('The save outcome could not be confirmed. Check your profile before retrying. Your upload has been retained.')
    } finally { busy.current = false }
  }
}
