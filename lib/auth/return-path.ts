import { isPublicRoute } from '@/lib/auth/public-routes'
import {safeReturnPath} from '@/lib/routes/safe-return-path'
export function authReturnPath(value:string) {
  const target=safeReturnPath(value)
  return /^\/(?:login|signup|reset-password|forgot-password|auth)(?:[/?#]|$)/.test(target) ? '/feed' : target
}

/** Keep the sign-in destination separately; guests can only resume public pages. */
export function guestReturnPath(value: string) {
  const target = authReturnPath(value)
  return isPublicRoute(new URL(target, 'https://recosocial.invalid').pathname) ? target : '/feed'
}
