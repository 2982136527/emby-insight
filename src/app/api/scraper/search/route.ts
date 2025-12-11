/**
 * Manual Match Search API
 * POST: Search TMDB for potential matches
 * First searches local cache, then falls back to TMDB API
 */

import { NextRequest, NextResponse } from 'next/server'
import { tmdbPrisma, prisma } from '@/lib/prisma'
import { TmdbClient } from '@/lib/tmdb/tmdb-client'

interface SearchResult {
    id: number
    title: string
    titleCn: string | null
    originalTitle: string | null
    posterPath: string | null
    releaseDate: string | null
    overview: string | null
    voteAverage: number | null
    mediaType: 'movie' | 'tv'
    source: 'cache' | 'api'  // 标识来源
}

// Get TMDB client with API key
async function getTmdbClient(): Promise<TmdbClient | null> {
    try {
        const config = await prisma.tmdbConfig.findFirst()
        if (config?.apiKey) {
            return new TmdbClient(config.apiKey)
        }
    } catch (error) {
        console.error('[Search] Failed to get TMDB config:', error)
    }
    return null
}

// POST /api/scraper/search - Search for matches
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { query, type, includeOnline = true } = body as {
            query: string
            type: 'movie' | 'tv'
            includeOnline?: boolean
        }

        if (!query || !query.trim()) {
            return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 })
        }

        const searchTerm = query.trim().toLowerCase()
        const results: SearchResult[] = []

        // === Step 1: Search local cache ===
        if (type === 'movie' || !type) {
            try {
                const movies = await tmdbPrisma.tmdbMovie.findMany({
                    where: {
                        OR: [
                            { title: { contains: searchTerm } },
                            { titleCn: { contains: searchTerm } },
                            { originalTitle: { contains: searchTerm } },
                        ],
                    },
                    take: 20,
                    orderBy: { popularity: 'desc' },
                })

                for (const movie of movies) {
                    results.push({
                        id: movie.id,
                        title: movie.title,
                        titleCn: movie.titleCn,
                        originalTitle: movie.originalTitle,
                        posterPath: movie.posterPath,
                        releaseDate: movie.releaseDate,
                        overview: movie.overviewCn || movie.overview,
                        voteAverage: movie.voteAverage,
                        mediaType: 'movie',
                        source: 'cache',
                    })
                }
            } catch (error) {
                console.error('[Search] Cache movie search failed:', error)
            }
        }

        if (type === 'tv' || !type) {
            try {
                const tvShows = await tmdbPrisma.tmdbTvShow.findMany({
                    where: {
                        OR: [
                            { name: { contains: searchTerm } },
                            { nameCn: { contains: searchTerm } },
                            { originalName: { contains: searchTerm } },
                        ],
                    },
                    take: 20,
                    orderBy: { popularity: 'desc' },
                })

                for (const tv of tvShows) {
                    results.push({
                        id: tv.id,
                        title: tv.name,
                        titleCn: tv.nameCn,
                        originalTitle: tv.originalName,
                        posterPath: tv.posterPath,
                        releaseDate: tv.firstAirDate,
                        overview: tv.overviewCn || tv.overview,
                        voteAverage: tv.voteAverage,
                        mediaType: 'tv',
                        source: 'cache',
                    })
                }
            } catch (error) {
                console.error('[Search] Cache TV search failed:', error)
            }
        }

        // === Step 2: Also search TMDB API for more complete results ===
        if (includeOnline) {
            const client = await getTmdbClient()
            if (client) {
                console.log(`[Search] Searching TMDB API for "${query}"...`)

                try {
                    if (type === 'movie' || !type) {
                        const apiResults = await client.searchMovies(query.trim())
                        for (const movie of apiResults.results.slice(0, 20)) {
                            // Skip if already in cache results (same ID)
                            if (results.some(r => r.id === movie.id && r.mediaType === 'movie')) {
                                continue
                            }
                            results.push({
                                id: movie.id,
                                title: movie.title,
                                titleCn: null, // API doesn't return Chinese title directly
                                originalTitle: movie.original_title || null,
                                posterPath: movie.poster_path || null,
                                releaseDate: movie.release_date || null,
                                overview: movie.overview || null,
                                voteAverage: movie.vote_average || null,
                                mediaType: 'movie',
                                source: 'api',
                            })
                        }
                    }

                    if (type === 'tv' || !type) {
                        const apiResults = await client.searchTvShows(query.trim())
                        for (const tv of apiResults.results.slice(0, 20)) {
                            // Skip if already in cache results (same ID)
                            if (results.some(r => r.id === tv.id && r.mediaType === 'tv')) {
                                continue
                            }
                            results.push({
                                id: tv.id,
                                title: tv.name,
                                titleCn: null,
                                originalTitle: tv.original_name || null,
                                posterPath: tv.poster_path || null,
                                releaseDate: tv.first_air_date || null,
                                overview: tv.overview || null,
                                voteAverage: tv.vote_average || null,
                                mediaType: 'tv',
                                source: 'api',
                            })
                        }
                    }
                } catch (error) {
                    console.error('[Search] TMDB API search failed:', error)
                }
            } else {
                console.log('[Search] No TMDB API key configured, skipping online search')
            }
        }

        // Sort by relevance (exact matches first)
        results.sort((a, b) => {
            const aExact = a.title.toLowerCase() === searchTerm ||
                (a.titleCn?.toLowerCase() === searchTerm) ? 1 : 0
            const bExact = b.title.toLowerCase() === searchTerm ||
                (b.titleCn?.toLowerCase() === searchTerm) ? 1 : 0
            return bExact - aExact
        })

        return NextResponse.json({
            success: true,
            query,
            results: results.slice(0, 30),
            sources: {
                cache: results.filter(r => r.source === 'cache').length,
                api: results.filter(r => r.source === 'api').length,
            }
        })
    } catch (error) {
        console.error('[ManualSearch] Failed:', error)
        return NextResponse.json({ error: '搜索失败' }, { status: 500 })
    }
}

