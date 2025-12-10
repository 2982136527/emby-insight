import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'

interface ComparisonPeriod {
    current: {
        playDuration: number
        playCount: number
        startDate: Date
        endDate: Date
    }
    previous: {
        playDuration: number
        playCount: number
        startDate: Date
        endDate: Date
    }
    change: {
        durationPercent: number
        countPercent: number
    }
}

// GET /api/stats/comparison - Get week-over-week and month-over-month comparisons
export async function GET() {
    try {
        const now = new Date()

        // Week comparison (this week vs last week)
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
        const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
        const lastWeekStart = subWeeks(thisWeekStart, 1)
        const lastWeekEnd = subWeeks(thisWeekEnd, 1)

        const [thisWeekStats, lastWeekStats] = await Promise.all([
            prisma.playHistory.aggregate({
                where: {
                    playedAt: { gte: thisWeekStart, lte: thisWeekEnd },
                },
                _sum: { playDuration: true },
                _count: true,
            }),
            prisma.playHistory.aggregate({
                where: {
                    playedAt: { gte: lastWeekStart, lte: lastWeekEnd },
                },
                _sum: { playDuration: true },
                _count: true,
            }),
        ])

        const weekComparison: ComparisonPeriod = {
            current: {
                playDuration: Number(thisWeekStats._sum.playDuration || 0),
                playCount: thisWeekStats._count,
                startDate: thisWeekStart,
                endDate: thisWeekEnd,
            },
            previous: {
                playDuration: Number(lastWeekStats._sum.playDuration || 0),
                playCount: lastWeekStats._count,
                startDate: lastWeekStart,
                endDate: lastWeekEnd,
            },
            change: {
                durationPercent: calculatePercentChange(
                    Number(lastWeekStats._sum.playDuration || 0),
                    Number(thisWeekStats._sum.playDuration || 0)
                ),
                countPercent: calculatePercentChange(
                    lastWeekStats._count,
                    thisWeekStats._count
                ),
            },
        }

        // Month comparison (this month vs last month)
        const thisMonthStart = startOfMonth(now)
        const thisMonthEnd = endOfMonth(now)
        const lastMonthStart = startOfMonth(subMonths(now, 1))
        const lastMonthEnd = endOfMonth(subMonths(now, 1))

        const [thisMonthStats, lastMonthStats] = await Promise.all([
            prisma.playHistory.aggregate({
                where: {
                    playedAt: { gte: thisMonthStart, lte: thisMonthEnd },
                },
                _sum: { playDuration: true },
                _count: true,
            }),
            prisma.playHistory.aggregate({
                where: {
                    playedAt: { gte: lastMonthStart, lte: lastMonthEnd },
                },
                _sum: { playDuration: true },
                _count: true,
            }),
        ])

        const monthComparison: ComparisonPeriod = {
            current: {
                playDuration: Number(thisMonthStats._sum.playDuration || 0),
                playCount: thisMonthStats._count,
                startDate: thisMonthStart,
                endDate: thisMonthEnd,
            },
            previous: {
                playDuration: Number(lastMonthStats._sum.playDuration || 0),
                playCount: lastMonthStats._count,
                startDate: lastMonthStart,
                endDate: lastMonthEnd,
            },
            change: {
                durationPercent: calculatePercentChange(
                    Number(lastMonthStats._sum.playDuration || 0),
                    Number(thisMonthStats._sum.playDuration || 0)
                ),
                countPercent: calculatePercentChange(
                    lastMonthStats._count,
                    thisMonthStats._count
                ),
            },
        }

        // Today comparison (Today vs Yesterday)
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterdayStart = subDays(todayStart, 1)
        const yesterdayEnd = new Date(todayStart.getTime() - 1)

        const [todayStats, yesterdayStats] = await Promise.all([
            prisma.playHistory.aggregate({
                where: {
                    playedAt: { gte: todayStart },
                },
                _sum: { playDuration: true },
                _count: true,
            }),
            prisma.playHistory.aggregate({
                where: {
                    playedAt: { gte: yesterdayStart, lte: yesterdayEnd },
                },
                _sum: { playDuration: true },
                _count: true,
            }),
        ])

        const todayComparison: ComparisonPeriod = {
            current: {
                playDuration: Number(todayStats._sum.playDuration || 0),
                playCount: todayStats._count,
                startDate: todayStart,
                endDate: now,
            },
            previous: {
                playDuration: Number(yesterdayStats._sum.playDuration || 0),
                playCount: yesterdayStats._count,
                startDate: yesterdayStart,
                endDate: yesterdayEnd,
            },
            change: {
                durationPercent: calculatePercentChange(
                    Number(yesterdayStats._sum.playDuration || 0),
                    Number(todayStats._sum.playDuration || 0)
                ),
                countPercent: calculatePercentChange(
                    yesterdayStats._count,
                    todayStats._count
                ),
            },
        }

        return NextResponse.json({
            week: weekComparison,
            month: monthComparison,
            today: todayComparison,
        })
    } catch (error) {
        console.error('[API] Failed to get comparison stats:', error)
        return NextResponse.json({ error: 'Failed to get comparison' }, { status: 500 })
    }
}

function calculatePercentChange(previous: number, current: number): number {
    if (previous === 0) {
        return current > 0 ? 100 : 0
    }
    return Math.round(((current - previous) / previous) * 100)
}
