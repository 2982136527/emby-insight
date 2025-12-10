import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/stats/devices - Get device and client analytics
export async function GET(request: NextRequest) {
    try {
        // Get all session logs for analysis
        const sessions = await prisma.sessionLog.findMany({
            select: {
                client: true,
                deviceName: true,
                isTranscoding: true,
                videoCodec: true,
                audioCodec: true,
                bitrate: true,
                realDuration: true,
                positionTicks: true,
            },
        })

        // Client distribution
        const clientStats = new Map<string, { count: number; duration: number; transcodeCount: number }>()
        for (const session of sessions) {
            const existing = clientStats.get(session.client) || { count: 0, duration: 0, transcodeCount: 0 }
            existing.count++
            existing.duration += Number(session.realDuration)
            if (session.isTranscoding) existing.transcodeCount++
            clientStats.set(session.client, existing)
        }

        // Device distribution
        const deviceStats = new Map<string, { count: number; duration: number }>()
        for (const session of sessions) {
            const existing = deviceStats.get(session.deviceName) || { count: 0, duration: 0 }
            existing.count++
            existing.duration += Number(session.realDuration)
            deviceStats.set(session.deviceName, existing)
        }

        // Transcoding vs Direct Play
        const transcodingCount = sessions.filter(s => s.isTranscoding).length
        const directPlayCount = sessions.filter(s => !s.isTranscoding).length

        // Video codec distribution
        const codecStats = new Map<string, number>()
        for (const session of sessions) {
            if (session.videoCodec) {
                codecStats.set(session.videoCodec, (codecStats.get(session.videoCodec) || 0) + 1)
            }
        }

        // Bitrate distribution
        const bitrateRanges = {
            'below_2mbps': 0,
            '2_5mbps': 0,
            '5_10mbps': 0,
            '10_20mbps': 0,
            'above_20mbps': 0,
        }
        for (const session of sessions) {
            if (session.bitrate) {
                const mbps = session.bitrate / 1000
                if (mbps < 2) bitrateRanges['below_2mbps']++
                else if (mbps < 5) bitrateRanges['2_5mbps']++
                else if (mbps < 10) bitrateRanges['5_10mbps']++
                else if (mbps < 20) bitrateRanges['10_20mbps']++
                else bitrateRanges['above_20mbps']++
            }
        }

        return NextResponse.json({
            summary: {
                totalSessions: sessions.length,
                uniqueClients: clientStats.size,
                uniqueDevices: deviceStats.size,
                transcodingRate: sessions.length > 0
                    ? Math.round((transcodingCount / sessions.length) * 100)
                    : 0,
            },
            playbackMethod: {
                transcode: transcodingCount,
                directPlay: directPlayCount,
            },
            clients: Array.from(clientStats.entries())
                .map(([client, stats]) => ({
                    client,
                    ...stats,
                    transcodeRate: stats.count > 0
                        ? Math.round((stats.transcodeCount / stats.count) * 100)
                        : 0,
                }))
                .sort((a, b) => b.count - a.count),
            devices: Array.from(deviceStats.entries())
                .map(([device, stats]) => ({ device, ...stats }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20),
            codecs: Array.from(codecStats.entries())
                .map(([codec, count]) => ({ codec, count }))
                .sort((a, b) => b.count - a.count),
            bitrateDistribution: Object.entries(bitrateRanges)
                .map(([range, count]) => ({
                    range: range
                        .replace('below_', '<')
                        .replace('above_', '>')
                        .replace('_', '-')
                        .replace('mbps', ' Mbps'),
                    count,
                }))
                .filter(r => r.count > 0),
        })
    } catch (error) {
        console.error('[API] Failed to get device stats:', error)
        return NextResponse.json({ error: 'Failed to get device stats' }, { status: 500 })
    }
}
