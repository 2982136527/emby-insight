/**
 * Manual Match Search API
 * POST: Search TMDB for potential matches through the proxy cache
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleTmdbRequest } from '@/lib/tmdb-proxy/proxy'
import { tmdbProxyConfig } from '@/lib/tmdb-proxy/config'

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
    source: 'cache' | 'api'
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

        if (!query?.trim()) {
            return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 })
        }

        const searchTerm = query.trim().toLowerCase()
        const results: SearchResult[] = []
        const apiKey = tmdbProxyConfig.tmdb.apiKey

        // === Step 1: Search local cache ===
        const typesToSearch = type === 'tv' ? ['tv'] : type === 'movie' ? ['movie'] : ['movie', 'tv']

        for (const searchType of typesToSearch) {
            const prefix = `3/${searchType}/`
            const entries = await prisma.tmdbCache.findMany({
                where: { url: { startsWith: prefix } },
                select: { response: true },
                take: 200,
                orderBy: { updatedAt: 'desc' },
            })

            for (const entry of entries) {
                try {
                    const data = JSON.parse(entry.response)
                    const title = (searchType === 'movie' ? data.title : data.name) || ''
                    const titleCn = searchType === 'movie' ? data.titleCn : data.nameCn
                    const origTitle = searchType === 'movie' ? data.original_title : data.original_name

                    if (title.toLowerCase().includes(searchTerm) ||
                        (titleCn || '').toLowerCase().includes(searchTerm) ||
                        (origTitle || '').toLowerCase().includes(searchTerm)) {
                        results.push({
                            id: data.id,
                            title,
                            titleCn: titleCn || null,
                            originalTitle: origTitle || null,
                            posterPath: data.poster_path || null,
                            releaseDate: data.release_date || data.first_air_date || null,
                            overview: data.overview || null,
                            voteAverage: data.vote_average ?? null,
                            mediaType: searchType as 'movie' | 'tv',
                            source: 'cache',
                        })
                    }
                } catch { /* skip */ }
            }
        }

        // === Step 2: Search TMDB API through proxy ===
        if (includeOnline && apiKey) {
            for (const searchType of typesToSearch) {
                try {
                    const searchUrl = `3/search/${searchType}?api_key=${apiKey}&language=${tmdbProxyConfig.tmdb.language}&query=${encodeURIComponent(query.trim())}`
                    const apiResults = await handleTmdbRequest(searchUrl)

                    for (const item of (apiResults.results || []).slice(0, 20)) {
                        if (results.some(r => r.id === item.id && r.mediaType === searchType)) continue
                        results.push({
                            id: item.id,
                            title: searchType === 'movie' ? item.title : item.name,
                            titleCn: null,
                            originalTitle: searchType === 'movie' ? item.original_title : item.original_name,
                            posterPath: item.poster_path || null,
                            releaseDate: searchType === 'movie' ? item.release_date : item.first_air_date,
                            overview: item.overview || null,
                            voteAverage: item.vote_average ?? null,
                            mediaType: searchType as 'movie' | 'tv',
                            source: 'api',
                        })
                    }
                } catch (error) {
                    console.error(`[Search] TMDB API search failed for ${searchType}:`, error)
                }
            }
        }

        // Sort by relevance
        results.sort((a, b) => {
            const aExact = a.title.toLowerCase() === searchTerm || (a.titleCn?.toLowerCase() === searchTerm) ? 1 : 0
            const bExact = b.title.toLowerCase() === searchTerm || (b.titleCn?.toLowerCase() === searchTerm) ? 1 : 0
            return bExact - aExact
        })

        return NextResponse.json({
            success: true,
            query,
            results: results.slice(0, 30),
            sources: {
                cache: results.filter(r => r.source === 'cache').length,
                api: results.filter(r => r.source === 'api').length,
            },
        })
    } catch (error) {
        console.error('[Search] Failed:', error)
        return NextResponse.json({ error: '搜索失败' }, { status: 500 })
    }
}
