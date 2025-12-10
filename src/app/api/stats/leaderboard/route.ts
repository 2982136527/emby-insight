import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/stats/leaderboard - Get leaderboard statistics
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') || 'users'
        const serverId = searchParams.get('serverId')

        if (type === 'users') {
            // User leaderboard - by total watch time
            // 1. Get all server users with their global user info (filtered by server if needed)
            const serverUsersFn = async () => {
                const whereClause = serverId ? { serverId } : {}
                return prisma.serverUser.findMany({
                    where: whereClause,
                    include: {
                        server: { select: { name: true } },
                        globalUser: { select: { id: true, name: true, avatar: true } },
                    },
                })
            }
            const serverUsers = await serverUsersFn()

            // 2. Group users (by individual serverUserId)
            const userGroups = new Map<string, {
                name: string;
                isGlobal: boolean;
                avatar: string | null;
                serverUserIds: string[];
                serverNames: Set<string>;
            }>()

            for (const user of serverUsers) {
                const name = user.username
                const isGlobal = !!user.globalUser;
                const avatar = null; // Don't use global avatar
                const key = `server:${user.id}`; // Always use server ID as key to separate users

                if (!userGroups.has(key)) {
                    userGroups.set(key, {
                        name,
                        isGlobal: false, // Treat as normal user
                        avatar,
                        serverUserIds: [],
                        serverNames: new Set(),
                    })
                }

                const group = userGroups.get(key)!;
                group.serverUserIds.push(user.id);
                group.serverNames.add(user.server.name);
            }

            // 3. specific detailed stats for each group
            // We fetch individual records to calculate "real" watch time
            const leaderboardData = await Promise.all(
                Array.from(userGroups.entries()).map(async ([key, group]) => {
                    const history = await prisma.playHistory.findMany({
                        where: {
                            serverUserId: { in: group.serverUserIds }
                        },
                        select: {
                            playCount: true,
                            duration: true,
                            playDuration: true,
                            playbackPosition: true,
                        }
                    })

                    // Calculate total duration: (PlayCount * ItemDuration) + PlaybackPosition
                    // This accounts for re-watches which are not fully captured by playDuration field in sync
                    let totalRealDuration = 0
                    let totalPlays = 0

                    for (const record of history) {
                        const playCount = Number(record.playCount || 0)
                        const itemDuration = Number(record.duration || 0)
                        const currentPosition = Number(record.playbackPosition || 0)

                        // If fully played at least once
                        if (playCount > 0) {
                            totalRealDuration += (playCount * itemDuration)
                        }

                        // Add current progress
                        totalRealDuration += currentPosition

                        // If no play count but has progress, it's at least 1 play (in progress)
                        // If play count > 0, it's playCount plays
                        totalPlays += (playCount > 0 ? playCount : (currentPosition > 0 ? 1 : 0))
                    }

                    return {
                        id: key,
                        name: group.name,
                        isGlobal: false,
                        avatar: null,
                        serverName: Array.from(group.serverNames).join(', '),
                        totalDuration: totalRealDuration,
                        totalPlays,
                    }
                })
            )

            return NextResponse.json({
                type: 'users',
                data: leaderboardData
                    .filter(u => u.totalPlays > 0) // Only show active users
                    .sort((a, b) => b.totalDuration - a.totalDuration)
                    .slice(0, 20),
            })
        }

        if (type === 'media') {
            // Media leaderboard - most played items
            const whereClause = serverId ? { serverId } : {}

            const mediaStats = await prisma.playHistory.groupBy({
                by: ['itemId', 'itemName', 'itemType', 'seriesName'],
                where: whereClause,
                _sum: { playDuration: true }, // For media, pure play duration sum is still best approx
                _count: true,
                orderBy: { _sum: { playDuration: 'desc' } },
                take: 50,
            })

            const mediaWithImages = await Promise.all(
                mediaStats.map(async (item) => {
                    const history = await prisma.playHistory.findFirst({
                        where: { itemId: item.itemId, ...whereClause },
                        select: { serverId: true },
                    })

                    // Fetch distinct users who watched this item (filtered by server if needed)
                    const watchersWhere = { itemId: item.itemId, ...(serverId ? { serverId } : {}) }
                    const watchers = await prisma.playHistory.findMany({
                        where: watchersWhere,
                        select: {
                            serverUser: {
                                select: {
                                    username: true,
                                    globalUser: {
                                        select: { name: true }
                                    }
                                }
                            }
                        },
                        distinct: ['serverUserId']
                    })

                    const watchedBy = Array.from(new Set(
                        watchers.map(w => w.serverUser.globalUser?.name || w.serverUser.username)
                    ))

                    return {
                        itemId: item.itemId,
                        itemName: item.itemName,
                        imageUrl: history?.serverId
                            ? `/api/image?serverId=${history.serverId}&itemId=${item.itemId}`
                            : null,
                        itemType: item.itemType,
                        seriesName: item.seriesName,
                        totalDuration: item._sum.playDuration || 0,
                        totalPlays: item._count,
                        watchedBy,
                        serverId: history?.serverId,
                    }
                })
            )

            return NextResponse.json({
                type: 'media',
                data: mediaWithImages,
            })
        }

        if (type === 'servers') {
            // Server leaderboard
            const whereClause = serverId ? { serverId } : {}

            // Get all history for servers to calculate real duration
            const history = await prisma.playHistory.findMany({
                where: whereClause,
                select: {
                    serverId: true,
                    playCount: true,
                    duration: true,
                    playbackPosition: true,
                }
            })

            const serverStatsMap = new Map<string, { duration: number, plays: number }>()

            for (const record of history) {
                if (!serverStatsMap.has(record.serverId)) {
                    serverStatsMap.set(record.serverId, { duration: 0, plays: 0 })
                }

                const stats = serverStatsMap.get(record.serverId)!
                const playCount = Number(record.playCount || 0)
                const itemDuration = Number(record.duration || 0)
                const currentPosition = Number(record.playbackPosition || 0)

                // Calculate real duration
                if (playCount > 0) {
                    stats.duration += (playCount * itemDuration)
                }
                stats.duration += currentPosition

                // Calculate plays
                stats.plays += (playCount > 0 ? playCount : (currentPosition > 0 ? 1 : 0))
            }

            const servers = await prisma.server.findMany({
                select: { id: true, name: true },
            })

            const serverStats = Array.from(serverStatsMap.entries()).map(([serverId, stats]) => ({
                serverId,
                serverName: servers.find((s) => s.id === serverId)?.name || 'Unknown',
                totalDuration: stats.duration,
                totalPlays: stats.plays,
            })).sort((a, b) => b.totalDuration - a.totalDuration)

            return NextResponse.json({
                type: 'servers',
                data: serverStats,
            })
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    } catch (error) {
        console.error('[API] Failed to get leaderboard:', error)
        return NextResponse.json(
            { error: 'Failed to fetch leaderboard' },
            { status: 500 }
        )
    }
}
