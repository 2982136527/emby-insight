import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, differenceInMinutes } from 'date-fns'

interface MarathonSession {
    date: string
    startTime: string
    endTime: string
    duration: number // hours
    episodes: number
    seriesName: string
    userName: string
    userId: string
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const minHours = parseFloat(searchParams.get('minHours') || '3')
    const minEpisodes = parseInt(searchParams.get('minEpisodes') || '3')

    try {
        // Build where clause
        const whereClause: Record<string, unknown> = {
            itemType: 'Episode',
        }
        if (userId) {
            whereClause.serverUserId = userId
        }

        // Get all episode watches ordered by user and time
        const episodes = await prisma.playHistory.findMany({
            where: whereClause,
            select: {
                id: true,
                playedAt: true,
                playDuration: true,
                seriesName: true,
                serverUserId: true,
                serverUser: {
                    select: {
                        username: true,
                        globalUser: { select: { name: true } },
                    },
                },
            },
            orderBy: [
                { serverUserId: 'asc' },
                { seriesName: 'asc' },
                { playedAt: 'asc' },
            ],
        })

        const marathons: MarathonSession[] = []

        // Group by user and series, then find consecutive episode clusters
        let currentMarathon: {
            userId: string
            userName: string
            seriesName: string
            startTime: Date
            endTime: Date
            episodes: Array<{ playedAt: Date; duration: bigint }>
        } | null = null

        for (const ep of episodes) {
            const epDuration = Number(ep.playDuration) / 10000000 / 60 // minutes
            const userName = ep.serverUser.globalUser?.name || ep.serverUser.username

            if (!ep.seriesName) continue

            if (
                currentMarathon &&
                currentMarathon.userId === ep.serverUserId &&
                currentMarathon.seriesName === ep.seriesName
            ) {
                // Check if this episode is within 2 hours of the last one
                const lastEp = currentMarathon.episodes[currentMarathon.episodes.length - 1]
                const gap = differenceInMinutes(ep.playedAt, lastEp.playedAt)

                if (gap <= 120) { // Within 2 hours
                    currentMarathon.episodes.push({ playedAt: ep.playedAt, duration: ep.playDuration })
                    currentMarathon.endTime = new Date(
                        ep.playedAt.getTime() + Number(ep.playDuration) / 10000 // Add duration in ms
                    )
                    continue
                }
            }

            // Save previous marathon if it qualifies
            if (currentMarathon && currentMarathon.episodes.length >= minEpisodes) {
                const totalDuration = currentMarathon.episodes.reduce(
                    (sum, e) => sum + Number(e.duration) / 10000000 / 3600, 0
                )
                if (totalDuration >= minHours) {
                    marathons.push({
                        date: format(currentMarathon.startTime, 'yyyy-MM-dd'),
                        startTime: format(currentMarathon.startTime, 'HH:mm'),
                        endTime: format(currentMarathon.endTime, 'HH:mm'),
                        duration: Math.round(totalDuration * 10) / 10,
                        episodes: currentMarathon.episodes.length,
                        seriesName: currentMarathon.seriesName,
                        userName: currentMarathon.userName,
                        userId: currentMarathon.userId,
                    })
                }
            }

            // Start new marathon
            currentMarathon = {
                userId: ep.serverUserId,
                userName,
                seriesName: ep.seriesName,
                startTime: ep.playedAt,
                endTime: new Date(ep.playedAt.getTime() + Number(ep.playDuration) / 10000),
                episodes: [{ playedAt: ep.playedAt, duration: ep.playDuration }],
            }
        }

        // Check last marathon
        if (currentMarathon && currentMarathon.episodes.length >= minEpisodes) {
            const totalDuration = currentMarathon.episodes.reduce(
                (sum, e) => sum + Number(e.duration) / 10000000 / 3600, 0
            )
            if (totalDuration >= minHours) {
                marathons.push({
                    date: format(currentMarathon.startTime, 'yyyy-MM-dd'),
                    startTime: format(currentMarathon.startTime, 'HH:mm'),
                    endTime: format(currentMarathon.endTime, 'HH:mm'),
                    duration: Math.round(totalDuration * 10) / 10,
                    episodes: currentMarathon.episodes.length,
                    seriesName: currentMarathon.seriesName,
                    userName: currentMarathon.userName,
                    userId: currentMarathon.userId,
                })
            }
        }

        // Sort by duration descending
        marathons.sort((a, b) => b.duration - a.duration)

        // Calculate stats
        const totalMarathons = marathons.length
        const totalHours = marathons.reduce((sum, m) => sum + m.duration, 0)
        const avgDuration = totalMarathons > 0 ? totalHours / totalMarathons : 0
        const longestMarathon = marathons[0] || null

        return NextResponse.json({
            marathons: marathons.slice(0, 50), // Limit to 50 results
            stats: {
                totalMarathons,
                totalHours: Math.round(totalHours * 10) / 10,
                avgDuration: Math.round(avgDuration * 10) / 10,
                longestMarathon,
            },
        })
    } catch (error) {
        console.error('Error fetching marathons:', error)
        return NextResponse.json({ error: 'Failed to fetch marathons' }, { status: 500 })
    }
}
