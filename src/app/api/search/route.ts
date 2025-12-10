import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/search - Global search for users and media
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q')?.toLowerCase() || ''

        if (!query || query.length < 2) {
            return NextResponse.json({ users: [], media: [] })
        }

        // Search users
        const users = await prisma.serverUser.findMany({
            where: {
                OR: [
                    { username: { contains: query } },
                    { globalUser: { name: { contains: query } } },
                ],
            },
            include: {
                server: { select: { name: true } },
                globalUser: { select: { name: true } },
            },
            take: 5,
        })

        // Search media (from play history)
        const mediaResults = await prisma.playHistory.findMany({
            where: {
                OR: [
                    { itemName: { contains: query } },
                    { seriesName: { contains: query } },
                ],
            },
            distinct: ['itemId'],
            select: {
                itemId: true,
                itemName: true,
                itemType: true,
                seriesName: true,
                serverId: true,
            },
            take: 5,
        })

        return NextResponse.json({
            users: users.map(u => ({
                id: u.id,
                name: u.globalUser?.name || u.username,
                serverName: u.server.name,
            })),
            media: mediaResults.map(m => ({
                itemId: m.itemId,
                itemName: m.itemName,
                itemType: m.itemType,
                seriesName: m.seriesName,
                serverId: m.serverId,
            })),
        })
    } catch (error) {
        console.error('[API] Search failed:', error)
        return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
}
