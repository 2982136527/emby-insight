import { NextRequest, NextResponse } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth']

// Known static file extensions that don't require auth
const STATIC_EXTENSIONS = new Set([
    '.js', '.css', '.json', '.ico', '.svg', '.png', '.jpg', '.jpeg',
    '.gif', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.map', '.txt',
    '.xml', '.webmanifest',
])

function isStaticFile(pathname: string): boolean {
    if (pathname.startsWith('/_next')) return true
    const dotIndex = pathname.lastIndexOf('.')
    if (dotIndex === -1) return false
    const ext = pathname.slice(dotIndex).toLowerCase()
    return STATIC_EXTENSIONS.has(ext)
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Skip auth for public routes and static files
    if (
        publicRoutes.some((route) => pathname.startsWith(route)) ||
        isStaticFile(pathname)
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
