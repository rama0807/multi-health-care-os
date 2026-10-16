import { NextRequest, NextResponse } from 'next/server'

/**
 * Routes that do not require an active session.
 * The public root '/' is accessible by everyone.
 */
const PUBLIC_PAGES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

/**
 * Authentication flow pages that logged-in users should be redirected away from.
 * Note: The root page '/' is deliberately NOT in this list, allowing authenticated
 * users to inspect the public landing page or access their workspace via the header.
 */
const AUTH_REDIRECT_PAGES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

/**
 * Lightweight heuristic only - checks whether the httpOnly refresh cookie is
 * present to redirect obviously-logged-out/in users. This is NOT the
 * security boundary: the access token lives in memory and is never visible
 * here, so real enforcement is the backend's guards plus the dashboard
 * layout's bootstrap-then-render check in AuthProvider.
 *
 * Both `/dashboard` (Hospital) and `/dental` (Dental OS) are authenticated
 * routes. The middleware cannot determine org type — that decision lives in the
 * respective layout components which read `user.organizationType` from the auth
 * context after the session has been rehydrated.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get('medicore_rt'))
  const { pathname } = request.nextUrl

  const isPublicPage =
    pathname === '/' || PUBLIC_PAGES.some((page) => page !== '/' && pathname.startsWith(page))
  const isAuthRedirectPage = AUTH_REDIRECT_PAGES.some((page) => pathname.startsWith(page))

  // 0. Explicit exception: newly registered users redirected to /login must NOT be bounced to /dashboard.
  // Clear any residual session cookies on this response and allow them to view the sign-in form.
  if (pathname === '/login' && request.nextUrl.searchParams.get('registered') === 'true') {
    const response = NextResponse.next()
    response.cookies.delete('medicore_rt')
    response.cookies.delete('medicore_csrf')
    return response
  }

  // 1. Unauthenticated visitor trying to access a protected application route
  if (!hasSession && !isPublicPage) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // 2. Authenticated user visiting login/register auth flow pages
  if (hasSession && isAuthRedirectPage) {
    // After login the dashboard layout re-routes to /dental if user is a dental tenant
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?|css|js)).*)',
  ],
}

