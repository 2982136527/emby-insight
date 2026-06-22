import { NextRequest, NextResponse } from 'next/server'
import {
    getCacheStats, getCacheEntries, clearAllCache, deleteCacheEntry,
    getPosters, getDetailFromCache, getLogStats, getLogs, clearLogs,
    handleTmdbRequest, logApiCall, parseApiType,
} from '@/lib/tmdb-proxy/proxy'
import { tmdbProxyConfig, updateTmdbProxyConfig } from '@/lib/tmdb-proxy/config'
import { testDnsConnectivity } from '@/lib/tmdb-proxy/dns-resolver'
import { CacheWarmer } from '@/lib/tmdb-proxy/cache-warmer'

// Singleton warmer
let warmer: CacheWarmer | null = null
function getWarmer() {
    if (!warmer) warmer = new CacheWarmer()
    return warmer
}

type RouteContext = { params: Promise<{ action: string[] }> }

// GET /api/tmdb-proxy/admin/[...action]
export async function GET(request: NextRequest, { params }: RouteContext) {
    const { action } = await params
    const route = action.join('/')
    const sp = request.nextUrl.searchParams

    try {
        switch (route) {
            case 'stats':
                return NextResponse.json({ ...(await getCacheStats()), isWarmerRunning: getWarmer().isWarmerRunning() })

            case 'cache': {
                const page = parseInt(sp.get('page') || '1')
                const limit = parseInt(sp.get('limit') || '50')
                const search = sp.get('search') || undefined
                const type = sp.get('type') || undefined
                return NextResponse.json(await getCacheEntries(page, limit, search, type))
            }

            case 'posters': {
                const search = (sp.get('search') || '').toLowerCase()
                const page = Math.max(1, parseInt(sp.get('page') || '1'))
                const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '24')))
                const typeFilter = sp.get('type') || 'all'

                const movieWhere = "url LIKE '3/movie/%' AND url NOT LIKE '3/movie/%/%/%'"
                const tvWhere = "url LIKE '3/tv/%' AND url NOT LIKE '3/tv/%/%/%'"
                const where = typeFilter === 'movie' ? movieWhere
                    : typeFilter === 'tv' ? tvWhere
                    : `(${movieWhere} OR ${tvWhere})`

                const seen = new Set<number>()
                const allMatched: any[] = []
                const img = (size: string, p: string | null) => p ? `/api/tmdb-proxy/img/${size}${p}` : null

                if (search) {
                    const BATCH = 500
                    let offset = 0
                    const maxScan = 10000
                    while (allMatched.length < page * limit && offset < maxScan) {
                        const entries = await prisma.$queryRawUnsafe<Array<{ url: string; response: string }>>(
                            `SELECT url, response FROM TmdbCache WHERE ${where} ORDER BY id DESC LIMIT ${BATCH} OFFSET ${offset}`
                        )
                        if (entries.length === 0) break
                        for (const entry of entries) {
                            try {
                                const data = JSON.parse(entry.response)
                                if (!data.poster_path || seen.has(data.id)) continue
                                const isMovie = entry.url.startsWith('3/movie/')
                                const title = (isMovie ? data.title : data.name) || ''
                                if (!title.toLowerCase().includes(search)) continue
                                seen.add(data.id)
                                allMatched.push({
                                    tmdbId: data.id, type: isMovie ? 'movie' : 'tv',
                                    title, posterPath: img('w500', data.poster_path),
                                    voteAverage: data.vote_average ?? 0,
                                    releaseDate: (isMovie ? data.release_date : data.first_air_date) || '',
                                })
                            } catch { /* skip */ }
                        }
                        offset += BATCH
                    }
                    const total = allMatched.length
                    const totalPages = Math.ceil(total / limit)
                    const items = allMatched.slice((page - 1) * limit, page * limit)
                    return NextResponse.json({ items, total, page, totalPages })
                }

                const fetchLimit = limit * 3
                const dbOffset = (page - 1) * fetchLimit
                const entries = await prisma.$queryRawUnsafe<Array<{ url: string; response: string }>>(
                    `SELECT url, response FROM TmdbCache WHERE ${where} ORDER BY id DESC LIMIT ${fetchLimit} OFFSET ${dbOffset}`
                )
                const items: any[] = []
                for (const entry of entries) {
                    if (items.length >= limit) break
                    try {
                        const data = JSON.parse(entry.response)
                        if (!data.poster_path || seen.has(data.id)) continue
                        seen.add(data.id)
                        const isMovie = entry.url.startsWith('3/movie/')
                        items.push({
                            tmdbId: data.id, type: isMovie ? 'movie' : 'tv',
                            title: (isMovie ? data.title : data.name) || 'Unknown',
                            posterPath: img('w500', data.poster_path),
                            voteAverage: data.vote_average ?? 0,
                            releaseDate: (isMovie ? data.release_date : data.first_air_date) || '',
                        })
                    } catch { /* skip */ }
                }
                const totalRow = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(
                    `SELECT COUNT(*) as cnt FROM TmdbCache WHERE ${where}`
                )
                const total = Number(totalRow[0]?.cnt || 0)
                const totalPages = Math.ceil(total / limit)
                return NextResponse.json({ items, total, page, totalPages })
            }

            case 'dns/test':
                return NextResponse.json(await testDnsConnectivity())

            case 'config':
                return NextResponse.json({
                    hasApiKey: !!tmdbProxyConfig.tmdb.apiKey,
                    apiKey: tmdbProxyConfig.tmdb.apiKey ? '***' + tmdbProxyConfig.tmdb.apiKey.slice(-4) : '',
                    language: tmdbProxyConfig.tmdb.language,
                    authKey: tmdbProxyConfig.tmdb.authKey ? '***' : '',
                    proxyImages: tmdbProxyConfig.tmdb.proxyImages,
                    resolveTmdbDns: tmdbProxyConfig.tmdb.resolveTmdbDns,
                    httpProxy: tmdbProxyConfig.tmdb.httpProxy,
                    logRetentionDays: tmdbProxyConfig.logRetentionDays,
                })

            case 'config/raw':
                return NextResponse.json(tmdbProxyConfig)

            case 'logs/stats':
                return NextResponse.json(await getLogStats())

            case 'logs': {
                const page = parseInt(sp.get('page') || '1')
                const limit = parseInt(sp.get('limit') || '50')
                const type = sp.get('type') || undefined
                const source = sp.get('source') || undefined
                return NextResponse.json(await getLogs(page, limit, type, source))
            }

            case 'warmer/status':
                return NextResponse.json({ isRunning: getWarmer().isWarmerRunning() })

            default:
                // Handle dynamic routes
                if (route.startsWith('cache/')) {
                    const id = parseInt(route.split('/')[1]!)
                    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
                    return NextResponse.json(await getDetailFromCache(id, 'movie'))
                }
                if (route.startsWith('posters/detail/')) {
                    const tmdbId = parseInt(route.split('/')[2]!)
                    if (isNaN(tmdbId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
                    const img = (size: string, p: string | null) => p ? `/api/tmdb-proxy/img/${size}${p}` : null

                    function buildDetail(entry: { url: string; response: string }) {
                        const data = JSON.parse(entry.response)
                        if (!((data.id === tmdbId) && (data.title || data.name) && data.poster_path && data.credits)) return null
                        const isMovie = /\/movie\//.test(entry.url)
                        return {
                            type: isMovie ? 'movie' : 'tv',
                            tmdbId: data.id,
                            title: isMovie ? data.title : data.name,
                            originalTitle: isMovie ? data.original_title : data.original_name,
                            overview: data.overview || '',
                            posterPath: img('w500', data.poster_path),
                            backdropPath: img('w780', data.backdrop_path),
                            voteAverage: data.vote_average ?? 0,
                            voteCount: data.vote_count ?? 0,
                            releaseDate: isMovie ? data.release_date : data.first_air_date,
                            runtime: data.runtime || data.episode_run_time?.[0] || null,
                            genres: data.genres || [],
                            tagline: data.tagline || '',
                            status: data.status || '',
                            budget: data.budget || 0,
                            revenue: data.revenue || 0,
                            homepage: data.homepage || '',
                            imdbId: data.imdb_id || '',
                            originalLanguage: data.original_language || '',
                            numberOfSeasons: data.number_of_seasons || null,
                            numberOfEpisodes: data.number_of_episodes || null,
                            seasons: (data.seasons || []).map((s: any) => ({ ...s, posterPath: img('w154', s.poster_path) })),
                            networks: data.networks || null,
                            createdBy: data.created_by || null,
                            cast: (data.credits?.cast || []).slice(0, 12).map((c: any) => ({
                                id: c.id, name: c.name, character: c.character,
                                profilePath: img('w185', c.profile_path),
                            })),
                            backdrops: (data.images?.backdrops || []).slice(0, 6).map((b: any) => img('w780', b.file_path)),
                            logoPath: (() => {
                                const logos = data.images?.logos || []
                                const zh = logos.find((l: any) => l.iso_639_1 === 'zh')
                                if (zh) return img('w500', zh.file_path)
                                const en = logos.find((l: any) => l.iso_639_1 === 'en')
                                if (en) return img('w500', en.file_path)
                                return logos[0] ? img('w500', logos[0].file_path) : null
                            })(),
                            videos: (data.videos?.results || []).filter((v: any) => v.site === 'YouTube').slice(0, 3).map((v: any) => ({ key: v.key, name: v.name, type: v.type })),
                            recommendations: (data.recommendations?.results || []).slice(0, 8).map((r: any) => ({
                                tmdbId: r.id, title: r.title || r.name,
                                posterPath: img('w300', r.poster_path),
                            })),
                        }
                    }

                    for (const type of ['movie', 'tv']) {
                        const entry = await prisma.tmdbCache.findFirst({
                            where: { OR: [
                                { url: `3/${type}/${tmdbId}` },
                                { url: { startsWith: `3/${type}/${tmdbId}?` } },
                            ]},
                            select: { url: true, response: true },
                            orderBy: { updatedAt: 'desc' },
                        })
                        if (entry) {
                            try {
                                const result = buildDetail(entry)
                                if (result) return NextResponse.json(result)
                            } catch { /* skip */ }
                        }
                    }

                    // Fallback: fetch from TMDB
                    if (tmdbProxyConfig.tmdb.apiKey) {
                        try {
                            await handleTmdbRequest(`3/movie/${tmdbId}?api_key=${tmdbProxyConfig.tmdb.apiKey}&language=${tmdbProxyConfig.tmdb.language}&append_to_response=credits,images,videos,recommendations`)
                        } catch {
                            try {
                                await handleTmdbRequest(`3/tv/${tmdbId}?api_key=${tmdbProxyConfig.tmdb.apiKey}&language=${tmdbProxyConfig.tmdb.language}&append_to_response=credits,images,videos,recommendations`)
                            } catch { /* ignore */ }
                        }
                        for (const type of ['movie', 'tv']) {
                            const entry = await prisma.tmdbCache.findFirst({
                                where: { OR: [
                                    { url: `3/${type}/${tmdbId}` },
                                    { url: { startsWith: `3/${type}/${tmdbId}?` } },
                                ]},
                                select: { url: true, response: true },
                                orderBy: { updatedAt: 'desc' },
                            })
                            if (entry) {
                                try {
                                    const result = buildDetail(entry)
                                    if (result) return NextResponse.json(result)
                                } catch { /* skip */ }
                            }
                        }
                    }
                    return NextResponse.json({ error: 'Not found' }, { status: 404 })
                }
                if (route.startsWith('posters/season/')) {
                    const parts = route.split('/')
                    const tvId = parseInt(parts[2]!)
                    const seasonNum = parseInt(parts[3]!)
                    if (isNaN(tvId) || isNaN(seasonNum)) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
                    if (!tmdbProxyConfig.tmdb.apiKey) return NextResponse.json({ error: 'No API key' }, { status: 400 })
                    const data = await handleTmdbRequest(`3/tv/${tvId}/season/${seasonNum}?api_key=${tmdbProxyConfig.tmdb.apiKey}&language=${tmdbProxyConfig.tmdb.language}`)
                    return NextResponse.json(data)
                }
                if (route.startsWith('tmdb/search')) {
                    const query = sp.get('q') || sp.get('query')
                    const type = sp.get('type') || 'movie'
                    if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 })
                    if (!tmdbProxyConfig.tmdb.apiKey) return NextResponse.json({ error: 'No API key' }, { status: 400 })
                    const data = await handleTmdbRequest(`3/search/${type}?api_key=${tmdbProxyConfig.tmdb.apiKey}&language=${tmdbProxyConfig.tmdb.language}&query=${encodeURIComponent(query)}`)
                    return NextResponse.json(data)
                }
                if (route.startsWith('tmdb/discover')) {
                    const type = sp.get('type') || 'movie'
                    const genre = sp.get('genre') || ''
                    const page = sp.get('page') || '1'
                    if (!tmdbProxyConfig.tmdb.apiKey) return NextResponse.json({ error: 'No API key' }, { status: 400 })
                    const params = new URLSearchParams({
                        api_key: tmdbProxyConfig.tmdb.apiKey,
                        language: tmdbProxyConfig.tmdb.language,
                        sort_by: 'popularity.desc',
                        page,
                    })
                    if (genre) params.set('with_genres', genre)
                    const data = await handleTmdbRequest(`3/discover/${type}?${params.toString()}`)
                    return NextResponse.json(data)
                }
                if (route.startsWith('tmdb/person/')) {
                    const personId = parseInt(route.split('/')[2]!)
                    if (isNaN(personId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
                    if (!tmdbProxyConfig.tmdb.apiKey) return NextResponse.json({ error: 'No API key' }, { status: 400 })
                    const data = await handleTmdbRequest(`3/person/${personId}?api_key=${tmdbProxyConfig.tmdb.apiKey}&language=${tmdbProxyConfig.tmdb.language}`)
                    return NextResponse.json(data)
                }
                return NextResponse.json({ error: 'Unknown route' }, { status: 404 })
        }
    } catch (err: any) {
        const status = err.response?.status || 500
        return NextResponse.json({ error: err.message || 'Internal error' }, { status })
    }
}

// POST /api/tmdb-proxy/admin/[...action]
export async function POST(request: NextRequest, { params }: RouteContext) {
    const { action } = await params
    const route = action.join('/')

    try {
        switch (route) {
            case 'cache/clear':
                await clearAllCache()
                return NextResponse.json({ success: true })

            case 'logs/clear':
                await clearLogs()
                return NextResponse.json({ success: true })

            case 'warmer/start':
                getWarmer().start()
                return NextResponse.json({ success: true, message: 'Warmer started' })

            case 'warmer/stop':
                getWarmer().stop()
                return NextResponse.json({ success: true, message: 'Warmer stopped' })

            default:
                return NextResponse.json({ error: 'Unknown route' }, { status: 404 })
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}

// PUT /api/tmdb-proxy/admin/[...action]
export async function PUT(request: NextRequest, { params }: RouteContext) {
    const { action } = await params
    const route = action.join('/')

    try {
        switch (route) {
            case 'config': {
                const body = await request.json()
                updateTmdbProxyConfig(body)
                return NextResponse.json({ success: true })
            }
            default:
                return NextResponse.json({ error: 'Unknown route' }, { status: 404 })
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}

// DELETE /api/tmdb-proxy/admin/[...action]
export async function DELETE(request: NextRequest, { params }: RouteContext) {
    const { action } = await params
    const route = action.join('/')

    try {
        if (route.startsWith('cache/')) {
            const id = parseInt(route.split('/')[1]!)
            if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
            await deleteCacheEntry(id)
            return NextResponse.json({ success: true })
        }
        return NextResponse.json({ error: 'Unknown route' }, { status: 404 })
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}
