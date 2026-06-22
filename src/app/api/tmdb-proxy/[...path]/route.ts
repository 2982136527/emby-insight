import { NextRequest, NextResponse } from 'next/server'
import { handleTmdbRequest, parseApiType, logApiCall } from '@/lib/tmdb-proxy/proxy'

const ALLOWED_PATHS = /^\/3\/(movie|tv|search|discover|trending|genre|configuration|find|person|collection|network|company|keyword|review|account|authentication|certification|changes|lists)(\/|$)/

// GET /api/tmdb-proxy/3/movie/550?api_key=...
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params
    const urlPath = path.join('/')

    if (!urlPath) {
        return NextResponse.json({ message: 'TMDB Cache Proxy. Use paths like /api/tmdb-proxy/3/movie/...' })
    }

    // Validate path
    const urlPathClean = urlPath.split('?')[0]
    if (!ALLOWED_PATHS.test('/' + urlPathClean)) {
        return NextResponse.json({ error: 'Invalid API path' }, { status: 400 })
    }

    // Reconstruct full URL with query params
    const searchParams = request.nextUrl.searchParams.toString()
    const fullPath = searchParams ? `${urlPath}?${searchParams}` : urlPath

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    const ua = request.headers.get('user-agent') || ''
    const referer = request.headers.get('referer') || ''
    const isInternal = referer.includes('/tmdb-admin')

    try {
        const data = await handleTmdbRequest(fullPath, false, isInternal)

        // Log external calls
        if (!isInternal) {
            const title = data?.title || data?.name || data?.results?.[0]?.title || data?.results?.[0]?.name || null
            logApiCall(urlPath, title, parseApiType(urlPath), 'external', true, clientIp, ua)
        }

        return NextResponse.json(data)
    } catch (err: any) {
        const status = err.response?.status || 500
        const errorMsg = status === 404 ? 'Resource not found'
            : status === 429 ? 'Rate limited'
            : status === 401 ? 'Invalid API key'
            : `Upstream error ${status}`

        if (!isInternal) {
            logApiCall(urlPath, null, parseApiType(urlPath), 'external', false, clientIp, ua)
        }

        return NextResponse.json({ error: errorMsg }, { status })
    }
}
