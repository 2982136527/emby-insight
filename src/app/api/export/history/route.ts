import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

// GET /api/export/history - Export play history as CSV
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const userId = searchParams.get('userId')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const formatType = searchParams.get('format') || 'csv'

        // Build query filter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {}

        if (userId) {
            where.serverUserId = userId
        }

        if (startDate || endDate) {
            where.playedAt = {}
            if (startDate) {
                where.playedAt.gte = new Date(startDate)
            }
            if (endDate) {
                where.playedAt.lte = new Date(endDate)
            }
        }

        // Fetch play history
        const history = await prisma.playHistory.findMany({
            where,
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
            take: 10000, // Limit to prevent memory issues
        })

        if (formatType === 'json') {
            return NextResponse.json({
                count: history.length,
                data: history.map((h) => ({
                    id: h.id,
                    userName: h.serverUser.globalUser?.name || h.serverUser.username,
                    serverName: h.server.name,
                    itemName: h.itemName,
                    itemType: h.itemType,
                    seriesName: h.seriesName,
                    playedAt: h.playedAt,
                    playDuration: Number(h.playDuration),
                    duration: Number(h.duration),
                    isCompleted: h.isCompleted,
                })),
            })
        }

        // Generate CSV
        const csvHeaders = [
            '用户名',
            '服务器',
            '媒体名称',
            '类型',
            '剧集名',
            '播放时间',
            '观看时长(分钟)',
            '总时长(分钟)',
            '是否完播',
        ]

        const csvRows = history.map((h) => [
            h.serverUser.globalUser?.name || h.serverUser.username,
            h.server.name,
            `"${h.itemName.replace(/"/g, '""')}"`, // Escape quotes
            h.itemType,
            h.seriesName ? `"${h.seriesName.replace(/"/g, '""')}"` : '',
            format(new Date(h.playedAt), 'yyyy-MM-dd HH:mm:ss'),
            Math.round(Number(h.playDuration) / 10000000 / 60),
            Math.round(Number(h.duration) / 10000000 / 60),
            h.isCompleted ? '是' : '否',
        ])

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map((row) => row.join(',')),
        ].join('\n')

        // Add BOM for Excel UTF-8 compatibility
        const bom = '\uFEFF'
        const csvWithBom = bom + csvContent

        const filename = `emby-insight-history-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`

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
