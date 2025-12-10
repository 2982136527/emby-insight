import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/users - Get all server users with global user mappings
export async function GET() {
    try {
        const users = await prisma.serverUser.findMany({
            orderBy: { username: 'asc' },
            include: {
                server: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                globalUser: true,
                _count: {
                    select: {
                        playHistory: true,
                    },
                },
            },
        })

        return NextResponse.json(users)
    } catch (error) {
        console.error('[API] Failed to get users:', error)
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        )
    }
}

// POST /api/users/mapping - Create or update user mapping to global user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { serverUserIds, globalUserName, globalUserId } = body

        if (!serverUserIds?.length) {
            return NextResponse.json(
                { error: 'At least one serverUserId is required' },
                { status: 400 }
            )
        }

        let targetGlobalUserId = globalUserId

        // Create new global user if no ID provided
        if (!targetGlobalUserId) {
            if (!globalUserName) {
                return NextResponse.json(
                    { error: 'Either globalUserId or globalUserName is required' },
                    { status: 400 }
                )
            }

            const newGlobalUser = await prisma.globalUser.create({
                data: {
                    name: globalUserName,
                },
            })
            targetGlobalUserId = newGlobalUser.id
        }

        // Update all server users to point to the global user
        await prisma.serverUser.updateMany({
            where: {
                id: { in: serverUserIds },
            },
            data: {
                globalUserId: targetGlobalUserId,
            },
        })

        // Return updated global user with all linked users
        const globalUser = await prisma.globalUser.findUnique({
            where: { id: targetGlobalUserId },
            include: {
                serverUsers: {
                    include: {
                        server: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        })

        return NextResponse.json(globalUser)
    } catch (error) {
        console.error('[API] Failed to update user mapping:', error)
        return NextResponse.json(
            { error: 'Failed to update user mapping' },
            { status: 500 }
        )
    }
}
