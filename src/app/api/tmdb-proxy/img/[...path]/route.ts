import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getProxyConfig } from '@/lib/tmdb-proxy/proxy'
import { tmdbProxyConfig } from '@/lib/tmdb-proxy/config'
import { getDnsAgent } from '@/lib/tmdb-proxy/dns-resolver'

// In-memory image cache (LRU-ish, max 500, 7 day TTL)
const imageCache = new Map<string, { data: Buffer; contentType: string; cachedAt: number }>()
const IMAGE_CACHE_TTL = 7 * 24 * 3600 * 1000
const IMAGE_CACHE_MAX = 500

// GET /api/tmdb-proxy/img/{size}/{path}
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params
    const imgPath = '/' + path.join('/')

    if (!imgPath || imgPath === '/') {
        return NextResponse.json({ error: 'Invalid image path' }, { status: 400 })
    }

    // Check in-memory cache
    const cached = imageCache.get(imgPath)
    if (cached && Date.now() - cached.cachedAt < IMAGE_CACHE_TTL) {
        return new NextResponse(cached.data, {
            headers: {
                'Content-Type': cached.contentType,
                'Cache-Control': 'public, max-age=604800',
                'X-Cache': 'HIT',
            },
        })
    }

    try {
        const proxyCfg = getProxyConfig()
        const dnsConfig = tmdbProxyConfig.tmdb.resolveTmdbDns ? { httpsAgent: getDnsAgent() } : {}

        const response = await axios.get(`https://image.tmdb.org/t/p${imgPath}`, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: { 'User-Agent': 'EmbyInsight-TmdbProxy/1.0' },
            ...proxyCfg,
            ...dnsConfig,
        })

        const contentType = response.headers['content-type'] || 'image/jpeg'
        const data = Buffer.from(response.data)

        // Store in cache
        if (imageCache.size >= IMAGE_CACHE_MAX) {
            const firstKey = imageCache.keys().next().value
            if (firstKey) imageCache.delete(firstKey)
        }
        imageCache.set(imgPath, { data, contentType, cachedAt: Date.now() })

        return new NextResponse(data, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=604800',
                'X-Cache': 'MISS',
            },
        })
    } catch {
        return NextResponse.json({ error: 'Image fetch failed' }, { status: 502 })
    }
}
