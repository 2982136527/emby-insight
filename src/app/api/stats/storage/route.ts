import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmbyClient } from '@/lib/emby'

interface ServerStorage {
    serverId: string
    serverName: string
    version: string
    operatingSystem: string
    libraries: Array<{
        name: string
        type: string
        locations: string[]
        mediaCount: number     // Total items in library (from Emby)
        playedCount: number    // Items we've played
        totalDuration: number
    }>
    totalItems: number
    totalDuration: number
}

// GET /api/stats/storage - Get storage analysis from all servers
export async function GET() {
    try {
        const servers = await prisma.server.findMany({
            where: { isActive: true },
        })

        const results: ServerStorage[] = []

        for (const server of servers) {
            try {
                const client = createEmbyClient({
                    baseUrl: server.url,
                    port: server.port,
                    apiKey: server.apiKey,
                })

                // Get system info
                const systemInfo = await client.getSystemInfo()

                // Get libraries
                const libraries = await client.getLibraries()

                // Get item counts and durations from our database per library type
                const stats = await prisma.playHistory.groupBy({
                    by: ['itemType'],
                    where: { serverId: server.id },
                    _sum: { duration: true },
                    _count: true,
                })

                const statsMap = new Map<string, { count: number; duration: number }>(
                    stats.map((s: { itemType: string; _count: number; _sum: { duration: bigint | null } }) => [
                        s.itemType,
                        {
                            count: s._count,
                            duration: Number(s._sum.duration || 0),
                        },
                    ])
                )

                // Filter out collections/boxsets and map library types
                const filteredLibraries = libraries.filter(lib =>
                    lib.CollectionType !== 'boxsets' &&
                    lib.CollectionType !== 'playlists' &&
                    !lib.Name.includes('合集')
                )

                const libraryData = await Promise.all(filteredLibraries.map(async (lib) => {
                    let itemType = 'Movie'
                    if (lib.CollectionType === 'tvshows') itemType = 'Episode'
                    else if (lib.CollectionType === 'music') itemType = 'Audio'

                    const libStats = statsMap.get(itemType) || { count: 0, duration: 0 }

                    // Get actual item count from Emby
                    const actualItemCount = await client.getLibraryItemCount(lib.ItemId)

                    return {
                        name: lib.Name,
                        type: lib.CollectionType || 'unknown',
                        locations: lib.Locations || [],
                        mediaCount: actualItemCount,  // Total items in library (from Emby)
                        playedCount: libStats.count,   // Items we've played (from our DB)
                        totalDuration: libStats.duration,
                    }
                }))

                const totalStats = await prisma.playHistory.aggregate({
                    where: { serverId: server.id },
                    _sum: { duration: true },
                    _count: true,
                })

                results.push({
                    serverId: server.id,
                    serverName: server.name,
                    version: systemInfo.Version || 'Unknown',
                    operatingSystem: systemInfo.OperatingSystem || 'Unknown',
                    libraries: libraryData,
                    totalItems: totalStats._count,
                    totalDuration: Number(totalStats._sum.duration || 0),
                })
            } catch (error) {
                console.error(`[Storage] Failed to get info from ${server.name}:`, error)
                // Add partial info for failed servers
                results.push({
                    serverId: server.id,
                    serverName: server.name,
                    version: 'Error',
                    operatingSystem: 'Connection Failed',
                    libraries: [],
                    totalItems: 0,
                    totalDuration: 0,
                })
            }
        }

        return NextResponse.json({
            servers: results,
            totalServers: servers.length,
        })
    } catch (error) {
        console.error('[API] Failed to get storage stats:', error)
        return NextResponse.json({ error: 'Failed to get storage' }, { status: 500 })
    }
}
