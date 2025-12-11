/**
 * Scraper Service
 * Orchestrates matching Emby items to TMDB entries and enriching metadata.
 */

import { tmdbPrisma } from '@/lib/prisma'
import { matchItem, MatchResult } from './matcher'
import { TmdbClient, extractChineseTranslation } from '@/lib/tmdb'
import { prisma } from '@/lib/prisma'

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
    // Debug info for unmatched items
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

// Global state for tracking scrape progress
let scrapeProgress: ScrapeProgress = {
    total: 0,
    processed: 0,
    matched: 0,
    unmatched: 0,
    status: 'idle',
}
let shouldCancel = false

export function getScrapeProgress(): ScrapeProgress {
    return { ...scrapeProgress }
}

export function cancelScrape(): void {
    shouldCancel = true
}

export function resetScrape(): void {
    scrapeProgress = {
        total: 0,
        processed: 0,
        matched: 0,
        unmatched: 0,
        status: 'idle',
    }
    shouldCancel = false
}

/**
 * Get cached TMDB items for matching
 * Fetches a batch of items from local cache for efficient matching
 */
async function getCachedTmdbItems(
    type: 'movie' | 'tv',
    searchTerm: string,
    limit: number = 50
) {
    const normalizedSearch = searchTerm.toLowerCase()

    if (type === 'movie') {
        return tmdbPrisma.tmdbMovie.findMany({
            where: {
                OR: [
                    { title: { contains: normalizedSearch } },
                    { titleCn: { contains: normalizedSearch } },
                    { originalTitle: { contains: normalizedSearch } },
                ],
            },
            select: {
                id: true,
                title: true,
                titleCn: true,
                originalTitle: true,
                releaseDate: true,
                overview: true,
                overviewCn: true,
                posterPath: true,
                backdropPath: true,
                voteAverage: true,
                genreIds: true,
            },
            take: limit,
            orderBy: { popularity: 'desc' },
        })
    } else {
        return tmdbPrisma.tmdbTvShow.findMany({
            where: {
                OR: [
                    { name: { contains: normalizedSearch } },
                    { nameCn: { contains: normalizedSearch } },
                    { originalName: { contains: normalizedSearch } },
                ],
            },
            select: {
                id: true,
                name: true,
                nameCn: true,
                originalName: true,
                firstAirDate: true,
                overview: true,
                overviewCn: true,
                posterPath: true,
                backdropPath: true,
                voteAverage: true,
                genreIds: true,
            },
            take: limit,
            orderBy: { popularity: 'desc' },
        })
    }
}

/**
 * Get metadata from cache by TMDB ID
 */
async function getMetadataFromCache(tmdbId: number, type: 'movie' | 'tv') {
    if (type === 'movie') {
        const movie = await tmdbPrisma.tmdbMovie.findUnique({
            where: { id: tmdbId },
        })
        if (movie) {
            return {
                tmdbId: movie.id,
                title: movie.title,
                titleCn: movie.titleCn,
                overview: movie.overview,
                overviewCn: movie.overviewCn,
                posterPath: movie.posterPath,
                backdropPath: movie.backdropPath,
                voteAverage: movie.voteAverage,
                releaseDate: movie.releaseDate,
                genres: movie.genreIds ? JSON.parse(movie.genreIds) : [],
            }
        }
    } else {
        const tv = await tmdbPrisma.tmdbTvShow.findUnique({
            where: { id: tmdbId },
        })
        if (tv) {
            return {
                tmdbId: tv.id,
                title: tv.name,
                titleCn: tv.nameCn,
                overview: tv.overview,
                overviewCn: tv.overviewCn,
                posterPath: tv.posterPath,
                backdropPath: tv.backdropPath,
                voteAverage: tv.voteAverage,
                releaseDate: tv.firstAirDate,
                genres: tv.genreIds ? JSON.parse(tv.genreIds) : [],
            }
        }
    }
    return null
}

/**
 * Get metadata from TMDB API (fallback)
 */
async function getMetadataFromApi(
    tmdbId: number,
    type: 'movie' | 'tv',
    client: TmdbClient
) {
    try {
        if (type === 'movie') {
            const movie = await client.getMovie(tmdbId)
            const translations = await client.getMovieTranslations(tmdbId)
            const cn = extractChineseTranslation(translations)

            // Cache the result
            const movieData = {
                id: movie.id,
                imdbId: movie.imdb_id,
                title: movie.title,
                originalTitle: movie.original_title,
                titleCn: cn?.title || cn?.name,
                overview: movie.overview,
                overviewCn: cn?.overview,
                releaseDate: movie.release_date,
                runtime: movie.runtime,
                popularity: movie.popularity,
                voteAverage: movie.vote_average,
                voteCount: movie.vote_count,
                posterPath: movie.poster_path,
                backdropPath: movie.backdrop_path,
                genreIds: movie.genres ? JSON.stringify(movie.genres.map(g => g.id)) : null,
                isAdult: movie.adult,
            }

            await tmdbPrisma.tmdbMovie.upsert({
                where: { id: movie.id },
                update: movieData,
                create: movieData,
            })

            return {
                tmdbId: movie.id,
                title: movie.title,
                titleCn: cn?.title || cn?.name || null,
                overview: movie.overview ?? null,
                overviewCn: cn?.overview ?? null,
                posterPath: movie.poster_path ?? null,
                backdropPath: movie.backdrop_path ?? null,
                voteAverage: movie.vote_average ?? null,
                releaseDate: movie.release_date ?? null,
                genres: movie.genres?.map(g => g.id) || [],
            }
        } else {
            const tv = await client.getTvShow(tmdbId)
            const translations = await client.getTvTranslations(tmdbId)
            const cn = extractChineseTranslation(translations)

            // Cache the result
            const tvData = {
                id: tv.id,
                name: tv.name,
                originalName: tv.original_name,
                nameCn: cn?.name || cn?.title,
                overview: tv.overview,
                overviewCn: cn?.overview,
                firstAirDate: tv.first_air_date,
                lastAirDate: tv.last_air_date,
                numberOfSeasons: tv.number_of_seasons,
                numberOfEpisodes: tv.number_of_episodes,
                popularity: tv.popularity,
                voteAverage: tv.vote_average,
                voteCount: tv.vote_count,
                posterPath: tv.poster_path,
                backdropPath: tv.backdrop_path,
                genreIds: tv.genres ? JSON.stringify(tv.genres.map(g => g.id)) : null,
                status: tv.status,
            }

            await tmdbPrisma.tmdbTvShow.upsert({
                where: { id: tv.id },
                update: tvData,
                create: tvData,
            })

            return {
                tmdbId: tv.id,
                title: tv.name,
                titleCn: cn?.name || cn?.title || null,
                overview: tv.overview ?? null,
                overviewCn: cn?.overview ?? null,
                posterPath: tv.poster_path ?? null,
                backdropPath: tv.backdrop_path ?? null,
                voteAverage: tv.vote_average ?? null,
                releaseDate: tv.first_air_date ?? null,
                genres: tv.genres?.map(g => g.id) || [],
            }
        }
    } catch (error) {
        console.error(`[Scraper] Failed to fetch from API: ${tmdbId}`, error)
        return null
    }
}

/**
 * Scrape a single Emby item
 */
export async function scrapeItem(
    item: EmbyItemForScrape,
    client: TmdbClient | null
): Promise<ScrapedItemResult> {
    const type = item.type === 'Movie' ? 'movie' : 'tv'

    // If item already has TMDB ID, use it directly
    if (item.providerId?.Tmdb) {
        const tmdbId = parseInt(item.providerId.Tmdb)
        const metadata = await getMetadataFromCache(tmdbId, type)
        if (metadata) {
            return {
                embyItemId: item.id,
                embyItemName: item.name,
                embyItemType: item.type,
                matchResult: {
                    matched: true,
                    tmdbId,
                    confidence: 1,
                    matchType: 'exact',
                    candidates: [],
                },
                metadata,
                source: 'cache',
            }
        }
        // Cache miss, try API
        if (client) {
            const apiMetadata = await getMetadataFromApi(tmdbId, type, client)
            if (apiMetadata) {
                return {
                    embyItemId: item.id,
                    embyItemName: item.name,
                    embyItemType: item.type,
                    matchResult: {
                        matched: true,
                        tmdbId,
                        confidence: 1,
                        matchType: 'exact',
                        candidates: [],
                    },
                    metadata: apiMetadata,
                    source: 'api',
                }
            }
        }
    }

    // Search in local cache first
    const cachedItems = await getCachedTmdbItems(type, item.name)

    // Convert to matcher format
    const matcherItems = cachedItems.map(c => ({
        id: c.id,
        title: type === 'movie' ? (c as any).title : (c as any).name,
        titleCn: type === 'movie' ? (c as any).titleCn : (c as any).nameCn,
        originalTitle: type === 'movie' ? (c as any).originalTitle : (c as any).originalName,
        releaseDate: type === 'movie' ? (c as any).releaseDate : (c as any).firstAirDate,
    }))

    const matchResult = matchItem(item.name, item.productionYear, matcherItems)

    if (matchResult.matched && matchResult.tmdbId) {
        // Found in cache
        const cachedMetadata = cachedItems.find(c => c.id === matchResult.tmdbId)
        if (cachedMetadata) {
            return {
                embyItemId: item.id,
                embyItemName: item.name,
                embyItemType: item.type,
                matchResult,
                metadata: {
                    tmdbId: cachedMetadata.id,
                    title: type === 'movie' ? (cachedMetadata as any).title : (cachedMetadata as any).name,
                    titleCn: type === 'movie' ? (cachedMetadata as any).titleCn : (cachedMetadata as any).nameCn,
                    overview: cachedMetadata.overview,
                    overviewCn: cachedMetadata.overviewCn,
                    posterPath: cachedMetadata.posterPath,
                    backdropPath: cachedMetadata.backdropPath,
                    voteAverage: cachedMetadata.voteAverage,
                    releaseDate: type === 'movie' ? (cachedMetadata as any).releaseDate : (cachedMetadata as any).firstAirDate,
                    genres: cachedMetadata.genreIds ? JSON.parse(cachedMetadata.genreIds) : [],
                },
                source: 'cache',
            }
        }
    }

    // Fallback to API search if client available and (no match OR cache was empty)
    if (client && (!matchResult.matched || cachedItems.length === 0)) {
        try {
            console.log(`[Scraper] 缓存${cachedItems.length === 0 ? '无结果' : '未匹配'}，尝试TMDB API搜索: "${item.name}"`)

            const searchResults = type === 'movie'
                ? await client.searchMovies(item.name)
                : await client.searchTvShows(item.name)

            if (searchResults.results.length > 0) {
                console.log(`[Scraper] API找到 ${searchResults.results.length} 条结果`)

                const apiItems = searchResults.results.slice(0, 10).map(r => ({
                    id: r.id,
                    title: type === 'movie' ? (r as any).title : (r as any).name,
                    titleCn: null,
                    originalTitle: type === 'movie' ? (r as any).original_title : (r as any).original_name,
                    releaseDate: type === 'movie' ? (r as any).release_date : (r as any).first_air_date,
                }))

                const apiMatchResult = matchItem(item.name, item.productionYear, apiItems)

                if (apiMatchResult.matched && apiMatchResult.tmdbId) {
                    console.log(`[Scraper] API匹配成功: ${apiMatchResult.tmdbId}，正在获取详情并缓存...`)
                    const apiMetadata = await getMetadataFromApi(apiMatchResult.tmdbId, type, client)
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
                    // 只有1条结果时，大概率就是要找的，直接使用（信任搜索结果）
                    const singleResult = searchResults.results[0]
                    console.log(`[Scraper] API只有1条结果，信任此结果: ${singleResult.id}`)
                    const apiMetadata = await getMetadataFromApi(singleResult.id, type, client)
                    if (apiMetadata) {
                        return {
                            embyItemId: item.id,
                            embyItemName: item.name,
                            embyItemType: item.type,
                            matchResult: {
                                matched: true,
                                tmdbId: singleResult.id,
                                confidence: 0.7, // 标记为中等置信度
                                matchType: 'fuzzy' as const,
                                candidates: apiMatchResult.candidates,
                            },
                            metadata: apiMetadata,
                            source: 'api',
                        }
                    }
                } else {
                    console.log(`[Scraper] API结果未能匹配（相似度不足或年份不符）`)
                }
            } else {
                console.log(`[Scraper] TMDB API也无结果: "${item.name}"`)
            }
        } catch (error) {
            console.error(`[Scraper] API search failed for: ${item.name}`, error)
        }
    } else if (!client && cachedItems.length === 0) {
        console.log(`[Scraper] 缓存无结果且未配置TMDB API Key，无法在线获取: "${item.name}"`)
    }

    // No match found - add debug info
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

    console.log(`[Scraper] 未匹配: "${item.name}" → 解析为 "${item.name}" (${item.productionYear || '无年份'}) | ${reason}`)

    return {
        embyItemId: item.id,
        embyItemName: item.name,
        embyItemType: item.type,
        matchResult,
        source: 'none',
        debugInfo: {
            parsedTitle: item.name,
            parsedYear: item.productionYear ?? null,
            searchedType: type,
            cacheResultCount,
            reason,
        }
    }
}

/**
 * Scrape multiple items in batch
 */
export async function scrapeItems(
    items: EmbyItemForScrape[],
    onProgress?: (progress: ScrapeProgress) => void
): Promise<ScrapedItemResult[]> {
    // Get TMDB config for API fallback
    const config = await prisma.tmdbConfig.findFirst()
    const client = config?.apiKey ? new TmdbClient(config.apiKey, config.language) : null

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

        const result = await scrapeItem(item, client)
        results.push(result)

        scrapeProgress.processed++
        if (result.matchResult.matched) {
            scrapeProgress.matched++
        } else {
            scrapeProgress.unmatched++
        }

        onProgress?.(getScrapeProgress())
    }

    if (scrapeProgress.status !== 'cancelled') {
        scrapeProgress.status = 'completed'
    }
    scrapeProgress.currentItem = undefined
    onProgress?.(getScrapeProgress())

    return results
}
