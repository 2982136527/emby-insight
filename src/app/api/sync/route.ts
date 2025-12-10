import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmbyClient } from '@/lib/emby'
import { getResolutionFromStream } from '@/types/emby'

interface SyncResult {
    serverId: string
    serverName: string
    usersSync: { added: number; updated: number }
    historySync: { added: number; skipped: number }
    error?: string
}

// POST /api/sync - Trigger sync for all or specific servers
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { serverIds } = body

        // Get servers to sync
        const servers = await prisma.server.findMany({
            where: {
                isActive: true,
                ...(serverIds?.length ? { id: { in: serverIds } } : {}),
            },
        })

        if (servers.length === 0) {
            return NextResponse.json(
                { error: 'No active servers found' },
                { status: 404 }
            )
        }

        const results: SyncResult[] = []

        for (const server of servers) {
            const result: SyncResult = {
                serverId: server.id,
                serverName: server.name,
                usersSync: { added: 0, updated: 0 },
                historySync: { added: 0, skipped: 0 },
            }

            try {
                const client = createEmbyClient({
                    baseUrl: server.url,
                    port: server.port,
                    apiKey: server.apiKey,
                })

                // Sync users
                const embyUsers = await client.getUsers()

                for (const embyUser of embyUsers) {
                    const existingUser = await prisma.serverUser.findUnique({
                        where: {
                            serverId_embyUserId: {
                                serverId: server.id,
                                embyUserId: embyUser.Id,
                            },
                        },
                    })

                    if (existingUser) {
                        await prisma.serverUser.update({
                            where: { id: existingUser.id },
                            data: { username: embyUser.Name },
                        })
                        result.usersSync.updated++
                    } else {
                        await prisma.serverUser.create({
                            data: {
                                serverId: server.id,
                                embyUserId: embyUser.Id,
                                username: embyUser.Name,
                            },
                        })
                        result.usersSync.added++
                    }
                }

                // Get server users for history sync
                const serverUsers = await prisma.serverUser.findMany({
                    where: { serverId: server.id },
                })

                // Sync play history for each user
                for (const serverUser of serverUsers) {
                    // Get the latest play date for this user to do incremental sync
                    const latestHistory = await prisma.playHistory.findFirst({
                        where: { serverUserId: serverUser.id },
                        orderBy: { playedAt: 'desc' },
                    })

                    // Helper function to sync items from an iterator
                    const syncItemsFromIterator = async (
                        iterator: AsyncGenerator<any[], void, unknown>,
                        isResumable: boolean = false
                    ) => {
                        let shouldStop = false
                        let itemCount = 0

                        for await (const items of iterator) {
                            if (shouldStop) break

                            console.log(`[Sync] Processing batch of ${items.length} items (isResumable=${isResumable})`)

                            for (const item of items) {
                                itemCount++

                                // For played items, skip if not marked as played
                                // For resumable items, check PlaybackPositionTicks > 0
                                if (!isResumable && !item.UserData?.Played) {
                                    console.log(`[Sync] Skipping ${item.Name}: not played`)
                                    continue
                                }
                                if (isResumable && (!item.UserData?.PlaybackPositionTicks || item.UserData.PlaybackPositionTicks <= 0)) {
                                    console.log(`[Sync] Skipping ${item.Name}: no position ticks`)
                                    continue
                                }

                                // Get video stream info for quality data
                                const videoStream = item.MediaSources?.[0]?.MediaStreams?.find(
                                    (s: any) => s.Type === 'Video'
                                )

                                // Check if this record already exists (by itemId + serverUserId)
                                const existingRecord = await prisma.playHistory.findFirst({
                                    where: {
                                        serverUserId: serverUser.id,
                                        itemId: item.Id,
                                    },
                                    orderBy: { playedAt: 'desc' },
                                })

                                // Try multiple date sources for accuracy
                                // LastPlayedDate is the most accurate, but might be missing
                                // For resumable items without LastPlayedDate, the date is unknown
                                let playedAt: Date
                                if (item.UserData.LastPlayedDate) {
                                    playedAt = new Date(item.UserData.LastPlayedDate)
                                } else if (item.UserData.LastActivityDate) {
                                    // Fallback to LastActivityDate if available
                                    playedAt = new Date(item.UserData.LastActivityDate)
                                } else if (existingRecord) {
                                    // If updating existing record, keep original date
                                    playedAt = existingRecord.playedAt
                                } else {
                                    // Last resort: use current time (not ideal)
                                    playedAt = new Date()
                                    console.log(`[Sync] Warning: No date found for ${item.Name}, using current time`)
                                }

                                console.log(`[Sync] Processing: ${item.Name}, playedAt=${playedAt.toISOString()}, position=${item.UserData.PlaybackPositionTicks}`)

                                // For played items, use incremental sync (stop at old records)
                                // For resumable items, always process all (they might be updated)
                                if (!isResumable && latestHistory && playedAt <= latestHistory.playedAt) {
                                    console.log(`[Sync] Reached old records, stopping incremental sync`)
                                    shouldStop = true
                                    break
                                }

                                try {
                                    if (existingRecord) {
                                        // Update existing record if position changed
                                        // Only update playedAt if Emby provided a reliable date
                                        const shouldUpdateDate = item.UserData.LastPlayedDate || item.UserData.LastActivityDate

                                        await prisma.playHistory.update({
                                            where: { id: existingRecord.id },
                                            data: {
                                                playDuration: BigInt(item.UserData.PlaybackPositionTicks || item.RunTimeTicks || 0),
                                                playCount: item.UserData.PlayCount,
                                                isCompleted: item.UserData.Played,
                                                playbackPosition: BigInt(item.UserData.PlaybackPositionTicks || 0),
                                                // Only update date if we have a reliable source
                                                ...(shouldUpdateDate ? { playedAt } : {}),
                                            },
                                        })
                                        console.log(`[Sync] Updated: ${item.Name}`)
                                        result.historySync.skipped++ // Count as updated/skipped
                                    } else {
                                        // Create new record
                                        await prisma.playHistory.create({
                                            data: {
                                                serverId: server.id,
                                                serverUserId: serverUser.id,
                                                itemId: item.Id,
                                                itemName: item.Name,
                                                itemType: item.Type,
                                                seriesName: item.SeriesName,
                                                seasonName: item.SeasonName,
                                                episodeNumber: item.IndexNumber,
                                                genres: JSON.stringify(item.Genres || []),
                                                year: item.ProductionYear,
                                                duration: BigInt(item.RunTimeTicks || 0),
                                                playedAt,
                                                playDuration: BigInt(item.UserData.PlaybackPositionTicks || item.RunTimeTicks || 0),
                                                playCount: item.UserData.PlayCount,
                                                isCompleted: item.UserData.Played,
                                                playbackPosition: BigInt(item.UserData.PlaybackPositionTicks || 0),
                                                videoCodec: videoStream?.Codec,
                                                resolution: getResolutionFromStream(videoStream),
                                                isHdr: videoStream?.IsHDR || videoStream?.VideoRangeType === 'HDR' || false,
                                            },
                                        })
                                        result.historySync.added++
                                    }
                                } catch {
                                    // Record may already exist, skip it
                                    result.historySync.skipped++
                                }
                            }
                        }
                    }

                    // Sync played items (completed)
                    const playedIterator = client.getPlayedItemsIterator(
                        serverUser.embyUserId,
                        ['Movie', 'Episode'],
                        50
                    )
                    await syncItemsFromIterator(playedIterator, false)

                    // Sync resumable items using dedicated Resume endpoint (more reliable)
                    console.log(`[Sync] Fetching resume items for user ${serverUser.username}...`)
                    const resumeItems = await client.getResumeItems(serverUser.embyUserId, 100)
                    console.log(`[Sync] Got ${resumeItems.length} resume items from dedicated endpoint`)

                    for (const item of resumeItems) {
                        // Skip items without playback position
                        if (!item.UserData?.PlaybackPositionTicks || item.UserData.PlaybackPositionTicks <= 0) {
                            console.log(`[Sync] Skipping resume item ${item.Name}: no position`)
                            continue
                        }

                        const hasReliableDate = !!item.UserData.LastPlayedDate
                        const playedAt = item.UserData.LastPlayedDate
                            ? new Date(item.UserData.LastPlayedDate)
                            : new Date()

                        console.log(`[Sync] Resume item: ${item.Name}, playedAt=${playedAt.toISOString()}, position=${item.UserData.PlaybackPositionTicks}`)

                        // Get video stream info
                        const videoStream = item.MediaSources?.[0]?.MediaStreams?.find(
                            (s: any) => s.Type === 'Video'
                        )

                        // Check if record exists
                        const existingRecord = await prisma.playHistory.findFirst({
                            where: {
                                serverUserId: serverUser.id,
                                itemId: item.Id,
                            },
                            orderBy: { playedAt: 'desc' },
                        })

                        try {
                            if (existingRecord) {
                                // Update existing record - only update playedAt if Emby provided a reliable date
                                await prisma.playHistory.update({
                                    where: { id: existingRecord.id },
                                    data: {
                                        playDuration: BigInt(item.UserData.PlaybackPositionTicks || item.RunTimeTicks || 0),
                                        playCount: item.UserData.PlayCount,
                                        isCompleted: item.UserData.Played,
                                        playbackPosition: BigInt(item.UserData.PlaybackPositionTicks || 0),
                                        // Only update playedAt if we have a reliable date from Emby
                                        ...(hasReliableDate ? { playedAt } : {}),
                                    },
                                })
                                console.log(`[Sync] Updated: ${item.Name}`)
                                result.historySync.skipped++
                            } else {
                                // Create new record
                                await prisma.playHistory.create({
                                    data: {
                                        serverId: server.id,
                                        serverUserId: serverUser.id,
                                        itemId: item.Id,
                                        itemName: item.Name,
                                        itemType: item.Type,
                                        seriesName: item.SeriesName,
                                        seasonName: item.SeasonName,
                                        episodeNumber: item.IndexNumber,
                                        genres: JSON.stringify(item.Genres || []),
                                        year: item.ProductionYear,
                                        duration: BigInt(item.RunTimeTicks || 0),
                                        playedAt,
                                        playDuration: BigInt(item.UserData.PlaybackPositionTicks || item.RunTimeTicks || 0),
                                        playCount: item.UserData.PlayCount,
                                        isCompleted: item.UserData.Played,
                                        playbackPosition: BigInt(item.UserData.PlaybackPositionTicks || 0),
                                        videoCodec: videoStream?.Codec,
                                        resolution: getResolutionFromStream(videoStream),
                                        isHdr: videoStream?.IsHDR || videoStream?.VideoRangeType === 'HDR' || false,
                                    },
                                })
                                console.log(`[Sync] Created: ${item.Name}`)
                                result.historySync.added++
                            }
                        } catch (e) {
                            console.log(`[Sync] Error syncing ${item.Name}:`, e)
                            result.historySync.skipped++
                        }
                    }
                }

                // Log successful sync
                await prisma.syncLog.create({
                    data: {
                        serverId: server.id,
                        syncType: 'full',
                        lastSync: new Date(),
                        status: 'success',
                        message: `Users: +${result.usersSync.added}/~${result.usersSync.updated}, History: +${result.historySync.added}`,
                    },
                })
            } catch (error) {
                result.error = error instanceof Error ? error.message : 'Unknown error'

                // Log failed sync
                await prisma.syncLog.create({
                    data: {
                        serverId: server.id,
                        syncType: 'full',
                        lastSync: new Date(),
                        status: 'failed',
                        message: result.error,
                    },
                })
            }

            results.push(result)
        }

        return NextResponse.json({ results })
    } catch (error) {
        console.error('[API] Sync failed:', error)
        return NextResponse.json(
            { error: 'Sync failed' },
            { status: 500 }
        )
    }
}

// GET /api/sync/status - Get sync status for all servers
export async function GET() {
    try {
        const syncLogs = await prisma.syncLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                server: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        })

        return NextResponse.json(syncLogs)
    } catch (error) {
        console.error('[API] Failed to get sync status:', error)
        return NextResponse.json(
            { error: 'Failed to get sync status' },
            { status: 500 }
        )
    }
}
