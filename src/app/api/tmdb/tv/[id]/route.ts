import { NextRequest, NextResponse } from 'next/server'
import { prisma, tmdbPrisma } from '@/lib/prisma'
import { TmdbClient, extractChineseTranslation } from '@/lib/tmdb'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/tmdb/tv/[id] - 获取电视剧详情
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const tvId = parseInt(id)

        if (isNaN(tvId)) {
            return NextResponse.json({ error: 'Invalid TV show ID' }, { status: 400 })
        }

        // Check local cache
        let tvShow = await tmdbPrisma.tmdbTvShow.findUnique({
            where: { id: tvId },
        })

        if (tvShow && tvShow.credits) {
            // ... (keep existing cache logic)
            return NextResponse.json({
                source: 'cache',
                data: {
                    id: tvShow.id,
                    name: tvShow.name,
                    nameCn: tvShow.nameCn,
                    originalName: tvShow.originalName,
                    overview: tvShow.overviewCn || tvShow.overview,
                    firstAirDate: tvShow.firstAirDate,
                    lastAirDate: tvShow.lastAirDate,
                    numberOfSeasons: tvShow.numberOfSeasons,
                    numberOfEpisodes: tvShow.numberOfEpisodes,
                    voteAverage: tvShow.voteAverage,
                    voteCount: tvShow.voteCount,
                    posterUrl: tvShow.posterPath ? TmdbClient.getImageUrl(tvShow.posterPath, 'w500') : null,
                    backdropUrl: tvShow.backdropPath ? TmdbClient.getImageUrl(tvShow.backdropPath, 'original') : null,
                    genreIds: tvShow.genreIds ? JSON.parse(tvShow.genreIds) : [],
                    status: tvShow.status,
                    images: tvShow.images ? JSON.parse(tvShow.images) : null,
                    credits: tvShow.credits ? JSON.parse(tvShow.credits) : null,
                },
            })
        }

        // Fetch from TMDB API
        const config = await prisma.tmdbConfig.findFirst()
        if (!config?.apiKey) {
            if (tvShow) {
                // ... (keep existing partial cache logic)
                return NextResponse.json({
                    source: 'cache-partial',
                    data: {
                        id: tvShow.id,
                        name: tvShow.name,
                        nameCn: tvShow.nameCn,
                        originalName: tvShow.originalName,
                        overview: tvShow.overviewCn || tvShow.overview,
                        firstAirDate: tvShow.firstAirDate,
                        lastAirDate: tvShow.lastAirDate,
                        numberOfSeasons: tvShow.numberOfSeasons,
                        numberOfEpisodes: tvShow.numberOfEpisodes,
                        voteAverage: tvShow.voteAverage,
                        voteCount: tvShow.voteCount,
                        posterUrl: tvShow.posterPath ? TmdbClient.getImageUrl(tvShow.posterPath, 'w500') : null,
                        backdropUrl: tvShow.backdropPath ? TmdbClient.getImageUrl(tvShow.backdropPath, 'original') : null,
                        genreIds: tvShow.genreIds ? JSON.parse(tvShow.genreIds) : [],
                        status: tvShow.status,
                        images: tvShow.images ? JSON.parse(tvShow.images) : null,
                        credits: null,
                    },
                })
            }
            return NextResponse.json(
                { error: '未配置 TMDB API Key，且本地缓存中未找到该电视剧' },
                { status: 404 }
            )
        }

        const client = new TmdbClient(config.apiKey, config.language)

        try {
            const tmdbTv = await client.getTvShow(tvId)
            const translations = await client.getTvTranslations(tvId)
            const cn = extractChineseTranslation(translations)

            const tvData = {
                id: tmdbTv.id,
                name: tmdbTv.name,
                originalName: tmdbTv.original_name,
                nameCn: cn?.name || cn?.title,
                overview: tmdbTv.overview,
                overviewCn: cn?.overview,
                firstAirDate: tmdbTv.first_air_date,
                lastAirDate: tmdbTv.last_air_date,
                numberOfSeasons: tmdbTv.number_of_seasons,
                numberOfEpisodes: tmdbTv.number_of_episodes,
                popularity: tmdbTv.popularity,
                voteAverage: tmdbTv.vote_average,
                voteCount: tmdbTv.vote_count,
                posterPath: tmdbTv.poster_path,
                backdropPath: tmdbTv.backdrop_path,
                genreIds: tmdbTv.genres ? JSON.stringify(tmdbTv.genres.map(g => g.id)) : null,
                status: tmdbTv.status,
                images: tmdbTv.images ? JSON.stringify(tmdbTv.images) : null,
                credits: tmdbTv.credits ? JSON.stringify(tmdbTv.credits) : null,
                isFullySynced: true, // Marked as full sync
            }

            // Update or Create cache
            await tmdbPrisma.tmdbTvShow.upsert({
                where: { id: tmdbTv.id },
                update: tvData,
                create: tvData,
            })

            return NextResponse.json({
                source: 'api',
                data: {
                    id: tmdbTv.id,
                    name: tmdbTv.name,
                    nameCn: cn?.name || cn?.title,
                    originalName: tmdbTv.original_name,
                    overview: cn?.overview || tmdbTv.overview,
                    firstAirDate: tmdbTv.first_air_date,
                    lastAirDate: tmdbTv.last_air_date,
                    numberOfSeasons: tmdbTv.number_of_seasons,
                    numberOfEpisodes: tmdbTv.number_of_episodes,
                    voteAverage: tmdbTv.vote_average,
                    voteCount: tmdbTv.vote_count,
                    posterUrl: tmdbTv.poster_path ? TmdbClient.getImageUrl(tmdbTv.poster_path, 'w500') : null,
                    backdropUrl: tmdbTv.backdrop_path ? TmdbClient.getImageUrl(tmdbTv.backdrop_path, 'original') : null,
                    genres: tmdbTv.genres,
                    status: tmdbTv.status,
                    images: tmdbTv.images,
                    credits: tmdbTv.credits,
                },
            })
        } catch {
            return NextResponse.json({ error: 'TV show not found' }, { status: 404 })
        }
    } catch (error) {
        console.error('[TMDB] Failed to get TV show:', error)
        return NextResponse.json({ error: 'Failed to get TV show' }, { status: 500 })
    }
}
