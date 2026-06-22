import axios from 'axios'
import { prisma } from '@/lib/prisma'
import { tmdbProxyConfig } from './config'
import { getDnsAgent } from './dns-resolver'

const TMDB_BASE_URL = 'https://api.themoviedb.org'
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000 // 7 days

export function getProxyConfig(): { proxy?: { host: string; port: number; protocol: string } } {
    const p = tmdbProxyConfig.tmdb.httpProxy
    if (!p) return {}
    try {
        const url = new URL(p)
        return {
            proxy: {
                host: url.hostname,
                port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
                protocol: url.protocol.replace(':', ''),
            }
        }
    } catch { return {} }
}

// Prefetch queue
const prefetchQueue: string[] = []
const enqueuedUrls = new Set<string>()
let isProcessingQueue = false
const MAX_QUEUE_SIZE = 500

async function processQueue() {
    if (isProcessingQueue) return
    isProcessingQueue = true

    while (prefetchQueue.length > 0) {
        const url = prefetchQueue.shift()
        if (url) {
            enqueuedUrls.delete(url)
            try {
                await handleTmdbRequest(url, true)
                await new Promise(r => setTimeout(r, 250))
            } catch {
                // silent
            }
        }
    }
    enqueuedUrls.clear()
    isProcessingQueue = false
}

export async function handleTmdbRequest(urlPath: string, isBackground = false, isInternal = false): Promise<any> {
    const apiKey = tmdbProxyConfig.tmdb.apiKey
    if (!apiKey) throw new Error('TMDB API key not configured')

    // Build full URL with auth
    const urlObj = new URL(urlPath, TMDB_BASE_URL)
    if (!urlObj.searchParams.has('api_key')) {
        urlObj.searchParams.set('api_key', apiKey)
    }
    const incomingKey = urlObj.searchParams.get('api_key')

    // Auth key validation for external requests (internal/admin requests bypass)
    if (!isBackground && !isInternal && tmdbProxyConfig.tmdb.authKey) {
        if (incomingKey !== tmdbProxyConfig.tmdb.authKey) {
            const err: any = new Error('Invalid API key')
            err.response = { status: 401, data: { status_message: 'Invalid API key' } }
            throw err
        }
    }

    // Replace with real key
    if (incomingKey !== apiKey) {
        urlObj.searchParams.set('api_key', apiKey)
    }

    const normalizedPath = urlObj.pathname + urlObj.search
    const cleanPath = normalizedPath.replace(/^\//, '')

    // Cache key
    const cacheKey = getCacheKey(cleanPath)

    // Check cache
    const cached = await prisma.tmdbCache.findUnique({ where: { url: cacheKey } })
    if (cached) {
        const age = Date.now() - new Date(cached.updatedAt).getTime()
        if (age < CACHE_TTL_MS) {
            const data = JSON.parse(cached.response)
            if (!isBackground) console.log(`[TMDB-CACHE HIT] ${cacheKey}`)
            if (data.results && Array.isArray(data.results)) {
                triggerBackgroundPrefetch(data, cleanPath)
            }
            return data
        }
    }

    // Auto-enrichment
    let upstreamUrl = urlObj.toString()
    const movieTvMatch = cleanPath.match(/(^|\/)3\/(movie|tv)\/(\d+)(\?|$)/)
    const personMatch = cleanPath.match(/(^|\/)3\/person\/(\d+)(\?|$)/)

    if (movieTvMatch) {
        const contentType = movieTvMatch[2]
        const uObj = new URL(upstreamUrl)
        const commonFields = 'credits,images,videos,external_ids,recommendations,similar,keywords,watch/providers'
        const typeFields = contentType === 'movie' ? 'release_dates' : 'content_ratings,aggregate_credits'
        const extraFields = `${commonFields},${typeFields}`
        const existing = uObj.searchParams.get('append_to_response')
        if (!existing || !existing.includes('credits')) {
            uObj.searchParams.set('append_to_response', existing ? `${existing},${extraFields}` : extraFields)
            uObj.searchParams.set('include_image_language', 'zh,null')
            upstreamUrl = uObj.toString()
        }
    } else if (personMatch) {
        const uObj = new URL(upstreamUrl)
        const extraFields = 'combined_credits,images,external_ids,movie_credits,tv_credits'
        const existing = uObj.searchParams.get('append_to_response')
        if (!existing || !existing.includes('combined_credits')) {
            uObj.searchParams.set('append_to_response', existing ? `${existing},${extraFields}` : extraFields)
            upstreamUrl = uObj.toString()
        }
    }

    // Fetch from upstream
    const dnsConfig = tmdbProxyConfig.tmdb.resolveTmdbDns ? { httpsAgent: getDnsAgent() } : {}
    const maxRetries = 5
    let lastError: any
    let response: any

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            response = await axios.get(upstreamUrl, {
                headers: { 'User-Agent': 'EmbyInsight-TmdbProxy/1.0' },
                timeout: 15000,
                ...getProxyConfig(),
                ...dnsConfig,
            })
            break
        } catch (err: any) {
            lastError = err
            const status = err.response?.status
            const code = err.code || ''
            const isRetryable = !status || status === 429 || status >= 500
                || code === 'ECONNRESET' || code === 'ECONNABORTED'
                || err.message?.includes('TLS')

            if (attempt < maxRetries && isRetryable) {
                const delay = Math.min((attempt + 1) * 2000, 30000)
                await new Promise(r => setTimeout(r, delay))
            } else {
                throw lastError
            }
        }
    }

    const data = response.data
    const responseStr = JSON.stringify(data)
    const now = new Date()

    // Write to cache
    await prisma.tmdbCache.upsert({
        where: { url: cacheKey },
        update: { response: responseStr, expiresAt: new Date(now.getTime() + CACHE_TTL_MS) },
        create: { url: cacheKey, response: responseStr, expiresAt: new Date(now.getTime() + CACHE_TTL_MS) },
    })

    const title = data.title || data.name
    if (title && !isBackground) {
        console.log(`[TMDB-CACHE MISS] ${title} (ID:${data.id})`)
    }

    // Trigger prefetch for list pages or non-background requests
    const isListPage = data.results && Array.isArray(data.results)
    if (isListPage || !isBackground) {
        triggerBackgroundPrefetch(data, cleanPath)
    }

    return data
}

function enqueueUrl(url: string): boolean {
    if (enqueuedUrls.has(url)) return false
    if (prefetchQueue.length >= MAX_QUEUE_SIZE) return false
    prefetchQueue.push(url)
    enqueuedUrls.add(url)
    return true
}

function triggerBackgroundPrefetch(data: any, originalUrl: string) {
    try {
        const apiKey = tmdbProxyConfig.tmdb.apiKey
        if (!apiKey) return
        const lang = tmdbProxyConfig.tmdb.language
        let addedCount = 0

        if (data.results && Array.isArray(data.results)) {
            let type = 'movie'
            if (originalUrl.includes('/tv')) type = 'tv'

            for (const item of data.results) {
                const itemType = item.media_type || type
                if (itemType === 'person') {
                    if (enqueueUrl(`3/person/${item.id}?api_key=${apiKey}&language=${lang}`)) addedCount++
                } else if (itemType === 'movie' || itemType === 'tv') {
                    if (enqueueUrl(`3/${itemType}/${item.id}?api_key=${apiKey}&language=${lang}`)) addedCount++
                }
            }
        }

        if (data.recommendations?.results?.length) {
            for (const item of data.recommendations.results) {
                if (prefetchQueue.length >= MAX_QUEUE_SIZE) break
                const itemType = item.media_type || 'movie'
                if (itemType !== 'movie' && itemType !== 'tv') continue
                if (enqueueUrl(`3/${itemType}/${item.id}?api_key=${apiKey}&language=${lang}`)) addedCount++
            }
        }

        if (data.similar?.results?.length) {
            for (const item of data.similar.results) {
                if (prefetchQueue.length >= MAX_QUEUE_SIZE) break
                const itemType = originalUrl.includes('/tv') ? 'tv' : 'movie'
                if (enqueueUrl(`3/${itemType}/${item.id}?api_key=${apiKey}&language=${lang}`)) addedCount++
            }
        }

        if (data.belongs_to_collection?.id) {
            if (enqueueUrl(`3/collection/${data.belongs_to_collection.id}?api_key=${apiKey}&language=${lang}`)) addedCount++
        }

        if (addedCount > 0) processQueue()
    } catch {
        // silent
    }
}

function getCacheKey(fullUrl: string): string {
    try {
        const parts = fullUrl.split('?')
        const urlPath = parts[0]
        if (!urlPath) return fullUrl
        const search = parts[1]
        if (!search) return urlPath
        const params = new URLSearchParams(search)
        params.delete('api_key')
        params.delete('append_to_response')
        params.delete('include_image_language')
        params.sort()
        const queryString = params.toString()
        return queryString ? `${urlPath}?${queryString}` : urlPath
    } catch {
        return fullUrl
    }
}

// Parse API type from URL
export function parseApiType(url: string): string {
    if (/\/movie\/\d+/.test(url)) return 'movie'
    if (/\/tv\/\d+/.test(url)) return 'tv'
    if (/\/person\/\d+/.test(url)) return 'person'
    if (/\/(popular|top_rated|now_playing|on_the_air|airing_today|trending|discover)/.test(url)) return 'list'
    return 'other'
}

// Get cache stats
export async function getCacheStats() {
    const [total, expired] = await Promise.all([
        prisma.tmdbCache.count(),
        prisma.tmdbCache.count({ where: { expiresAt: { lt: new Date() } } }),
    ])

    const typeBreakdown: Record<string, number> = {}
    const allEntries = await prisma.tmdbCache.findMany({ select: { url: true } })
    for (const entry of allEntries) {
        const type = parseApiType(entry.url)
        typeBreakdown[type] = (typeBreakdown[type] || 0) + 1
    }

    return { total, expired, active: total - expired, typeBreakdown }
}

// Get cache entries (paginated)
export async function getCacheEntries(page = 1, limit = 50, search?: string, type?: string) {
    const where: any = {}
    if (search) where.url = { contains: search }
    if (type && type !== 'all') where.url = { contains: `3/${type}` }

    const [items, total] = await Promise.all([
        prisma.tmdbCache.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, url: true, createdAt: true, updatedAt: true, expiresAt: true },
        }),
        prisma.tmdbCache.count({ where }),
    ])

    return { items, total, page, totalPages: Math.ceil(total / limit) }
}

// Clear all cache
export async function clearAllCache() {
    return prisma.tmdbCache.deleteMany()
}

// Delete single cache entry
export async function deleteCacheEntry(id: number) {
    return prisma.tmdbCache.delete({ where: { id } })
}

// Get posters from cache
export async function getPosters(search?: string, page = 1, limit = 50) {
    const entries = await prisma.tmdbCache.findMany({
        where: search ? { url: { contains: search } } : undefined,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: { url: true, response: true },
    })

    const posters: any[] = []
    for (const entry of entries) {
        try {
            const data = JSON.parse(entry.response)
            if (data.poster_path) {
                posters.push({
                    id: data.id,
                    title: data.title || data.name,
                    posterPath: data.poster_path,
                    backdropPath: data.backdrop_path,
                    voteAverage: data.vote_average,
                    releaseDate: data.release_date || data.first_air_date,
                    mediaType: entry.url.includes('/tv') ? 'tv' : 'movie',
                })
            }
        } catch { /* skip */ }
    }

    return posters
}

// Get detail from cache by TMDB ID
export async function getDetailFromCache(tmdbId: number, type: 'movie' | 'tv') {
    const urlPattern = `3/${type}/${tmdbId}`
    const entry = await prisma.tmdbCache.findFirst({
        where: { url: { startsWith: urlPattern } },
    })
    if (!entry) return null
    try {
        return JSON.parse(entry.response)
    } catch {
        return null
    }
}

// Log API call
export async function logApiCall(url: string, title: string | null, type: string, source: string, hit: boolean, ip: string, ua: string) {
    try {
        await prisma.apiLog.create({
            data: {
                url: url.split('?')[0] || '',
                title: title ? String(title).substring(0, 200) : null,
                type, source, hit,
                ip, ua: ua.substring(0, 300),
            },
        })
    } catch { /* fire and forget */ }
}

// Get log stats
export async function getLogStats() {
    const total = await prisma.apiLog.count()
    const today = await prisma.apiLog.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    })
    const hits = await prisma.apiLog.count({ where: { hit: true } })
    const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0

    const topTitles = await prisma.apiLog.groupBy({
        by: ['title'],
        _count: { title: true },
        orderBy: { _count: { title: 'desc' } },
        take: 10,
        where: { title: { not: null } },
    })

    return { total, today, hitRate, topTitles: topTitles.map(t => ({ title: t.title, count: t._count.title })) }
}

// Get logs (paginated)
export async function getLogs(page = 1, limit = 50, type?: string, source?: string) {
    const where: any = {}
    if (type && type !== 'all') where.type = type
    if (source && source !== 'all') where.source = source

    const [items, total] = await Promise.all([
        prisma.apiLog.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.apiLog.count({ where }),
    ])

    return { items, total, page, totalPages: Math.ceil(total / limit) }
}

// Clear logs
export async function clearLogs() {
    return prisma.apiLog.deleteMany()
}
