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

export async function getMediaUrl(path: string | null | undefined) {
  const trimmed = String(path || '').trim()

  if (!trimmed) {
    return null
  }

  if (isDirectBrowserUrl(trimmed)) {
    return trimmed
  }

  // Keep signing tokens and foreign origins intact.
  if (isAbsoluteUrl(trimmed)) return trimmed

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '')

  if (/^\/?storage\/v1\/object\/sign\/media\//i.test(trimmed)) {
    return supabaseUrl ? supabaseUrl + '/' + trimmed.replace(/^\//, '') : null
  }

  const normalizedPath = normalizeStoragePath(trimmed)

  if (!supabaseUrl || !normalizedPath) {
    return null
  }

  return `${supabaseUrl}/storage/v1/object/public/media/${encodePathSegments(normalizedPath)}`
}