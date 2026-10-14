import { isPublicRoute } from '@/lib/auth/public-routes'
import { authReturnPath as safeReturnPath } from '@/lib/auth/return-path'
import type { Database } from '@/lib/supabase/database.types'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isStaticAsset(pathname: string) {
  return (
    pathname === '/demo/recosocial-v1/loop.webm' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf)$/.test(pathname)
  )
}

export async function proxy(request: NextRequest) {
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
    data: { user: verifiedUser },
    error: authError,
  } = await supabase.auth.getUser()
  const user = authError ? null : verifiedUser

  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    redirectResponse.headers.set('Cache-Control', 'private, no-store')
    return redirectResponse
  }

  const publicPath = isPublicRoute(pathname)

  // Page redirects apply to navigation only. Server Actions and API handlers
  // authenticate independently and must produce their own response format.
  const isNavigation = request.method === 'GET' || request.method === 'HEAD'

  if (isNavigation && !user && !publicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', safeReturnPath(request.nextUrl.pathname + request.nextUrl.search))
    url.searchParams.set('reason', 'continue')
    return redirectWithCookies(url)
  }

  if (isNavigation && user && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
    const url = request.nextUrl.clone()
    const destination=new URL(safeReturnPath(request.nextUrl.searchParams.get('next') || '/feed'), request.url)
    url.pathname = destination.pathname
    url.search = destination.search
    return redirectWithCookies(url)
  }

  // Bind rendered client state to this request's verified identity. Always
  // overwrite incoming values; this header never authorizes data access.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-recosocial-viewer-id', user?.id || '')
  const previousCookies = response.cookies.getAll()
  response = NextResponse.next({ request: { headers: requestHeaders } })
  previousCookies.forEach(cookie => response.cookies.set(cookie))
  response.headers.set('Cache-Control', 'private, no-store')

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|demo/recosocial-v1/loop\\.webm$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf)$).*)',
  ],
}