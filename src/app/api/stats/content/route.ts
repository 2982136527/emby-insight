import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildServerUserIdFilter } from '@/lib/user-utils'

// GET /api/stats/content - Get content-based statistics
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const serverIds = searchParams.get('serverIds')?.split(',')

        const whereClause: any = {}
        if (userId) {
            const serverUserIdFilter = await buildServerUserIdFilter(userId)
            if (!serverUserIdFilter) {
                return NextResponse.json({ genres: [], itemTypes: [], resolutions: [], hdr: [], years: [] })
            }
            whereClause.serverUserId = serverUserIdFilter
        }
        if (serverIds?.length) {
            whereClause.serverId = { in: serverIds }
        }

        // Genre distribution
        const history = await prisma.playHistory.findMany({
            where: whereClause,
            select: {
                genres: true,
                playDuration: true,
            },
        })

        const genreMap = new Map<string, number>()
        history.forEach((record) => {
            try {
                const genres = JSON.parse(record.genres) as string[]
                genres.forEach((genre) => {
                    genreMap.set(genre, (genreMap.get(genre) || 0) + Number(record.playDuration))
                })
            } catch {
                // Skip invalid genre data
            }
        })

        const genreStats = Array.from(genreMap.entries())
            .map(([genre, duration]) => ({ genre, duration }))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 15)

        // Item type distribution
        const itemTypeStats = await prisma.playHistory.groupBy({
            by: ['itemType'],
            where: whereClause,
            _sum: {
                playDuration: true,
            },
            _count: true,
        })

        // Resolution distribution
        const resolutionStats = await prisma.playHistory.groupBy({
            by: ['resolution'],
            _sum: {
                playDuration: true,
            },
            _count: true,
            where: {
                ...whereClause,
                resolution: { not: null },
            },
        })

        // HDR vs SDR
        const hdrStats = await prisma.playHistory.groupBy({
            by: ['isHdr'],
            where: whereClause,
            _sum: {
                playDuration: true,
            },
            _count: true,
        })

        // Year distribution
        const yearStats = await prisma.playHistory.groupBy({
            by: ['year'],
            _sum: {
                playDuration: true,
            },
            _count: true,
            where: {
                ...whereClause,
                year: { not: null },
            },
            orderBy: {
                year: 'desc',
            },
            take: 20,
        })

        return NextResponse.json({
            genres: genreStats,
            itemTypes: itemTypeStats.map((stat) => ({
                type: stat.itemType,
                duration: Number(stat._sum.playDuration || 0),
                count: stat._count,
            })),
            resolutions: resolutionStats.map((stat) => ({
                resolution: stat.resolution || 'Unknown',
                duration: Number(stat._sum.playDuration || 0),
                count: stat._count,
            })),
            hdr: hdrStats.map((stat) => ({
                type: stat.isHdr ? 'HDR' : 'SDR',
                duration: Number(stat._sum.playDuration || 0),
                count: stat._count,
            })),
            years: yearStats.map((stat) => ({
                year: stat.year,
                duration: Number(stat._sum.playDuration || 0),
                count: stat._count,
            })),
        })
    } catch (error) {
        console.error('[API] Failed to get content stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch content statistics' },
            { status: 500 }
        )
    }
}
