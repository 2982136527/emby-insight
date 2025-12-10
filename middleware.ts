import { NextRequest, NextResponse } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth']

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Skip auth for public routes and static files
    if (
        publicRoutes.some((route) => pathname.startsWith(route)) ||
        pathname.startsWith('/_next') ||
        pathname.includes('.')
    ) {
        return NextResponse.next()
    }

    // Check for auth cookie
    const authCookie = request.cookies.get('emby-insight-auth')

    if (authCookie?.value !== 'authenticated') {
        // Redirect to login
        const loginUrl = new URL('/login', request.url)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
