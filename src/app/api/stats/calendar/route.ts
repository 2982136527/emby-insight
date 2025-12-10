import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns'
import { buildServerUserIdFilter } from '@/lib/user-utils'

// GET /api/stats/calendar - Get calendar view data
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const month = searchParams.get('month') || format(new Date(), 'yyyy-MM')
        const userId = searchParams.get('userId')

        // Parse month to get date range
        const monthDate = parseISO(`${month}-01`)
        const start = startOfMonth(monthDate)
        const end = endOfMonth(monthDate)

        const whereClause: any = {
            playedAt: { gte: start, lte: end }
        }
        if (userId) {
            const serverUserIdFilter = await buildServerUserIdFilter(userId)
            if (!serverUserIdFilter) {
                return NextResponse.json({ month, days: [], summary: { totalDuration: 0, totalCount: 0, activeDays: 0, avgDailyHours: 0 } })
            }
            whereClause.serverUserId = serverUserIdFilter
        }

        const history = await prisma.playHistory.findMany({
            where: whereClause,
            select: {
                playedAt: true,
                playDuration: true,
                itemName: true,
                itemType: true,
                seriesName: true,
                serverId: true,
                itemId: true,
                serverUserId: true,
            },
            orderBy: { playedAt: 'desc' },
        })

        // Group by day
        const dailyData: Record<string, {
            duration: number;
            count: number;
            userIds: Set<string>;
            items: Array<{ name: string; type: string; seriesName?: string; serverId: string; itemId: string }>
        }> = {}

        history.forEach((record) => {
            const day = format(new Date(record.playedAt), 'yyyy-MM-dd')
            if (!dailyData[day]) {
                dailyData[day] = { duration: 0, count: 0, userIds: new Set(), items: [] }
            }
            dailyData[day].duration += Number(record.playDuration)
            dailyData[day].count += 1
            if (record.serverUserId) {
                dailyData[day].userIds.add(record.serverUserId)
            }
            if (dailyData[day].items.length < 5) {
                dailyData[day].items.push({
                    name: record.itemName,
                    type: record.itemType,
                    seriesName: record.seriesName || undefined,
                    serverId: record.serverId,
                    itemId: record.itemId,
                })
            }
        })

        // Calculate month stats
        const totalDuration = Object.values(dailyData).reduce((sum, d) => sum + d.duration, 0)
        const totalCount = Object.values(dailyData).reduce((sum, d) => sum + d.count, 0)
        const activeDays = Object.keys(dailyData).length

        return NextResponse.json({
            month,
            days: Object.entries(dailyData).map(([date, data]) => ({
                date,
                duration: data.duration,
                count: data.count,
                userCount: data.userIds.size,
                items: data.items,
                hours: Math.round(data.duration / 10000000 / 3600 * 10) / 10,
            })),
            summary: {
                totalDuration,
                totalCount,
                activeDays,
                avgDailyHours: activeDays > 0
                    ? Math.round((totalDuration / 10000000 / 3600 / activeDays) * 10) / 10
                    : 0,
            }
        })
    } catch (error) {
        console.error('[API] Calendar failed:', error)
        return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
    }
}
