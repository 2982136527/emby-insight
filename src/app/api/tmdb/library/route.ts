import { NextRequest, NextResponse } from 'next/server'
import { tmdbPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'movie' // movie | tv
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    const search = searchParams.get('search') // keyword
    const genre = searchParams.get('genre') // genre id

    // 构建查询条件
    const where: any = {}

    if (search) {
        if (type === 'movie') {
            where.OR = [
                { title: { contains: search } },
                { titleCn: { contains: search } },
                { originalTitle: { contains: search } },
            ]
        } else {
            where.OR = [
                { name: { contains: search } },
                { nameCn: { contains: search } },
                { originalName: { contains: search } },
            ]
        }
    }

    if (genre) {
        where.genreIds = { contains: genre }
    }

    try {
        if (type === 'movie') {
            const [data, total] = await Promise.all([
                tmdbPrisma.tmdbMovie.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: {
                        popularity: 'desc',
                    },
                    select: {
                        id: true,
                        title: true,
                        titleCn: true,
                        posterPath: true,
                        voteAverage: true,
                        releaseDate: true,
                    }
                }),
                tmdbPrisma.tmdbMovie.count({ where }),
            ])

            return NextResponse.json({
                items: data.map(item => ({
                    id: item.id,
                    title: item.titleCn || item.title,
                    posterPath: item.posterPath,
                    subtitle: item.releaseDate?.split('-')[0], // Year
                    rating: item.voteAverage,
                })),
                total,
                page,
                totalPages: Math.ceil(total / limit),
            })
        } else {
            const [data, total] = await Promise.all([
                tmdbPrisma.tmdbTvShow.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: {
                        popularity: 'desc',
                    },
                    select: {
                        id: true,
                        name: true,
                        nameCn: true,
                        posterPath: true,
                        voteAverage: true,
                        firstAirDate: true,
                    }
                }),
                tmdbPrisma.tmdbTvShow.count({ where }),
            ])

            return NextResponse.json({
                items: data.map(item => ({
                    id: item.id,
                    title: item.nameCn || item.name,
                    posterPath: item.posterPath,
                    subtitle: item.firstAirDate?.split('-')[0], // Year
                    rating: item.voteAverage,
                })),
                total,
                page,
                totalPages: Math.ceil(total / limit),
            })
        }
    } catch (error) {
        console.error('Failed to fetch TMDB library:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
