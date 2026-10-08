import type { Database } from '@/lib/supabase/database.types'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
]

const PUBLIC_EXACT_PATHS = [
  '/',
]

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf)$/.test(pathname)
  )
}

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) return true

  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isStaticAsset(pathname)) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          const previousCookies = response.cookies.getAll()
          response = NextResponse.next({ request })
          previousCookies.forEach((cookie) => response.cookies.set(cookie))
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    redirectResponse.headers.set('Cache-Control', 'private, no-store')
    return redirectResponse
  }

  const publicPath = isPublicPath(pathname)

  if (!user && !publicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return redirectWithCookies(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/feed'
    url.search = ''
    return redirectWithCookies(url)
  }

  response.headers.set('Cache-Control', 'private, no-store')

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf)$).*)',
  ],
}