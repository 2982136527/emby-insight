import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/media/[id] - Get media details and viewing stats
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: itemId } = await params
        const { searchParams } = new URL(request.url)
        const serverId = searchParams.get('serverId')

        if (!serverId) {
            return NextResponse.json({ error: 'serverId is required' }, { status: 400 })
        }

        // Get play history for this item
        const playHistory = await prisma.playHistory.findMany({
            where: {
                itemId,
                serverId,
            },
            include: {
                serverUser: {
                    include: {
                        globalUser: true,
                    },
                },
                server: true,
            },
            orderBy: { playedAt: 'desc' },
        })

        if (playHistory.length === 0) {
            return NextResponse.json({ error: 'Media not found' }, { status: 404 })
        }

        const firstRecord = playHistory[0]

        // Try to get more info from Emby
        let embyInfo = null
        try {
            const server = firstRecord.server
            if (server) {
                const itemRes = await fetch(`${server.url}:${server.port}/Items/${itemId}?api_key=${server.apiKey}`)
                if (itemRes.ok) {
                    embyInfo = await itemRes.json()
                }
            }
        } catch {
            // Emby info fetch failed, continue with local data
        }

        // Calculate stats
        const totalDuration = playHistory.reduce((sum, h) => sum + Number(h.playDuration), 0)
        const totalPlays = playHistory.length
        const uniqueUsers = new Set(playHistory.map(h => h.serverUser?.globalUser?.name || h.serverUser?.username)).size
        const completedPlays = playHistory.filter(h => h.isCompleted).length
        const completionRate = totalPlays > 0 ? Math.round((completedPlays / totalPlays) * 100) : 0

        // Group by user
        const userStats = new Map<string, { name: string; duration: number; count: number; lastPlayed: Date }>()
        for (const record of playHistory) {
            const userName = record.serverUser?.globalUser?.name || record.serverUser?.username || 'Unknown'
            const existing = userStats.get(userName) || { name: userName, duration: 0, count: 0, lastPlayed: record.playedAt }
            existing.duration += Number(record.playDuration)
            existing.count += 1
            if (record.playedAt > existing.lastPlayed) {
                existing.lastPlayed = record.playedAt
            }
            userStats.set(userName, existing)
        }

        // Hourly distribution
        const hourlyData = new Array(24).fill(0)
        for (const record of playHistory) {
            const hour = new Date(record.playedAt).getHours()
            hourlyData[hour] += 1
        }

        // Daily distribution (last 30 days)
        const dailyData = new Map<string, number>()
        for (const record of playHistory) {
            const day = record.playedAt.toISOString().split('T')[0]
            dailyData.set(day, (dailyData.get(day) || 0) + 1)
        }

        return NextResponse.json({
            media: {
                itemId,
                serverId,
                itemName: firstRecord.itemName,
                itemType: firstRecord.itemType,
                seriesName: firstRecord.seriesName,
                seasonName: firstRecord.seasonName,
                episodeNumber: firstRecord.episodeNumber,
                genres: JSON.parse(firstRecord.genres || '[]'),
                year: firstRecord.year,
                duration: Number(firstRecord.duration),
                videoCodec: firstRecord.videoCodec,
                resolution: firstRecord.resolution,
                isHdr: firstRecord.isHdr,
                // Emby additional info
                overview: embyInfo?.Overview,
                communityRating: embyInfo?.CommunityRating,
                officialRating: embyInfo?.OfficialRating,
            },
            summary: {
                totalDuration,
                totalPlays,
                uniqueUsers,
                completedPlays,
                completionRate,
                firstWatched: playHistory[playHistory.length - 1]?.playedAt,
                lastWatched: playHistory[0]?.playedAt,
            },
            watchers: Array.from(userStats.values())
                .sort((a, b) => b.duration - a.duration)
                .map(u => ({
                    ...u,
                    lastPlayed: u.lastPlayed.toISOString(),
                })),
            hourlyData,
            recentPlays: playHistory.slice(0, 10).map(h => ({
                id: h.id,
                username: h.serverUser?.globalUser?.name || h.serverUser?.username,
                duration: Number(h.playDuration),
                playedAt: h.playedAt,
                isCompleted: h.isCompleted,
            })),
        })
    } catch (error) {
        console.error('[API] Failed to get media stats:', error)
        return NextResponse.json({ error: 'Failed to get media stats' }, { status: 500 })
    }
}
