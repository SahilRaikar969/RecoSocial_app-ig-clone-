import { Suspense } from 'react'
import { AuthFrame } from '@/components/auth/auth-frame'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata = { title: "Reset password" }

export default function ResetPasswordPage() {
  return <AuthFrame><Suspense fallback={<p role="status" className="text-sm text-zinc-300">Preparing password recovery…</p>}><ResetPasswordForm /></Suspense></AuthFrame>
}
