import { Bookmark, Compass, Home, PlusSquare, User } from 'lucide-react'

export const primaryNavigation = [
  { href: '/feed', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/create', label: 'Create', icon: PlusSquare },
  { href: '/saved', label: 'Saved', icon: Bookmark },
  { href: '/profile', label: 'Profile', icon: User },
] as const

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}
