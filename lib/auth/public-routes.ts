const UUID='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
export function isPublicRoute(pathname:string) {
  return ['/', '/feed', '/explore', '/login','/signup','/forgot-password','/reset-password'].includes(pathname) || new RegExp('^/(?:post|profile|reel|stories)/'+UUID+'$').test(pathname)
}
