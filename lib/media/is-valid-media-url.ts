function hasAllowedExtension(pathname: string) {
  const cleanPath = pathname.toLowerCase()

  return (
    cleanPath.endsWith('.jpg') ||
    cleanPath.endsWith('.jpeg') ||
    cleanPath.endsWith('.png') ||
    cleanPath.endsWith('.webp') ||
    cleanPath.endsWith('.gif') ||
    cleanPath.endsWith('.mp4') ||
    cleanPath.endsWith('.webm') ||
    cleanPath.endsWith('.mov')
  )
}

function isSupabaseStorageUrl(url: URL) {
  return /\/storage\/v1\/object\/(?:public|sign)\//i.test(url.pathname)
}

export function isValidMediaUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return false

  try {
    const url = new URL(trimmed)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return false
    }

    if (hasAllowedExtension(url.pathname)) {
      return true
    }

    if (isSupabaseStorageUrl(url)) {
      return true
    }

    return false
  } catch {
    return false
  }
}