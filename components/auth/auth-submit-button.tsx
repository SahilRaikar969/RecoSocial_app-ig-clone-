'use client'

import { useFormStatus } from 'react-dom'

export function AuthSubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="rs-button rs-button-primary w-full" aria-live="polite">
      {pending ? pendingLabel : children}
    </button>
  )
}
