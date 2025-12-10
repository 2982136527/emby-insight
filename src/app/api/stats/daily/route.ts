import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays } from 'date-fns'

// GET /api/stats/daily - Get today's viewing statistics
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const dateParam = searchParams.get('date')

        // Use provided date or today
        const targetDate = dateParam ? new Date(dateParam) : new Date()
        const dayStart = startOfDay(targetDate)
        const dayEnd = endOfDay(targetDate)

        // Get today's play history
        const todayHistory = await prisma.playHistory.findMany({
            where: {
                playedAt: {
                    gte: dayStart,
                    lte: dayEnd,
                },
            },
            include: {
                serverUser: {
                    include: {
                        globalUser: true,
                    },
                },
            },
            orderBy: { playedAt: 'desc' },
        })

        // Get today's session logs
        const todaySessions = await prisma.sessionLog.findMany({
            where: {
                startedAt: {
                    gte: dayStart,
                    lte: dayEnd,
                },
            },
            orderBy: { startedAt: 'desc' },
        })

        // Calculate stats
        let totalDuration = 0
        const totalItems = todayHistory.length
        const uniqueUsers = new Set(todayHistory.map(h => h.serverUserId)).size

        // Group by user (Server User)
        const userStats = new Map<string, { name: string; duration: number; count: number; items: string[] }>()

        // Group by Item
        const itemStats = new Map<string, { name: string; type: string; duration: number; count: number }>()

        // Group by Genres
        const genreStats = new Map<string, number>()

        // Hourly Data
        const hourlyData = new Array(24).fill(0)

        // Quality Stats
        let hdrCount = 0
        let count4k = 0
        let count1080p = 0

        for (const record of todayHistory) {
            // Calculate Real Duration
            const playCount = Number(record.playCount || 0)
            const itemDuration = Number(record.duration || 0)
            const currentPosition = Number(record.playbackPosition || 0)

            // Formula: (PlayCount * Duration) + Position
            let realDuration = 0
            if (playCount > 0) {
                realDuration += (playCount * itemDuration)
            }
            realDuration += currentPosition

            // Add to total
            totalDuration += realDuration

            // User Stats (Use Server User Name)
            const userName = record.serverUser?.username || 'Unknown'
            const existingUser = userStats.get(userName) || { name: userName, duration: 0, count: 0, items: [] }
            existingUser.duration += realDuration
            existingUser.count += 1
            if (!existingUser.items.includes(record.itemName)) {
                existingUser.items.push(record.itemName)
            }
            userStats.set(userName, existingUser)

            // Item Stats
            const key = record.itemId
            const existingItem = itemStats.get(key) || {
                name: record.seriesName ? `${record.seriesName} - ${record.itemName}` : record.itemName,
                type: record.itemType,
                duration: 0,
                count: 0
            }
            existingItem.duration += realDuration
            existingItem.count += 1
            itemStats.set(key, existingItem)

            // Genre Stats
            try {
                const genres: string[] = JSON.parse(record.genres || '[]')
                for (const genre of genres) {
                    const clean = genre.trim()
                    if (clean && !clean.includes(':') && clean.length <= 20) {
                        genreStats.set(clean, (genreStats.get(clean) || 0) + realDuration)
                    }
                }
            } catch { /* skip */ }

            // Hourly Data
            const hour = new Date(record.playedAt).getHours()
            hourlyData[hour] += realDuration

            // Quality Stats
            if (record.isHdr) hdrCount++
            const res = record.resolution?.toLowerCase() || ''
            if (res.includes('4k') || res.includes('2160')) count4k++
            else if (res.includes('1080')) count1080p++
        }

        // Client Stats (from SessionLog)
        const clientStats = new Map<string, number>()
        for (const session of todaySessions) {
            const client = session.client || 'Unknown'
            clientStats.set(client, (clientStats.get(client) || 0) + 1)
        }

        // Yesterday Comparison
        const yesterdayStart = startOfDay(subDays(targetDate, 1))
        const yesterdayEnd = endOfDay(subDays(targetDate, 1))

        const yesterdayHistory = await prisma.playHistory.findMany({
            where: {
                playedAt: {
                    gte: yesterdayStart,
                    lte: yesterdayEnd,
                },
            },
            select: {
                playCount: true,
                duration: true,
                playbackPosition: true,
            }
        })

        let yesterdayDuration = 0
        for (const record of yesterdayHistory) {
            const playCount = Number(record.playCount || 0)
            const itemDuration = Number(record.duration || 0)
            const currentPosition = Number(record.playbackPosition || 0)

            if (playCount > 0) {
                yesterdayDuration += (playCount * itemDuration)
            }
            yesterdayDuration += currentPosition
        }

        const durationTrend = yesterdayDuration > 0
            ? ((totalDuration - yesterdayDuration) / yesterdayDuration) * 100
            : 0

        // Sort and limit
        const topUsers = Array.from(userStats.values())
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5)

        const topItems = Array.from(itemStats.values())
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5)

        const topGenres = Array.from(genreStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([genre, duration]) => ({ genre, duration }))

        const topClients = Array.from(clientStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([client, count]) => ({ client, count }))

        // Peak hour
        let peakHour = 0
        let peakValue = 0
        hourlyData.forEach((value, hour) => {
            if (value > peakValue) {
                peakValue = value
                peakHour = hour
            }
        })

        return NextResponse.json({
            date: targetDate.toISOString().split('T')[0],
            summary: {
                totalDuration,
                totalItems,
                uniqueUsers,
                totalSessions: todaySessions.length,
                peakHour: `${peakHour.toString().padStart(2, '0')}:00`,
                durationTrend,
            },
            topUsers,
            topItems,
            topGenres,
            topClients,
            quality: {
                hdrCount,
                count4k,
                count1080p,
                total: totalItems,
            },
            hourlyData,
            recentItems: todayHistory.slice(0, 10).map(h => {
                const pc = Number(h.playCount || 0)
                const d = Number(h.duration || 0)
                const p = Number(h.playbackPosition || 0)
                const rd = (pc > 0 ? pc * d : 0) + p
                return {
                    name: h.seriesName ? `${h.seriesName} - ${h.itemName}` : h.itemName,
                    type: h.itemType,
                    user: h.serverUser?.username,
                    duration: rd,
                    playedAt: h.playedAt,
                }
            }),
        })
    } catch (error) {
        console.error('[API] Failed to get daily stats:', error)
        return NextResponse.json({ error: 'Failed to get daily stats' }, { status: 500 })
    }
}
