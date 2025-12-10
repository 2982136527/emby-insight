import { NextRequest, NextResponse } from 'next/server'
// Force rebuild
import { prisma } from '@/lib/prisma'
import { createEmbyClient } from '@/lib/emby'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const servers = await prisma.server.findMany({
            where: { isActive: true },
        })

        const sessionsPromises = servers.map(async (server) => {
            try {
                // Fetch active sessions with a Playing state
                const response = await fetch(`${server.url}:${server.port}/emby/Sessions`, {
                    headers: {
                        'X-Emby-Token': server.apiKey,
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 0 }
                })

                if (!response.ok) return []

                const sessions = await response.json()

                // Filter only valid playing sessions and add more details
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mappedSessions = sessions.filter((s: any) => s.NowPlayingItem).map((s: any) => {
                    // Get transcoding info
                    const transcodingInfo = s.TranscodingInfo
                    const playMethod = s.PlayState?.PlayMethod // DirectPlay, DirectStream, Transcode

                    return {
                        id: s.Id,
                        serverId: server.id,
                        serverName: server.name,
                        username: s.UserName,
                        userId: s.UserId,
                        client: s.Client,
                        clientVersion: s.ApplicationVersion,
                        deviceName: s.DeviceName,
                        deviceId: s.DeviceId,
                        ipAddress: s.RemoteEndPoint,
                        item: {
                            id: s.NowPlayingItem.Id,
                            name: s.NowPlayingItem.Name,
                            type: s.NowPlayingItem.Type,
                            seriesName: s.NowPlayingItem.SeriesName,
                            seasonName: s.NowPlayingItem.SeasonName,
                            episodeIndex: s.NowPlayingItem.IndexNumber,
                            seasonIndex: s.NowPlayingItem.ParentIndexNumber,
                            runTimeTicks: s.NowPlayingItem.RunTimeTicks,
                            width: s.NowPlayingItem.Width,
                            height: s.NowPlayingItem.Height,
                            backdropId: s.NowPlayingItem.BackdropImageTags?.[0] ? s.NowPlayingItem.Id : null,
                            primaryImageId: s.NowPlayingItem.ImageTags?.Primary ? s.NowPlayingItem.Id : null,
                        },
                        playState: {
                            positionTicks: s.PlayState?.PositionTicks || 0,
                            isPaused: s.PlayState?.IsPaused || false,
                            playMethod: playMethod,
                        },
                        // Transcoding info
                        transcoding: transcodingInfo ? {
                            isTranscoding: true,
                            videoCodec: transcodingInfo.VideoCodec,
                            audioCodec: transcodingInfo.AudioCodec,
                            bitrate: transcodingInfo.Bitrate ? Math.round(transcodingInfo.Bitrate / 1000) : null, // Kbps
                            width: transcodingInfo.Width,
                            height: transcodingInfo.Height,
                            reasons: transcodingInfo.TranscodeReasons,
                            completionPercentage: transcodingInfo.CompletionPercentage,
                        } : {
                            isTranscoding: false,
                            videoCodec: null,
                            audioCodec: null,
                            bitrate: null,
                            width: null,
                            height: null,
                            reasons: null,
                            completionPercentage: null,
                        },
                        // Timing
                        lastActivityDate: s.LastActivityDate,
                        lastPlaybackCheckIn: s.LastPlaybackCheckIn,
                    }
                })

                // Log active sessions to database
                for (const session of mappedSessions) {
                    try {
                        // Check if this session already exists
                        const existingLog = await prisma.sessionLog.findFirst({
                            where: {
                                sessionId: session.id,
                                isActive: true,
                            },
                        })

                        if (existingLog) {
                            // Update existing session
                            await prisma.sessionLog.update({
                                where: { id: existingLog.id },
                                data: {
                                    duration: BigInt(session.playState.positionTicks || 0),
                                    positionTicks: BigInt(session.playState.positionTicks || 0),
                                    isPaused: session.playState.isPaused,
                                    isTranscoding: session.transcoding.isTranscoding,
                                    videoCodec: session.transcoding.videoCodec,
                                    audioCodec: session.transcoding.audioCodec,
                                    bitrate: session.transcoding.bitrate,
                                    transcodeReasons: session.transcoding.reasons ? JSON.stringify(session.transcoding.reasons) : null,
                                },
                            })
                        } else {
                            // Find serverUserId from ServerUser table
                            const serverUser = await prisma.serverUser.findFirst({
                                where: {
                                    serverId: session.serverId,
                                    embyUserId: session.userId,
                                },
                                select: { id: true },
                            })

                            // Create new session log
                            await prisma.sessionLog.create({
                                data: {
                                    sessionId: session.id,
                                    serverId: session.serverId,
                                    serverUserId: serverUser?.id || null,
                                    username: session.username,
                                    userId: session.userId,
                                    client: session.client,
                                    deviceName: session.deviceName,
                                    deviceId: session.deviceId,
                                    ipAddress: session.ipAddress,
                                    itemId: session.item.id,
                                    itemName: session.item.name,
                                    itemType: session.item.type,
                                    seriesName: session.item.seriesName,
                                    startedAt: new Date(),
                                    positionTicks: BigInt(session.playState.positionTicks || 0),
                                    isPaused: session.playState.isPaused,
                                    isActive: true,
                                    isTranscoding: session.transcoding.isTranscoding,
                                    videoCodec: session.transcoding.videoCodec,
                                    audioCodec: session.transcoding.audioCodec,
                                    bitrate: session.transcoding.bitrate,
                                    transcodeReasons: session.transcoding.reasons ? JSON.stringify(session.transcoding.reasons) : null,
                                },
                            })
                            // Send notification
                            sendNotification('start', session, server)
                        }
                    } catch (logError) {
                        console.error('[Session] Failed to log session:', logError)
                    }
                }
                // Mark ended sessions as inactive and trigger sync if sessions ended
                const activeSessionIds = mappedSessions.map((s: { id: string }) => s.id)

                // Find sessions that just ended
                const endedSessions = await prisma.sessionLog.findMany({
                    where: {
                        serverId: server.id,
                        isActive: true,
                        sessionId: { notIn: activeSessionIds },
                    },
                })

                if (endedSessions.length > 0) {
                    console.log(`[Session] ${endedSessions.length} session(s) ended on ${server.name}, triggering sync...`)

                    // Calculate real duration for each session and mark as inactive
                    const now = new Date()
                    for (const session of endedSessions) {
                        const realDuration = now.getTime() - session.startedAt.getTime() // milliseconds
                        await prisma.sessionLog.update({
                            where: { id: session.id },
                            data: {
                                isActive: false,
                                endedAt: now,
                                realDuration: BigInt(realDuration),
                            },
                        })
                        // Send notification
                        sendNotification('stop', session, server)
                        console.log(`[Session] Session ended: ${session.itemName}, real duration: ${Math.round(realDuration / 1000 / 60)}min`)
                    }

                    // Trigger sync in the background (don't await)
                    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
                    fetch(`${baseUrl}/api/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ serverIds: [server.id] }),
                    }).then(res => {
                        if (res.ok) {
                            console.log(`[Session] Auto-sync completed for ${server.name}`)
                        } else {
                            console.error(`[Session] Auto-sync failed for ${server.name}`)
                        }
                    }).catch(err => {
                        console.error(`[Session] Auto-sync error for ${server.name}:`, err)
                    })
                }

                return mappedSessions
            } catch (err) {
                console.error(`Failed to fetch sessions from server ${server.name}:`, err)
                return []
            }
        })

        const results = await Promise.all(sessionsPromises)
        const allSessions = results.flat()

        // Enrich sessions with startedAt from database for real-time duration calculation
        const enrichedSessions = await Promise.all(
            allSessions.map(async (session) => {
                const dbSession = await prisma.sessionLog.findFirst({
                    where: {
                        sessionId: session.id,
                        isActive: true,
                    },
                    select: { startedAt: true },
                })
                return {
                    ...session,
                    startedAt: dbSession?.startedAt?.toISOString() || new Date().toISOString(),
                }
            })
        )

        return NextResponse.json(enrichedSessions)
    } catch (error) {
        console.error('[API] Failed to get live sessions:', error)
        return NextResponse.json(
            { error: 'Failed to fetch live sessions' },
            { status: 500 }
        )
    }
}

// POST /api/session/live - Send a message to a session
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { serverId, sessionId, message, title } = body

        if (!serverId || !sessionId || !message) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId },
        })

        if (!server) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 })
        }

        const client = createEmbyClient({
            baseUrl: server.url,
            port: server.port,
            apiKey: server.apiKey,
        })

        await client.sendMessage(sessionId, message, title || '消息')

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Failed to send message:', error)
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
}

// DELETE /api/session/live - Stop/kick a session
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const serverId = searchParams.get('serverId')
        const sessionId = searchParams.get('sessionId')

        if (!serverId || !sessionId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId },
        })

        if (!server) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 })
        }

        const client = createEmbyClient({
            baseUrl: server.url,
            port: server.port,
            apiKey: server.apiKey,
        })

        await client.stopSession(sessionId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Failed to stop session:', error)
        return NextResponse.json({ error: 'Failed to stop session' }, { status: 500 })
    }
}

async function sendNotification(event: 'start' | 'stop', session: any, server: any) {
    try {
        const config = await prisma.notificationConfig.findFirst()
        if (!config?.enabled || !config.webhookUrl) return
        if (event === 'start' && !config.onPlaybackStart) return
        if (event === 'stop' && !config.onPlaybackStop) return

        const isStart = event === 'start'
        const title = isStart ? '▶️ 开始播放' : '⏹️ 停止播放'
        const color = isStart ? 0x22c55e : 0xef4444 // Tailwind Green-500 / Red-500

        // Normalize Data
        // session can be from API (mappedSessions) or DB (endedSessions)
        const user = session.username || '未知用户'
        const device = `${session.deviceName || '未知设备'} (${session.client || 'Client'})`

        let mediaTitle = session.itemName || session.item?.name || '未知影片'
        if (session.seriesName || session.item?.seriesName) {
            const s = session.seasonIndex ?? session.item?.seasonIndex
            const e = session.episodeIndex ?? session.item?.episodeIndex
            const series = session.seriesName || session.item?.seriesName
            if (s !== undefined && e !== undefined) {
                mediaTitle = `${series} S${s}E${e} - ${mediaTitle}`
            } else {
                mediaTitle = `${series} - ${mediaTitle}`
            }
        }

        const isTranscoding = session.isTranscoding ?? session.transcoding?.isTranscoding ?? false
        const quality = isTranscoding
            ? `🔄 转码 (${session.videoCodec || session.transcoding?.videoCodec || 'Unknown'})`
            : '⚡ 直接播放'

        const timestamp = new Date().toLocaleString('zh-CN', { hour12: false })
        const serverName = server.name

        // Image URL: Try to construct public URL if possible, otherwise use internal
        // Ideally user sets a PUBLIC_URL env var, but we might rely on server.url if accessible
        const itemId = session.itemId || session.item?.id
        const imgUrl = itemId ? `${server.url}/emby/Items/${itemId}/Images/Primary` : ''

        let body = {}

        if (config.webhookType === 'discord') {
            body = {
                embeds: [{
                    title: `${title}: ${mediaTitle}`,
                    color,
                    fields: [
                        { name: '用户', value: user, inline: true },
                        { name: '设备', value: device, inline: true },
                        { name: '画质', value: quality, inline: true },
                        { name: '服务器', value: serverName, inline: true },
                        { name: '时间', value: timestamp, inline: true },
                    ],
                    thumbnail: { url: imgUrl },
                    timestamp: new Date().toISOString(),
                    footer: { text: 'EmbyInsight', icon_url: 'https://emby.media/resources/icon-144.png' }
                }]
            }
        } else if (config.webhookType === 'telegram') {
            const html = `<b>${title}</b>\n\n` +
                `🎬 <b>${mediaTitle}</b>\n` +
                `👤 <b>用户:</b> ${user}\n` +
                `📱 <b>设备:</b> ${device}\n` +
                `📺 <b>画质:</b> ${quality}\n` +
                `🖥️ <b>服务器:</b> ${serverName}\n` +
                `🕒 <b>时间:</b> ${timestamp}`

            body = {
                text: html,
                parse_mode: 'HTML'
            }
        } else if (config.webhookType === 'wechat') {
            // WeCom Markdown
            const colorName = isStart ? 'info' : 'comment' // info=green, comment=grey/orangeish
            const md = `### <font color="${colorName}">${title}</font>\n` +
                `**${mediaTitle}**\n` +
                `>👤 用户: <font color="comment">${user}</font>\n` +
                `>📱 设备: ${device}\n` +
                `>📺 画质: <font color="warning">${quality}</font>\n` +
                `>🖥️ 服务器: ${serverName}\n` +
                `>🕒 时间: ${timestamp}`

            body = {
                msgtype: 'markdown',
                markdown: {
                    content: md
                }
            }
        } else {
            // Generic JSON
            body = {
                event: isStart ? 'playback.start' : 'playback.stop',
                user,
                device,
                title: mediaTitle,
                quality,
                server: serverName,
                timestamp,
                raw: session
            }
        }

        await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
    } catch (error) {
        console.error('Failed to send notification:', error)
    }
}
