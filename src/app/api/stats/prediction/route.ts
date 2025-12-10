import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, subDays, getHours, getDay } from 'date-fns'
import { buildServerUserIdFilter } from '@/lib/user-utils'

interface HourlyPattern {
    hour: number
    dayOfWeek: number  // 0 = Sunday, 1 = Monday, etc.
    totalDuration: number
    playCount: number
}

// GET /api/stats/prediction - Analyze viewing patterns and predict likely watch times
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')

        const sevenDaysAgo = subDays(new Date(), 7)

        // Build where clause
        const whereClause: any = {
            playedAt: { gte: sevenDaysAgo },
        }

        // Add user filter if provided
        if (userId) {
            const serverUserIdFilter = await buildServerUserIdFilter(userId)
            if (!serverUserIdFilter) {
                return NextResponse.json({
                    heatmap: [],
                    peakHours: [],
                    prediction: { currentHour: getHours(new Date()), currentDay: getDay(new Date()), currentDayName: '暂无', nextLikelyHour: -1, nextLikelyLabel: '暂无预测' },
                    userPatterns: [],
                })
            }
            whereClause.serverUserId = serverUserIdFilter
        }

        // Get play history from last 7 days
        const history = await prisma.playHistory.findMany({
            where: whereClause,
            select: {
                playedAt: true,
                playDuration: true,
                serverUser: {
                    select: {
                        username: true,
                        globalUser: { select: { name: true } },
                    },
                },
            },
        })

        // Build hourly pattern matrix (7 days x 24 hours)
        const patternMatrix: number[][] = Array.from({ length: 7 }, () =>
            Array(24).fill(0)
        )

        // Also track per-user patterns (server users) and global user patterns
        const userPatterns = new Map<string, { name: string; hourlyData: number[]; isGlobal: boolean }>()
        const globalUserPatterns = new Map<string, { name: string; hourlyData: number[] }>()

        for (const record of history) {
            const hour = getHours(record.playedAt)
            const dayOfWeek = getDay(record.playedAt)
            const duration = Number(record.playDuration)

            patternMatrix[dayOfWeek][hour] += duration

            // Track server user patterns
            const userName = record.serverUser.username
            if (!userPatterns.has(userName)) {
                userPatterns.set(userName, {
                    name: userName,
                    hourlyData: Array(24).fill(0),
                    isGlobal: false,
                })
            }
            userPatterns.get(userName)!.hourlyData[hour] += duration

            // Track global user patterns (aggregate)
            const globalName = record.serverUser.globalUser?.name
            if (globalName) {
                if (!globalUserPatterns.has(globalName)) {
                    globalUserPatterns.set(globalName, {
                        name: globalName,
                        hourlyData: Array(24).fill(0),
                    })
                }
                globalUserPatterns.get(globalName)!.hourlyData[hour] += duration
            }
        }

        // Find peak hours (top 3 hours with most activity)
        const hourlyTotals = Array(24).fill(0)
        patternMatrix.forEach((day) => {
            day.forEach((duration, hour) => {
                hourlyTotals[hour] += duration
            })
        })

        const peakHours = hourlyTotals
            .map((total, hour) => ({ hour, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 3)
            .map((x) => x.hour)

        // Get current hour prediction
        const now = new Date()
        const currentHour = getHours(now)
        const currentDay = getDay(now)

        // Predict next likely watch time
        let nextPredictedHour = -1
        let maxActivity = 0
        for (let offset = 1; offset <= 24; offset++) {
            const checkHour = (currentHour + offset) % 24
            if (hourlyTotals[checkHour] > maxActivity) {
                maxActivity = hourlyTotals[checkHour]
                nextPredictedHour = checkHour
            }
        }

        // Convert to heatmap format for frontend
        const heatmapData = []
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                heatmapData.push({
                    day,
                    dayName: dayNames[day],
                    hour,
                    hourLabel: `${hour.toString().padStart(2, '0')}:00`,
                    value: patternMatrix[day][hour],
                })
            }
        }

        // Normalize values for color intensity
        const maxValue = Math.max(...heatmapData.map((d) => d.value), 1)
        const normalizedHeatmap = heatmapData.map((d) => ({
            ...d,
            intensity: d.value / maxValue,
        }))

        // User patterns summary (server users)
        const userSummary = Array.from(userPatterns.values())
            .map((user) => {
                const peakHour = user.hourlyData.indexOf(Math.max(...user.hourlyData))
                return {
                    name: user.name,
                    peakHour,
                    peakHourLabel: `${peakHour.toString().padStart(2, '0')}:00`,
                    isGlobal: false,
                }
            })
            .slice(0, 10)

        // Global user patterns summary
        const globalSummary = Array.from(globalUserPatterns.values())
            .map((user) => {
                const peakHour = user.hourlyData.indexOf(Math.max(...user.hourlyData))
                return {
                    name: user.name,
                    peakHour,
                    peakHourLabel: `${peakHour.toString().padStart(2, '0')}:00`,
                    isGlobal: true,
                }
            })

        return NextResponse.json({
            heatmap: normalizedHeatmap,
            peakHours: peakHours.map((h) => ({
                hour: h,
                label: `${h.toString().padStart(2, '0')}:00`,
            })),
            prediction: {
                currentHour,
                currentDay,
                currentDayName: dayNames[currentDay],
                nextLikelyHour: nextPredictedHour,
                nextLikelyLabel: nextPredictedHour >= 0
                    ? `${nextPredictedHour.toString().padStart(2, '0')}:00`
                    : '暂无预测',
            },
            userPatterns: [...globalSummary, ...userSummary],
        })
    } catch (error) {
        console.error('[API] Failed to get prediction:', error)
        return NextResponse.json({ error: 'Failed to get prediction' }, { status: 500 })
    }
}
