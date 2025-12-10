import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/users/global - Get all global users with their linked server users
export async function GET() {
    try {
        const globalUsers = await prisma.globalUser.findMany({
            orderBy: { name: 'asc' },
            include: {
                serverUsers: {
                    include: {
                        server: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        _count: {
                            select: {
                                playHistory: true,
                            },
                        },
                    },
                },
            },
        })

        // Calculate aggregated stats for each global user
        const usersWithStats = await Promise.all(
            globalUsers.map(async (user) => {
                const serverUserIds = user.serverUsers.map((su) => su.id)

                const stats = await prisma.playHistory.aggregate({
                    where: {
                        serverUserId: { in: serverUserIds },
                    },
                    _sum: {
                        playDuration: true,
                    },
                    _count: true,
                })

                return {
                    ...user,
                    totalPlayDuration: stats._sum.playDuration || 0,
                    totalPlayCount: stats._count,
                }
            })
        )

        return NextResponse.json(usersWithStats)
    } catch (error) {
        console.error('[API] Failed to get global users:', error)
        return NextResponse.json(
            { error: 'Failed to fetch global users' },
            { status: 500 }
        )
    }
}
