import { NextRequest, NextResponse } from 'next/server'
import { prisma, tmdbPrisma } from '@/lib/prisma'
import { TmdbClient, extractChineseTranslation } from '@/lib/tmdb'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/tmdb/movie/[id] - 获取电影详情
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const movieId = parseInt(id)



        if (isNaN(movieId)) {
            return NextResponse.json({ error: 'Invalid movie ID' }, { status: 400 })
        }

        // Check local cache
        let movie = await tmdbPrisma.tmdbMovie.findUnique({
            where: { id: movieId },
        })

        // Only return cache if it has detailed info (credits)
        // If user just synced list (no credits) or old cache, we want to fetch full details
        if (movie && movie.credits) {
            return NextResponse.json({
                source: 'cache',
                data: {
                    id: movie.id,
                    imdbId: movie.imdbId,
                    title: movie.title,
                    titleCn: movie.titleCn,
                    originalTitle: movie.originalTitle,
                    overview: movie.overviewCn || movie.overview,
                    releaseDate: movie.releaseDate,
                    runtime: movie.runtime,
                    voteAverage: movie.voteAverage,
                    voteCount: movie.voteCount,
                    posterUrl: movie.posterPath ? TmdbClient.getImageUrl(movie.posterPath, 'w500') : null,
                    backdropUrl: movie.backdropPath ? TmdbClient.getImageUrl(movie.backdropPath, 'original') : null,
                    genreIds: movie.genreIds ? JSON.parse(movie.genreIds) : [],
                    isAdult: movie.isAdult,
                    images: movie.images ? JSON.parse(movie.images) : null,
                    credits: movie.credits ? JSON.parse(movie.credits) : null,
                },
            })
        }

        // Fetch from TMDB API (if cache missing or incomplete)
        const config = await prisma.tmdbConfig.findFirst()


        // If no API key and we have partial cache, return what we have properly
        if (!config?.apiKey) {
            if (movie) {
                return NextResponse.json({
                    source: 'cache-partial',
                    data: {
                        id: movie.id,
                        imdbId: movie.imdbId,
                        title: movie.title,
                        titleCn: movie.titleCn,
                        originalTitle: movie.originalTitle,
                        overview: movie.overviewCn || movie.overview,
                        releaseDate: movie.releaseDate,
                        runtime: movie.runtime,
                        voteAverage: movie.voteAverage,
                        voteCount: movie.voteCount,
                        posterUrl: movie.posterPath ? TmdbClient.getImageUrl(movie.posterPath, 'w500') : null,
                        backdropUrl: movie.backdropPath ? TmdbClient.getImageUrl(movie.backdropPath, 'original') : null,
                        genreIds: movie.genreIds ? JSON.parse(movie.genreIds) : [],
                        isAdult: movie.isAdult,
                        images: movie.images ? JSON.parse(movie.images) : null,
                        credits: null, // Explicitly null
                    },
                })
            }
            return NextResponse.json(
                { error: '未配置 TMDB API Key，且本地缓存中未找到该电影' },
                { status: 404 }
            )
        }

        const client = new TmdbClient(config.apiKey, config.language)

        try {
            const tmdbMovie = await client.getMovie(movieId)

            const translations = await client.getMovieTranslations(movieId)
            const cn = extractChineseTranslation(translations)

            const movieData = {
                id: tmdbMovie.id,
                imdbId: tmdbMovie.imdb_id,
                title: tmdbMovie.title,
                originalTitle: tmdbMovie.original_title,
                titleCn: cn?.title || cn?.name,
                overview: tmdbMovie.overview,
                overviewCn: cn?.overview,
                releaseDate: tmdbMovie.release_date,
                runtime: tmdbMovie.runtime,
                popularity: tmdbMovie.popularity,
                voteAverage: tmdbMovie.vote_average,
                voteCount: tmdbMovie.vote_count,
                posterPath: tmdbMovie.poster_path,
                backdropPath: tmdbMovie.backdrop_path,
                genreIds: tmdbMovie.genres ? JSON.stringify(tmdbMovie.genres.map(g => g.id)) : null,
                isAdult: tmdbMovie.adult,
                images: tmdbMovie.images ? JSON.stringify(tmdbMovie.images) : null,
                credits: tmdbMovie.credits ? JSON.stringify(tmdbMovie.credits) : null,
                isFullySynced: true, // Marked as full sync since we fetched details
            }

            // Update or Create cache
            await tmdbPrisma.tmdbMovie.upsert({
                where: { id: tmdbMovie.id },
                update: movieData,
                create: movieData,
            })

            return NextResponse.json({
                source: 'api',
                data: {
                    id: tmdbMovie.id,
                    imdbId: tmdbMovie.imdb_id,
                    title: tmdbMovie.title,
                    titleCn: cn?.title || cn?.name,
                    originalTitle: tmdbMovie.original_title,
                    overview: cn?.overview || tmdbMovie.overview,
                    releaseDate: tmdbMovie.release_date,
                    runtime: tmdbMovie.runtime,
                    voteAverage: tmdbMovie.vote_average,
                    voteCount: tmdbMovie.vote_count,
                    posterUrl: tmdbMovie.poster_path ? TmdbClient.getImageUrl(tmdbMovie.poster_path, 'w500') : null,
                    backdropUrl: tmdbMovie.backdrop_path ? TmdbClient.getImageUrl(tmdbMovie.backdrop_path, 'original') : null,
                    genres: tmdbMovie.genres,
                    isAdult: tmdbMovie.adult,
                    images: tmdbMovie.images,
                    credits: tmdbMovie.credits,
                },
            })
        } catch (e: any) {
            console.error('Inner fetch error:', e)
            return NextResponse.json({ error: 'Movie not found', details: e.message }, { status: 404 })
        }
    } catch (error) {
        console.error('[TMDB] Failed to get movie:', error)
        return NextResponse.json({ error: 'Failed to get movie' }, { status: 500 })
    }
}
