import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays, startOfDay, format } from 'date-fns'

// GET /api/stats/trends - Get daily viewing trends for past 7/30 days
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const days = parseInt(searchParams.get('days') || '7')
        const limitDays = Math.min(days, 90) // Max 90 days

        const startDate = startOfDay(subDays(new Date(), limitDays))

        const history = await prisma.playHistory.findMany({
            where: {
                playedAt: { gte: startDate }
            },
            select: {
                playedAt: true,
                playDuration: true,
            },
        })

        // Group by date
        const dailyData: Record<string, { duration: number; count: number }> = {}

        // Initialize all days with 0
        for (let i = 0; i < limitDays; i++) {
            const date = format(subDays(new Date(), limitDays - 1 - i), 'yyyy-MM-dd')
            dailyData[date] = { duration: 0, count: 0 }
        }

        // Aggregate data
        history.forEach((record) => {
            const date = format(new Date(record.playedAt), 'yyyy-MM-dd')
            if (dailyData[date]) {
                dailyData[date].duration += Number(record.playDuration)
                dailyData[date].count += 1
            }
        })

        // Convert to array and calculate comparison
        const trends = Object.entries(dailyData).map(([date, data]) => ({
            date,
            label: format(new Date(date), 'MM/dd'),
            duration: data.duration,
            hours: Math.round(data.duration / 10000000 / 3600 * 10) / 10, // Convert ticks to hours
            count: data.count,
        }))

        // Calculate period comparison
        const halfPoint = Math.floor(trends.length / 2)
        const firstHalf = trends.slice(0, halfPoint)
        const secondHalf = trends.slice(halfPoint)

        const firstHalfTotal = firstHalf.reduce((sum, d) => sum + d.duration, 0)
        const secondHalfTotal = secondHalf.reduce((sum, d) => sum + d.duration, 0)

        const changePercent = firstHalfTotal > 0
            ? Math.round(((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100)
            : 0

        return NextResponse.json({
            trends,
            summary: {
                totalDuration: trends.reduce((sum, d) => sum + d.duration, 0),
                totalCount: trends.reduce((sum, d) => sum + d.count, 0),
                avgDailyHours: Math.round(trends.reduce((sum, d) => sum + d.hours, 0) / trends.length * 10) / 10,
                changePercent,
                changeDirection: changePercent >= 0 ? 'up' : 'down',
            }
        })
    } catch (error) {
        console.error('[API] Failed to get trends:', error)
        return NextResponse.json(
            { error: 'Failed to fetch trends' },
            { status: 500 }
        )
    }
}
