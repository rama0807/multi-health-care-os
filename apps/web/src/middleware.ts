import { NextRequest, NextResponse } from 'next/server'

const AUTH_PAGES = ['/login', '/forgot-password', '/reset-password', '/verify-email']

/**
 * Lightweight heuristic only - checks whether the httpOnly refresh cookie is
 * present to redirect obviously-logged-out/in users. This is NOT the
 * security boundary: the access token lives in memory and is never visible
 * here, so real enforcement is the backend's guards plus the dashboard
 * layout's bootstrap-then-render check in AuthProvider.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get('medicore_rt'))
  const { pathname } = request.nextUrl

  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page))

  if (!hasSession && !isAuthPage) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
