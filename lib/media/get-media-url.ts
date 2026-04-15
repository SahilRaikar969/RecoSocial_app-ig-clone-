function isAbsoluteUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

function isDirectBrowserUrl(value: string) {
  return (
    value.startsWith('blob:') ||
    value.startsWith('data:image/') ||
    value.startsWith('data:video/')
  )
}

function stripQueryAndHash(value: string) {
  return value.split('#')[0].split('?')[0]
}

function normalizeStoragePath(value: string) {
  let normalized = stripQueryAndHash(value.trim()).replace(/^\/+/, '')

  normalized = normalized.replace(/^storage\/v1\/object\/public\/media\//i, '')
  normalized = normalized.replace(/^storage\/v1\/object\/sign\/media\//i, '')
  normalized = normalized.replace(/^media\//i, '')

  return normalized
}

function encodePathSegments(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment))
      } catch {
        return encodeURIComponent(segment)
      }
    })
    .join('/')
}

function tryExtractMediaPathFromAbsoluteUrl(value: string) {
  try {
    const url = new URL(value)
    const pathname = url.pathname.replace(/^\/+/, '')

    const publicPrefix = 'storage/v1/object/public/media/'
    const signedPrefix = 'storage/v1/object/sign/media/'

    if (pathname.startsWith(publicPrefix)) {
      return pathname.slice(publicPrefix.length)
    }

    if (pathname.startsWith(signedPrefix)) {
      return pathname.slice(signedPrefix.length)
    }

    return null
  } catch {
    return null
  }
}

export async function getMediaUrl(path: string | null | undefined) {
  const trimmed = String(path || '').trim()

  if (!trimmed) {
    return null
  }

  if (isDirectBrowserUrl(trimmed)) {
    return trimmed
  }

  if (isAbsoluteUrl(trimmed)) {
    const extractedMediaPath = tryExtractMediaPathFromAbsoluteUrl(trimmed)

    if (!extractedMediaPath) {
      return trimmed
    }

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .trim()
      .replace(/\/$/, '')

    if (!supabaseUrl) {
      return trimmed
    }

    return `${supabaseUrl}/storage/v1/object/public/media/${encodePathSegments(extractedMediaPath)}`
  }

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '')

  const normalizedPath = normalizeStoragePath(trimmed)

  if (!supabaseUrl || !normalizedPath) {
    return null
  }

  return `${supabaseUrl}/storage/v1/object/public/media/${encodePathSegments(normalizedPath)}`
}