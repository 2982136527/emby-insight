import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays, format } from 'date-fns'

// GET /api/stats/dashboard - Get dashboard statistics
export async function GET() {
    try {
        const now = new Date()
        const thirtyDaysAgo = subDays(now, 30)

        // Total stats
        const totalStats = await prisma.playHistory.aggregate({
            _sum: {
                playDuration: true,
            },
            _count: true,
        })

        // Unique items count (Total)
        // Group by itemId to get distinct count
        const uniqueItemsCount = await prisma.playHistory.groupBy({
            by: ['itemId'],
            _count: {
                _all: true // This effectively counts rows per group, but we just want the number of groups
            }
        }).then(groups => groups.length)

        // Unique active days
        const activeDays = await prisma.playHistory.groupBy({
            by: ['playedAt'],
            _count: true,
        })
        const uniqueDays = new Set(
            activeDays.map((d) => format(new Date(d.playedAt), 'yyyy-MM-dd'))
        ).size

        // Server distribution
        const serverStats = await prisma.playHistory.groupBy({
            by: ['serverId'],
            _sum: {
                playDuration: true,
            },
            _count: true,
        })

        const servers = await prisma.server.findMany({
            select: { id: true, name: true },
        })

        const serverDistribution = serverStats.map((stat) => ({
            serverId: stat.serverId,
            serverName: servers.find((s) => s.id === stat.serverId)?.name || 'Unknown',
            playDuration: Number(stat._sum.playDuration || 0),
            playCount: stat._count,
        }))

        // Daily trend (last 30 days)
        const dailyHistory = await prisma.playHistory.findMany({
            where: {
                playedAt: { gte: thirtyDaysAgo },
            },
            select: {
                playedAt: true,
                playDuration: true,
            },
        })

        // Group by day
        const dailyMap = new Map<string, number>()
        for (let i = 0; i < 30; i++) {
            const day = format(subDays(now, i), 'yyyy-MM-dd')
            dailyMap.set(day, 0)
        }

        dailyHistory.forEach((record) => {
            const day = format(new Date(record.playedAt), 'yyyy-MM-dd')
            if (dailyMap.has(day)) {
                dailyMap.set(day, (dailyMap.get(day) || 0) + Number(record.playDuration))
            }
        })

        const dailyTrend = Array.from(dailyMap.entries())
            .map(([date, duration]) => ({ date, duration }))
            .reverse()

        // Calculate week-over-week comparison
        const thisWeek = dailyTrend.slice(-7).reduce((sum, d) => sum + d.duration, 0)
        const lastWeek = dailyTrend.slice(-14, -7).reduce((sum, d) => sum + d.duration, 0)
        const weekChange = lastWeek > 0
            ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
            : 0

        // Top watched items
        const topItems = await prisma.playHistory.groupBy({
            by: ['itemId', 'itemName', 'itemType'],
            _sum: {
                playDuration: true,
            },
            _count: true,
            orderBy: {
                _count: {
                    itemId: 'desc',
                },
            },
            take: 10,
        })

        // Recent activity
        const recentActivity = await prisma.playHistory.findMany({
            orderBy: { playedAt: 'desc' },
            take: 10,
            include: {
                serverUser: {
                    select: {
                        username: true,
                        globalUser: {
                            select: { name: true },
                        },
                    },
                },
                server: {
                    select: { id: true, name: true },
                },
            },
        })

        // Item type distribution
        const itemTypeStats = await prisma.playHistory.groupBy({
            by: ['itemType'],
            _sum: {
                playDuration: true,
            },
            _count: true,
        })

        // Fetch serverId for top items to display images
        const topItemsWithImages = await Promise.all(
            topItems.map(async (item) => {
                const history = await prisma.playHistory.findFirst({
                    where: { itemId: item.itemId },
                    select: { serverId: true },
                })
                return {
                    itemId: item.itemId,
                    itemName: item.itemName,
                    imageUrl: history?.serverId
                        ? `/api/image?serverId=${history.serverId}&itemId=${item.itemId}`
                        : null,
                    itemType: item.itemType,
                    playDuration: Number(item._sum.playDuration || 0),
                    playCount: item._count,
                    serverId: history?.serverId,
                }
            })
        )

        // Today's stats
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Count unique items for today
        // We use groupBy because we want distinct itemIds
        const todayStats = await prisma.playHistory.groupBy({
            by: ['itemId'],
            where: {
                playedAt: { gte: today },
            },
        })
        const todayUniqueCount = todayStats.length

        return NextResponse.json({
            overview: {
                totalPlayDuration: Number(totalStats._sum.playDuration || 0),
                totalPlayCount: totalStats._count,
                totalItemCount: uniqueItemsCount,
                todayPlayCount: todayUniqueCount,
                activeDays: uniqueDays,
                serverCount: servers.length,
                weekChange,
            },
            serverDistribution,
            dailyTrend,
            topItems: topItemsWithImages,
            recentActivity: recentActivity.map((activity) => ({
                id: activity.id,
                imageUrl: `/api/image?serverId=${activity.serverId}&itemId=${activity.itemId}`,
                itemId: activity.itemId,
                itemName: activity.itemName,
                itemType: activity.itemType,
                seriesName: activity.seriesName,
                playedAt: activity.playedAt,
                playDuration: Number(activity.playDuration),
                totalDuration: Number(activity.duration),
                playbackPosition: Number(activity.playbackPosition),
                userName: activity.serverUser.globalUser?.name || activity.serverUser.username,
                serverName: activity.server.name,
                serverId: activity.server.id,
            })),
            itemTypeStats: itemTypeStats.map((stat) => ({
                type: stat.itemType,
                playDuration: Number(stat._sum.playDuration || 0),
                playCount: stat._count,
            })),
        })
    } catch (error) {
        console.error('[API] Failed to get dashboard stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch dashboard statistics' },
            { status: 500 }
        )
    }
}
