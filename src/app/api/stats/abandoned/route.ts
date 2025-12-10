import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/stats/abandoned - Get abandoned/dropped content analysis
export async function GET() {
    try {
        // Find items where user watched less than 30% and didn't complete
        const allHistory = await prisma.playHistory.findMany({
            where: {
                isCompleted: false,
            },
            include: {
                serverUser: {
                    select: {
                        username: true,
                        globalUser: { select: { name: true } },
                    },
                },
                server: { select: { name: true, id: true } },
            },
            orderBy: { playedAt: 'desc' },
        })

        // Filter to only items where progress < 30%
        const abandonedItems = allHistory
            .filter((record) => {
                const duration = Number(record.duration)
                const position = Number(record.playbackPosition)
                if (duration <= 0) return false
                const progress = (position / duration) * 100
                return progress > 0 && progress < 30
            })
            .map((record) => {
                const duration = Number(record.duration)
                const position = Number(record.playbackPosition)
                const progress = duration > 0 ? Math.round((position / duration) * 100) : 0

                return {
                    id: record.id,
                    itemId: record.itemId,
                    itemName: record.itemName,
                    itemType: record.itemType,
                    seriesName: record.seriesName,
                    imageUrl: `/api/image?serverId=${record.server.id}&itemId=${record.itemId}`,
                    playedAt: record.playedAt,
                    progress,
                    duration: Number(record.duration),
                    playbackPosition: position,
                    userName: record.serverUser.globalUser?.name || record.serverUser.username,
                    serverName: record.server.name,
                }
            })

        // Group by itemId to count how many times each item was abandoned
        const abandonedByItem = abandonedItems.reduce((acc, item) => {
            const key = item.itemId
            if (!acc[key]) {
                acc[key] = {
                    ...item,
                    abandonCount: 0,
                    users: [] as string[],
                }
            }
            acc[key].abandonCount++
            if (!acc[key].users.includes(item.userName)) {
                acc[key].users.push(item.userName)
            }
            return acc
        }, {} as Record<string, typeof abandonedItems[0] & { abandonCount: number; users: string[] }>)

        const topAbandoned = Object.values(abandonedByItem)
            .sort((a, b) => b.abandonCount - a.abandonCount)
            .slice(0, 50)

        return NextResponse.json({
            total: abandonedItems.length,
            byItem: topAbandoned,
            recent: abandonedItems.slice(0, 20),
        })
    } catch (error) {
        console.error('[API] Failed to get abandoned stats:', error)
        return NextResponse.json({ error: 'Failed to get abandoned stats' }, { status: 500 })
    }
}
