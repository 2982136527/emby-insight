import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHours, getDay } from 'date-fns'
import { buildServerUserIdFilter } from '@/lib/user-utils'

// GET /api/stats/time - Get time-based statistics
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const serverIds = searchParams.get('serverIds')?.split(',')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        const whereClause: any = {}
        if (userId) {
            const serverUserIdFilter = await buildServerUserIdFilter(userId)
            if (!serverUserIdFilter) {
                return NextResponse.json({ hourly: [], weekly: [], heatmap: [] })
            }
            whereClause.serverUserId = serverUserIdFilter
        }
        if (serverIds?.length) {
            whereClause.serverId = { in: serverIds }
        }
        if (startDate || endDate) {
            whereClause.playedAt = {}
            if (startDate) whereClause.playedAt.gte = new Date(startDate)
            if (endDate) whereClause.playedAt.lte = new Date(endDate)
        }

        const history = await prisma.playHistory.findMany({
            where: whereClause,
            select: {
                playedAt: true,
                playDuration: true,
            },
        })

        // Hourly distribution (24 hours)
        const hourlyData: number[] = new Array(24).fill(0)

        // Weekly distribution (7 days, 0 = Sunday)
        const weeklyData: number[] = new Array(7).fill(0)

        // Heatmap data (day x hour)
        const heatmapData: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))

        history.forEach((record) => {
            const date = new Date(record.playedAt)
            const hour = getHours(date)
            const dayOfWeek = getDay(date)

            hourlyData[hour] += Number(record.playDuration)
            weeklyData[dayOfWeek] += Number(record.playDuration)
            heatmapData[dayOfWeek][hour] += Number(record.playDuration)
        })

        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

        return NextResponse.json({
            hourly: hourlyData.map((duration, hour) => ({
                hour,
                label: `${hour.toString().padStart(2, '0')}:00`,
                duration,
            })),
            weekly: weeklyData.map((duration, day) => ({
                day,
                label: dayNames[day],
                shortLabel: dayNames[day],
                duration,
            })),
            heatmap: heatmapData.map((hours, day) => ({
                day: dayNames[day],
                hours: hours.map((duration, hour) => ({
                    hour,
                    duration,
                })),
            })),
        })
    } catch (error) {
        console.error('[API] Failed to get time stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch time statistics' },
            { status: 500 }
        )
    }
}
