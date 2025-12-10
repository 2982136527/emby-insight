import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/sessions - Get paginated session logs
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const username = searchParams.get('username')
        const serverId = searchParams.get('serverId')
        const client = searchParams.get('client')
        const userId = searchParams.get('userId')

        const where: Record<string, unknown> = {}
        if (username) where.username = { contains: username }
        if (serverId) where.serverId = serverId
        if (client) where.client = { contains: client }

        // Handle userId which can be in format "global:id" or "server:id"
        if (userId) {
            if (userId.startsWith('global:')) {
                // Global user - find all related serverUserIds
                const globalUserId = userId.replace('global:', '')
                const serverUsers = await prisma.serverUser.findMany({
                    where: { globalUserId },
                    select: { id: true },
                })
                const serverUserIds = serverUsers.map(u => u.id)
                if (serverUserIds.length > 0) {
                    where.serverUserId = { in: serverUserIds }
                } else {
                    // No matching server users, return empty results
                    return NextResponse.json({
                        sessions: [],
                        pagination: { page, limit, total: 0, totalPages: 0 },
                        stats: { totalSessions: 0, totalRealDuration: 0, totalPositionTicks: 0, transcodingCount: 0, directPlayCount: 0, transcodingRate: 0 },
                        clientDistribution: [],
                    })
                }
            } else if (userId.startsWith('server:')) {
                // Single server user
                const serverUserId = userId.replace('server:', '')
                where.serverUserId = serverUserId
            } else {
                // Legacy format - assume it's a globalUserId for backwards compatibility
                const serverUsers = await prisma.serverUser.findMany({
                    where: { globalUserId: userId },
                    select: { id: true },
                })
                const serverUserIds = serverUsers.map(u => u.id)
                if (serverUserIds.length > 0) {
                    where.serverUserId = { in: serverUserIds }
                }
            }
        }

        const [sessions, total] = await Promise.all([
            prisma.sessionLog.findMany({
                where,
                orderBy: { startedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.sessionLog.count({ where }),
        ])

        // Calculate stats
        const stats = await prisma.sessionLog.aggregate({
            _sum: {
                realDuration: true,
                positionTicks: true,
            },
            _count: true,
        })

        // Get device/client distribution
        const clientStats = await prisma.sessionLog.groupBy({
            by: ['client'],
            _count: true,
        })

        // Get transcoding stats
        const transcodeStats = await prisma.sessionLog.groupBy({
            by: ['isTranscoding'],
            _count: true,
        })

        const totalSessions = stats._count
        const transcodingCount = transcodeStats.find(s => s.isTranscoding)?._count || 0
        const directPlayCount = transcodeStats.find(s => !s.isTranscoding)?._count || 0

        return NextResponse.json({
            sessions: sessions.map(s => ({
                id: s.id,
                sessionId: s.sessionId,
                serverId: s.serverId,
                serverUserId: s.serverUserId,
                username: s.username,
                client: s.client,
                deviceName: s.deviceName,
                itemId: s.itemId,
                itemName: s.itemName,
                itemType: s.itemType,
                seriesName: s.seriesName,
                startedAt: s.startedAt,
                endedAt: s.endedAt,
                duration: Number(s.duration),
                positionTicks: Number(s.positionTicks),
                realDuration: Number(s.realDuration),
                isPaused: s.isPaused,
                isActive: s.isActive,
                isTranscoding: s.isTranscoding,
                videoCodec: s.videoCodec,
                audioCodec: s.audioCodec,
                bitrate: s.bitrate,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            stats: {
                totalSessions,
                totalRealDuration: Number(stats._sum.realDuration || 0),
                totalPositionTicks: Number(stats._sum.positionTicks || 0),
                transcodingCount,
                directPlayCount,
                transcodingRate: totalSessions > 0
                    ? Math.round((transcodingCount / totalSessions) * 100)
                    : 0,
            },
            clientDistribution: clientStats.map(c => ({
                client: c.client,
                count: c._count,
            })),
        })
    } catch (error) {
        console.error('[API] Failed to get session logs:', error)
        return NextResponse.json({ error: 'Failed to get session logs' }, { status: 500 })
    }
}
