/**
 * Scraper Service
 * Matches Emby items to TMDB entries using the TMDB proxy cache.
 */

import { prisma } from '@/lib/prisma'
import { matchItem, MatchResult } from './matcher'
import { handleTmdbRequest } from '@/lib/tmdb-proxy/proxy'
import { tmdbProxyConfig } from '@/lib/tmdb-proxy/config'

export interface EmbyItemForScrape {
    id: string
    name: string
    type: 'Movie' | 'Series'
    productionYear?: number | null
    providerId?: {
        Tmdb?: string
        Imdb?: string
    }
}

export interface ScrapedItemResult {
    embyItemId: string
    embyItemName: string
    embyItemType: 'Movie' | 'Series'
    matchResult: MatchResult
    metadata?: {
        tmdbId: number
        title: string
        titleCn: string | null
        overview: string | null
        overviewCn: string | null
        posterPath: string | null
        backdropPath: string | null
        voteAverage: number | null
        releaseDate: string | null
        genres: number[]
    }
    source: 'cache' | 'api' | 'none'
    debugInfo?: {
        parsedTitle: string
        parsedYear: number | null
        searchedType: 'movie' | 'tv'
        cacheResultCount: number
        reason: string
    }
}

export interface ScrapeProgress {
    total: number
    processed: number
    matched: number
    unmatched: number
    status: 'idle' | 'running' | 'completed' | 'cancelled'
    currentItem?: string
}

let scrapeProgress: ScrapeProgress = {
    total: 0, processed: 0, matched: 0, unmatched: 0, status: 'idle',
}
let shouldCancel = false

export function getScrapeProgress(): ScrapeProgress { return { ...scrapeProgress } }
export function cancelScrape(): void { shouldCancel = true }
export function resetScrape(): void {
    scrapeProgress = { total: 0, processed: 0, matched: 0, unmatched: 0, status: 'idle' }
    shouldCancel = false
}

/**
 * Extract metadata from a TMDB API response (cached or fresh)
 */
function extractMetadata(data: any, type: 'movie' | 'tv') {
    if (type === 'movie') {
        return {
            tmdbId: data.id,
            title: data.title || '',
            titleCn: data.titleCn || null,
            overview: data.overview || null,
            overviewCn: data.overviewCn || null,
            posterPath: data.poster_path || null,
            backdropPath: data.backdrop_path || null,
            voteAverage: data.vote_average ?? null,
            releaseDate: data.release_date || null,
            genres: data.genres?.map((g: any) => g.id) || data.genre_ids || [],
        }
    } else {
        return {
            tmdbId: data.id,
            title: data.name || '',
            titleCn: data.nameCn || null,
            overview: data.overview || null,
            overviewCn: data.overviewCn || null,
            posterPath: data.poster_path || null,
            backdropPath: data.backdrop_path || null,
            voteAverage: data.vote_average ?? null,
            releaseDate: data.first_air_date || null,
            genres: data.genres?.map((g: any) => g.id) || data.genre_ids || [],
        }
    }
}

/**
 * Search local TMDB cache for matching items
 */
async function searchLocalCache(type: 'movie' | 'tv', searchTerm: string): Promise<any[]> {
    const normalizedSearch = searchTerm.toLowerCase()

    // Search in TmdbCache entries that match the type
    const typePrefix = `3/${type}/`
    const searchPrefix = `3/search/${type}`

    // Get detail entries
    const entries = await prisma.tmdbCache.findMany({
        where: {
            url: { startsWith: typePrefix },
        },
        select: { url: true, response: true },
        take: 500,
        orderBy: { updatedAt: 'desc' },
    })

    const results: any[] = []
    for (const entry of entries) {
        try {
            const data = JSON.parse(entry.response)
            const title = type === 'movie' ? data.title : data.name
            const titleCn = type === 'movie' ? data.titleCn : data.nameCn
            const originalTitle = type === 'movie' ? data.original_title : data.original_name

            if (!title) continue

            const titleLower = title.toLowerCase()
            const titleCnLower = (titleCn || '').toLowerCase()
            const origLower = (originalTitle || '').toLowerCase()

            if (titleLower.includes(normalizedSearch) ||
                titleCnLower.includes(normalizedSearch) ||
                origLower.includes(normalizedSearch)) {
                results.push({
                    id: data.id,
                    title: data.title || data.name,
                    titleCn: data.titleCn || data.nameCn || null,
                    originalTitle: data.original_title || data.original_name || null,
                    releaseDate: data.release_date || data.first_air_date || null,
                    posterPath: data.poster_path || null,
                    backdropPath: data.backdrop_path || null,
                    voteAverage: data.vote_average ?? null,
                    overview: data.overview || null,
                    overviewCn: data.overviewCn || null,
                    genreIds: data.genres ? JSON.stringify(data.genres.map((g: any) => g.id)) : null,
                })
            }
        } catch { /* skip invalid JSON */ }
    }

    // Sort by popularity (use voteAverage as proxy)
    results.sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0))
    return results.slice(0, 50)
}

/**
 * Get metadata from cache by TMDB ID
 */
async function getMetadataFromCache(tmdbId: number, type: 'movie' | 'tv') {
    const prefix = `3/${type}/${tmdbId}`
    const entry = await prisma.tmdbCache.findFirst({
        where: { url: { startsWith: prefix } },
        select: { response: true },
    })
    if (!entry) return null

    try {
        const data = JSON.parse(entry.response)
        return extractMetadata(data, type)
    } catch {
        return null
    }
}

/**
 * Fetch metadata from TMDB through proxy (auto-caches)
 */
async function getMetadataFromApi(tmdbId: number, type: 'movie' | 'tv') {
    const apiKey = tmdbProxyConfig.tmdb.apiKey
    if (!apiKey) return null

    try {
        const data = await handleTmdbRequest(
            `3/${type}/${tmdbId}?api_key=${apiKey}&language=${tmdbProxyConfig.tmdb.language}`
        )
        return extractMetadata(data, type)
    } catch (error) {
        console.error(`[Scraper] Failed to fetch from TMDB proxy: ${tmdbId}`, error)
        return null
    }
}

/**
 * Scrape a single Emby item
 */
export async function scrapeItem(item: EmbyItemForScrape): Promise<ScrapedItemResult> {
    const type = item.type === 'Movie' ? 'movie' : 'tv'
    const apiKey = tmdbProxyConfig.tmdb.apiKey

    // If item already has TMDB ID, use it directly
    if (item.providerId?.Tmdb) {
        const tmdbId = parseInt(item.providerId.Tmdb)
        const metadata = await getMetadataFromCache(tmdbId, type)
        if (metadata) {
            return {
                embyItemId: item.id,
                embyItemName: item.name,
                embyItemType: item.type,
                matchResult: { matched: true, tmdbId, confidence: 1, matchType: 'exact', candidates: [] },
                metadata,
                source: 'cache',
            }
        }
        // Cache miss, try API
        if (apiKey) {
            const apiMetadata = await getMetadataFromApi(tmdbId, type)
            if (apiMetadata) {
                return {
                    embyItemId: item.id,
                    embyItemName: item.name,
                    embyItemType: item.type,
                    matchResult: { matched: true, tmdbId, confidence: 1, matchType: 'exact', candidates: [] },
                    metadata: apiMetadata,
                    source: 'api',
                }
            }
        }
    }

    // Search in local cache first
    const cachedItems = await searchLocalCache(type, item.name)

    const matcherItems = cachedItems.map((c: any) => ({
        id: c.id,
        title: c.title,
        titleCn: c.titleCn,
        originalTitle: c.originalTitle,
        releaseDate: c.releaseDate,
    }))

    const matchResult = matchItem(item.name, item.productionYear, matcherItems)

    if (matchResult.matched && matchResult.tmdbId) {
        const cachedMetadata = cachedItems.find((c: any) => c.id === matchResult.tmdbId)
        if (cachedMetadata) {
            return {
                embyItemId: item.id,
                embyItemName: item.name,
                embyItemType: item.type,
                matchResult,
                metadata: {
                    tmdbId: cachedMetadata.id,
                    title: cachedMetadata.title,
                    titleCn: cachedMetadata.titleCn,
                    overview: cachedMetadata.overview,
                    overviewCn: cachedMetadata.overviewCn,
                    posterPath: cachedMetadata.posterPath,
                    backdropPath: cachedMetadata.backdropPath,
                    voteAverage: cachedMetadata.voteAverage,
                    releaseDate: cachedMetadata.releaseDate,
                    genres: cachedMetadata.genreIds ? JSON.parse(cachedMetadata.genreIds) : [],
                },
                source: 'cache',
            }
        }
    }

    // Fallback to TMDB API through proxy
    if (apiKey && (!matchResult.matched || cachedItems.length === 0)) {
        try {
            console.log(`[Scraper] 缓存${cachedItems.length === 0 ? '无结果' : '未匹配'}，尝试TMDB API搜索: "${item.name}"`)

            const searchUrl = `3/search/${type}?api_key=${apiKey}&language=${tmdbProxyConfig.tmdb.language}&query=${encodeURIComponent(item.name)}`
            const searchResults = await handleTmdbRequest(searchUrl)

            if (searchResults.results?.length > 0) {
                const apiItems = searchResults.results.slice(0, 10).map((r: any) => ({
                    id: r.id,
                    title: type === 'movie' ? r.title : r.name,
                    titleCn: null,
                    originalTitle: type === 'movie' ? r.original_title : r.original_name,
                    releaseDate: type === 'movie' ? r.release_date : r.first_air_date,
                }))

                const apiMatchResult = matchItem(item.name, item.productionYear, apiItems)

                if (apiMatchResult.matched && apiMatchResult.tmdbId) {
                    const apiMetadata = await getMetadataFromApi(apiMatchResult.tmdbId, type)
                    if (apiMetadata) {
                        return {
                            embyItemId: item.id,
                            embyItemName: item.name,
                            embyItemType: item.type,
                            matchResult: apiMatchResult,
                            metadata: apiMetadata,
                            source: 'api',
                        }
                    }
                } else if (searchResults.results.length === 1) {
                    const singleResult = searchResults.results[0]
                    const apiMetadata = await getMetadataFromApi(singleResult.id, type)
                    if (apiMetadata) {
                        return {
                            embyItemId: item.id,
                            embyItemName: item.name,
                            embyItemType: item.type,
                            matchResult: { matched: true, tmdbId: singleResult.id, confidence: 0.7, matchType: 'fuzzy', candidates: apiMatchResult.candidates },
                            metadata: apiMetadata,
                            source: 'api',
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[Scraper] API search failed for: ${item.name}`, error)
        }
    }

    // No match
    const cacheResultCount = cachedItems.length
    let reason = '未知原因'
    if (cacheResultCount === 0) {
        reason = `本地缓存中搜索"${item.name}"无结果，请确认TMDB缓存已同步`
    } else if (!matchResult.matched && matchResult.candidates.length > 0) {
        const best = matchResult.candidates[0]
        if (best.matchType === 'year_mismatch') {
            const candYear = best.releaseDate ? best.releaseDate.substring(0, 4) : '未知'
            reason = `找到候选"${best.titleCn || best.title}"但年份不符（文件:${item.productionYear || '无'} vs TMDB:${candYear}）`
        } else {
            reason = `找到${matchResult.candidates.length}个候选但相似度不足（最高${(best.similarity * 100).toFixed(0)}%，需要90%+）`
        }
    } else if (!matchResult.matched) {
        reason = `缓存中有${cacheResultCount}条结果但标题不匹配（相似度低于80%阈值）`
    }

    return {
        embyItemId: item.id,
        embyItemName: item.name,
        embyItemType: item.type,
        matchResult,
        source: 'none',
        debugInfo: { parsedTitle: item.name, parsedYear: item.productionYear ?? null, searchedType: type, cacheResultCount, reason },
    }
}

/**
 * Scrape multiple items in batch
 */
export async function scrapeItems(
    items: EmbyItemForScrape[],
    onProgress?: (progress: ScrapeProgress) => void
): Promise<ScrapedItemResult[]> {
    resetScrape()
    scrapeProgress.total = items.length
    scrapeProgress.status = 'running'

    const results: ScrapedItemResult[] = []

    for (const item of items) {
        if (shouldCancel) {
            scrapeProgress.status = 'cancelled'
            break
        }

        scrapeProgress.currentItem = item.name
        onProgress?.(getScrapeProgress())

        const result = await scrapeItem(item)
        results.push(result)

        scrapeProgress.processed++
        if (result.matchResult.matched) scrapeProgress.matched++
        else scrapeProgress.unmatched++

        onProgress?.(getScrapeProgress())
    }

    if (scrapeProgress.status !== 'cancelled') scrapeProgress.status = 'completed'
    scrapeProgress.currentItem = undefined
    onProgress?.(getScrapeProgress())

    return results
}
