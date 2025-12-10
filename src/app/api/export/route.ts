import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

// GET /api/export - Export data as CSV
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'playhistory'

    try {
        let csvContent = ''
        let filename = ''

        if (type === 'playhistory') {
            // Export play history
            const records = await prisma.playHistory.findMany({
                include: {
                    serverUser: {
                        select: {
                            username: true,
                            globalUser: { select: { name: true } },
                        },
                    },
                    server: { select: { name: true } },
                },
                orderBy: { playedAt: 'desc' },
                take: 10000, // Limit to 10000 records
            })

            // CSV Header
            csvContent = '日期,用户,服务器,影片名称,类型,时长(分钟),观看时长(分钟),进度(%),是否完播\n'

            // CSV Rows
            for (const record of records) {
                const userName = record.serverUser.globalUser?.name || record.serverUser.username
                const duration = Number(record.duration) / 600000000 // ticks to minutes
                const playDuration = Number(record.playDuration) / 600000000
                const progress = duration > 0 ? Math.round((playDuration / duration) * 100) : 0

                csvContent += `"${format(record.playedAt, 'yyyy-MM-dd HH:mm')}","${userName}","${record.server.name}","${record.itemName.replace(/"/g, '""')}","${record.itemType}",${duration.toFixed(1)},${playDuration.toFixed(1)},${progress},${record.isCompleted ? '是' : '否'}\n`
            }

            filename = `playhistory_${format(new Date(), 'yyyyMMdd')}.csv`
        } else if (type === 'users') {
            // Export user statistics
            const users = await prisma.serverUser.findMany({
                include: {
                    server: { select: { name: true } },
                    globalUser: { select: { name: true } },
                    _count: { select: { playHistory: true } },
                },
            })

            // Aggregate play duration per user
            const userStats = await prisma.playHistory.groupBy({
                by: ['serverUserId'],
                _sum: { playDuration: true },
            })

            const statsMap = new Map(userStats.map((s: { serverUserId: string; _sum: { playDuration: bigint | null } }) => [s.serverUserId, Number(s._sum.playDuration || 0)]))

            csvContent = '用户名,全局名称,服务器,播放次数,总时长(小时)\n'

            for (const user of users) {
                const duration = (statsMap.get(user.id) || 0) / 36000000000 // ticks to hours
                csvContent += `"${user.username}","${user.globalUser?.name || ''}","${user.server.name}",${user._count.playHistory},${duration.toFixed(1)}\n`
            }

            filename = `users_${format(new Date(), 'yyyyMMdd')}.csv`
        } else if (type === 'daily') {
            // Export daily statistics
            const history = await prisma.playHistory.findMany({
                select: { playedAt: true, playDuration: true },
            })

            // Group by day
            const dailyMap = new Map<string, number>()
            for (const record of history) {
                const day = format(record.playedAt, 'yyyy-MM-dd')
                dailyMap.set(day, (dailyMap.get(day) || 0) + Number(record.playDuration))
            }

            csvContent = '日期,总时长(小时)\n'
            const sortedDays = Array.from(dailyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))

            for (const [day, duration] of sortedDays) {
                const hours = duration / 36000000000
                csvContent += `${day},${hours.toFixed(1)}\n`
            }

            filename = `daily_stats_${format(new Date(), 'yyyyMMdd')}.csv`
        } else {
            return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
        }

        // Add BOM for Excel UTF-8 compatibility
        const bom = '\uFEFF'
        const csvWithBom = bom + csvContent

        return new NextResponse(csvWithBom, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (error) {
        console.error('[API] Export failed:', error)
        return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    }
}
