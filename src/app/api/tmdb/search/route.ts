import { NextRequest, NextResponse } from 'next/server'
import { tmdbPrisma } from '@/lib/prisma'
import { TmdbClient } from '@/lib/tmdb'

// GET /api/tmdb/search - 从本地缓存搜索
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const query = searchParams.get('q')?.trim()
        const type = searchParams.get('type') || 'all' // movie, tv, person, all
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
        const year = searchParams.get('year') // 可选：按年份过滤

        if (!query || query.length < 2) {
            return NextResponse.json({ movies: [], tvShows: [], persons: [] })
        }

        const results: {
            movies?: Array<{
                id: number
                title: string
                titleCn?: string | null
                releaseDate?: string | null
                posterUrl?: string | null
                voteAverage?: number | null
            }>
            tvShows?: Array<{
                id: number
                name: string
                nameCn?: string | null
                firstAirDate?: string | null
                posterUrl?: string | null
                voteAverage?: number | null
            }>
            persons?: Array<{
                id: number
                name: string
                nameCn?: string | null
                profileUrl?: string | null
                knownForDepartment?: string | null
            }>
        } = {}

        // 搜索电影
        if (type === 'all' || type === 'movie') {
            const movieWhere: Parameters<typeof tmdbPrisma.tmdbMovie.findMany>[0] = {
                where: {
                    OR: [
                        { title: { contains: query } },
                        { titleCn: { contains: query } },
                        { originalTitle: { contains: query } },
                    ],
                },
                take: limit,
                orderBy: { popularity: 'desc' },
            }

            // 按年份过滤
            if (year) {
                movieWhere.where = {
                    ...movieWhere.where,
                    releaseDate: { startsWith: year },
                }
            }

            const movies = await tmdbPrisma.tmdbMovie.findMany(movieWhere)

            results.movies = movies.map(m => ({
                id: m.id,
                title: m.title,
                titleCn: m.titleCn,
                originalTitle: m.originalTitle,
                releaseDate: m.releaseDate,
                posterUrl: m.posterPath ? TmdbClient.getImageUrl(m.posterPath, 'w185') : null,
                backdropUrl: m.backdropPath ? TmdbClient.getImageUrl(m.backdropPath, 'w780') : null,
                voteAverage: m.voteAverage,
                runtime: m.runtime,
                overview: m.overviewCn || m.overview,
            }))
        }

        // 搜索电视剧
        if (type === 'all' || type === 'tv') {
            const tvWhere: Parameters<typeof tmdbPrisma.tmdbTvShow.findMany>[0] = {
                where: {
                    OR: [
                        { name: { contains: query } },
                        { nameCn: { contains: query } },
                        { originalName: { contains: query } },
                    ],
                },
                take: limit,
                orderBy: { popularity: 'desc' },
            }

            if (year) {
                tvWhere.where = {
                    ...tvWhere.where,
                    firstAirDate: { startsWith: year },
                }
            }

            const tvShows = await tmdbPrisma.tmdbTvShow.findMany(tvWhere)

            results.tvShows = tvShows.map(t => ({
                id: t.id,
                name: t.name,
                nameCn: t.nameCn,
                originalName: t.originalName,
                firstAirDate: t.firstAirDate,
                posterUrl: t.posterPath ? TmdbClient.getImageUrl(t.posterPath, 'w185') : null,
                backdropUrl: t.backdropPath ? TmdbClient.getImageUrl(t.backdropPath, 'w780') : null,
                voteAverage: t.voteAverage,
                numberOfSeasons: t.numberOfSeasons,
                overview: t.overviewCn || t.overview,
                status: t.status,
            }))
        }

        // 搜索人物
        if (type === 'all' || type === 'person') {
            const persons = await tmdbPrisma.tmdbPerson.findMany({
                where: {
                    OR: [
                        { name: { contains: query } },
                        { nameCn: { contains: query } },
                    ],
                },
                take: limit,
                orderBy: { popularity: 'desc' },
            })

            results.persons = persons.map(p => ({
                id: p.id,
                name: p.name,
                nameCn: p.nameCn,
                profileUrl: p.profilePath ? TmdbClient.getImageUrl(p.profilePath, 'w185') : null,
                knownForDepartment: p.knownForDepartment,
            }))
        }

        return NextResponse.json(results)
    } catch (error) {
        console.error('[TMDB] Search failed:', error)
        return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
}
