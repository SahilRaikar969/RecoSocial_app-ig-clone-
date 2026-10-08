const RETURN_ORIGIN = 'https://recosocial.invalid'

function validatedPath(value: string) {
  const path = value.trim()

  if (!path.startsWith('/') || path.startsWith('//')) return null

  // Validate before URL parsing, which silently strips control characters and
  // normalizes backslashes. Reject encoded variants, including nested encoding.
  let decoded = value
  for (let depth = 0; depth < 5; depth += 1) {
    if (/[\\\u0000-\u001f\u007f]/.test(decoded) || /%(?:2f|5c)/i.test(decoded)) {
      return null
    }

    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      return null
    }
    if (next === decoded) break
    if (depth === 4) return null
    decoded = next
  }

  const url = new URL(path, RETURN_ORIGIN)
  if (url.origin !== RETURN_ORIGIN || url.pathname.startsWith('//')) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/** Accept only an application-local, root-relative redirect destination. */
export function safeReturnPath(value: string, fallback = '/feed') {
  return validatedPath(value) ?? validatedPath(fallback) ?? '/feed'
}

/** Merge raw parameter values without losing an existing query or fragment. */
export function buildReturnUrl(
  returnTo: string,
  params: Record<string, string>,
  fallback = '/feed'
) {
  const url = new URL(safeReturnPath(returnTo, fallback), RETURN_ORIGIN)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return `${url.pathname}${url.search}${url.hash}`
}
