import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, subDays, format } from 'date-fns'

// GET /api/users/[id]/stats - Get detailed stats for a specific user
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Get user info
        const serverUser = await prisma.serverUser.findUnique({
            where: { id },
            include: {
                server: true,
                globalUser: true,
            },
        })

        if (!serverUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Get play history for this user
        const playHistory = await prisma.playHistory.findMany({
            where: { serverUserId: id },
            orderBy: { playedAt: 'desc' },
            include: { server: true },
        })

        // Calculate stats
        const totalDuration = playHistory.reduce((sum, h) => sum + Number(h.playDuration), 0)
        const totalItems = playHistory.length
        const completedItems = playHistory.filter(h => h.isCompleted).length
        const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

        // Genre distribution
        const genreStats = new Map<string, number>()
        for (const record of playHistory) {
            try {
                const genres: string[] = JSON.parse(record.genres || '[]')
                for (const genre of genres) {
                    const clean = genre.trim()
                    if (clean && !clean.includes(':') && clean.length <= 20) {
                        genreStats.set(clean, (genreStats.get(clean) || 0) + Number(record.playDuration))
                    }
                }
            } catch { /* skip */ }
        }
        const topGenres = Array.from(genreStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([genre, duration]) => ({ genre, duration }))

        // Hourly distribution
        const hourlyData = new Array(24).fill(0)
        for (const record of playHistory) {
            const hour = new Date(record.playedAt).getHours()
            hourlyData[hour] += Number(record.playDuration)
        }

        // Find peak hour
        let peakHour = 0
        let peakValue = 0
        hourlyData.forEach((value, hour) => {
            if (value > peakValue) {
                peakValue = value
                peakHour = hour
            }
        })

        // Daily activity for last 30 days
        const thirtyDaysAgo = subDays(new Date(), 30)
        const dailyData = new Map<string, number>()
        for (const record of playHistory) {
            if (record.playedAt >= thirtyDaysAgo) {
                const day = format(startOfDay(record.playedAt), 'yyyy-MM-dd')
                dailyData.set(day, (dailyData.get(day) || 0) + Number(record.playDuration))
            }
        }
        const activeDays = dailyData.size

        // Content type distribution
        const typeStats = new Map<string, { count: number; duration: number }>()
        for (const record of playHistory) {
            const existing = typeStats.get(record.itemType) || { count: 0, duration: 0 }
            existing.count++
            existing.duration += Number(record.playDuration)
            typeStats.set(record.itemType, existing)
        }

        // Recent history (last 20)
        const recentHistory = playHistory.slice(0, 20).map(h => ({
            id: h.id,
            itemId: h.itemId,
            itemName: h.itemName,
            itemType: h.itemType,
            seriesName: h.seriesName,
            duration: Number(h.playDuration),
            playedAt: h.playedAt,
            isCompleted: h.isCompleted,
            serverId: h.serverId,
        }))

        // Most watched items
        const itemStats = new Map<string, { name: string; type: string; duration: number; count: number; seriesName?: string }>()
        for (const record of playHistory) {
            const key = record.itemId
            const existing = itemStats.get(key) || {
                name: record.itemName,
                type: record.itemType,
                duration: 0,
                count: 0,
                seriesName: record.seriesName || undefined,
            }
            existing.duration += Number(record.playDuration)
            existing.count += 1
            itemStats.set(key, existing)
        }
        const topItems = Array.from(itemStats.values())
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 10)

        // Get session logs for this user (for real duration stats)
        const sessionLogs = await prisma.sessionLog.findMany({
            where: { userId: serverUser.embyUserId },
            orderBy: { startedAt: 'desc' },
            take: 50,
        })

        const totalRealDuration = sessionLogs.reduce((sum, s) => sum + Number(s.realDuration), 0)

        // Generate 30-day trend data
        const dailyTrend: Array<{ date: string; duration: number }> = []
        for (let i = 29; i >= 0; i--) {
            const day = format(subDays(new Date(), i), 'yyyy-MM-dd')
            dailyTrend.push({ date: day, duration: dailyData.get(day) || 0 })
        }

        // Device stats
        const deviceStats = await prisma.sessionLog.groupBy({
            by: ['deviceName', 'client'],
            where: { userId: serverUser.embyUserId },
            _count: {
                id: true
            },
            _max: {
                startedAt: true
            },
            orderBy: {
                _max: {
                    startedAt: 'desc'
                }
            }
        })

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Count unique items for today
        const todayPlayCount = new Set(
            playHistory
                .filter(h => new Date(h.playedAt) >= today)
                .map(h => h.itemId)
        ).size

        // Count unique items total
        const totalUniqueItems = new Set(playHistory.map(h => h.itemId)).size

        return NextResponse.json({
            user: {
                id: serverUser.id,
                username: serverUser.username,
                embyUserId: serverUser.embyUserId,
                serverName: serverUser.server.name,
                serverId: serverUser.serverId,
                globalUser: serverUser.globalUser,
            },
            summary: {
                totalDuration,
                totalRealDuration,
                totalItems, // keeping original 'totalItems' as 'play count' for now if needed, or we can replace usage
                totalUniqueItems, // New field for video count
                todayPlayCount,
                completedItems,
                completionRate: Math.round((completedItems / (totalItems || 1)) * 100),
                activeDays,
                peakHour: `${peakHour.toString().padStart(2, '0')}:00`,
            },
            topGenres,
            topItems,
            typeDistribution: Array.from(typeStats.entries()).map(([type, stats]) => ({
                type,
                ...stats,
            })),
            hourlyData,
            dailyTrend,
            recentHistory,
            devices: deviceStats.map(d => ({
                deviceName: d.deviceName,
                client: d.client,
                ipAddress: null, // Removed from grouping
                lastSeen: d._max?.startedAt || new Date(),
                count: d._count?.id || 0
            })),
        })
    } catch (error) {
        console.error('[API] Failed to get user stats:', error)
        return NextResponse.json({ error: 'Failed to get user stats' }, { status: 500 })
    }
}
