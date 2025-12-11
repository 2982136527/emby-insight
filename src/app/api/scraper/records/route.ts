/**
 * Scrape Records API
 * GET: List records by folder/type/status
 * POST: Save/update records after scraping
 * DELETE: Delete records for a folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RecordInput {
    filePath: string
    fileName: string
    mediaType: 'Movie' | 'Series'
    isStrm: boolean
    matched: boolean
    tmdbId?: number
    tmdbType?: 'movie' | 'tv'
    title?: string
    titleCn?: string
    posterPath?: string
    releaseDate?: string
    voteAverage?: number
    matchSource?: 'cache' | 'api' | 'manual'
}

// GET /api/scraper/records - Get records
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') // Movie, Series, or null for all
        const matched = searchParams.get('matched') // true, false, or null for all
        const folderId = searchParams.get('folderId')

        const where: any = {}

        if (type) {
            where.mediaType = type
        }

        if (matched === 'true') {
            where.matched = true
        } else if (matched === 'false') {
            where.matched = false
        }

        if (folderId) {
            where.folderId = folderId
        }

        const records = await prisma.scrapeRecord.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            include: {
                folder: {
                    select: { path: true, type: true }
                }
            }
        })

        // Get counts by category
        const counts = await prisma.scrapeRecord.groupBy({
            by: ['mediaType', 'matched'],
            _count: true,
        })

        const stats = {
            movieTotal: 0,
            movieMatched: 0,
            seriesTotal: 0,
            seriesMatched: 0,
        }

        for (const c of counts) {
            if (c.mediaType === 'Movie') {
                stats.movieTotal += c._count
                if (c.matched) stats.movieMatched += c._count
            } else if (c.mediaType === 'Series') {
                stats.seriesTotal += c._count
                if (c.matched) stats.seriesMatched += c._count
            }
        }

        return NextResponse.json({
            success: true,
            records: records.map(r => ({
                id: r.id,
                filePath: r.filePath,
                fileName: r.fileName,
                mediaType: r.mediaType,
                isStrm: r.isStrm,
                matched: r.matched,
                tmdbId: r.tmdbId,
                tmdbType: r.tmdbType,
                title: r.title,
                titleCn: r.titleCn,
                posterPath: r.posterPath,
                releaseDate: r.releaseDate,
                voteAverage: r.voteAverage,
                matchSource: r.matchSource,
                folderPath: r.folder.path,
            })),
            stats,
        })
    } catch (error) {
        console.error('[ScrapeRecords] GET failed:', error)
        return NextResponse.json({ error: '获取记录失败' }, { status: 500 })
    }
}

// POST /api/scraper/records - Save records
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { folderId, records } = body as { folderId: string; records: RecordInput[] }

        if (!folderId || !records || !Array.isArray(records)) {
            return NextResponse.json({ error: '无效的数据' }, { status: 400 })
        }

        let savedCount = 0
        let updatedCount = 0

        for (const record of records) {
            const existing = await prisma.scrapeRecord.findUnique({
                where: { filePath: record.filePath },
            })

            if (existing) {
                await prisma.scrapeRecord.update({
                    where: { filePath: record.filePath },
                    data: {
                        matched: record.matched,
                        tmdbId: record.tmdbId,
                        tmdbType: record.tmdbType,
                        title: record.title,
                        titleCn: record.titleCn,
                        posterPath: record.posterPath,
                        releaseDate: record.releaseDate,
                        voteAverage: record.voteAverage,
                        matchSource: record.matchSource,
                    },
                })
                updatedCount++
            } else {
                await prisma.scrapeRecord.create({
                    data: {
                        filePath: record.filePath,
                        fileName: record.fileName,
                        mediaType: record.mediaType,
                        isStrm: record.isStrm,
                        matched: record.matched,
                        tmdbId: record.tmdbId,
                        tmdbType: record.tmdbType,
                        title: record.title,
                        titleCn: record.titleCn,
                        posterPath: record.posterPath,
                        releaseDate: record.releaseDate,
                        voteAverage: record.voteAverage,
                        matchSource: record.matchSource,
                        folderId: folderId,
                    },
                })
                savedCount++
            }
        }

        return NextResponse.json({
            success: true,
            saved: savedCount,
            updated: updatedCount,
        })
    } catch (error) {
        console.error('[ScrapeRecords] POST failed:', error)
        return NextResponse.json({ error: '保存记录失败' }, { status: 500 })
    }
}

// PUT /api/scraper/records - Update a single record (manual match)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { filePath, tmdbId, tmdbType, title, titleCn, posterPath, releaseDate, voteAverage } = body

        if (!filePath || !tmdbId) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
        }

        const record = await prisma.scrapeRecord.update({
            where: { filePath },
            data: {
                matched: true,
                tmdbId,
                tmdbType,
                title,
                titleCn,
                posterPath,
                releaseDate,
                voteAverage,
                matchSource: 'manual',
            },
        })

        return NextResponse.json({
            success: true,
            record,
        })
    } catch (error) {
        console.error('[ScrapeRecords] PUT failed:', error)
        return NextResponse.json({ error: '更新记录失败' }, { status: 500 })
    }
}

// DELETE /api/scraper/records - Clear unmatched records
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const clearAll = searchParams.get('all') === 'true'
        const mediaType = searchParams.get('type') // Movie or Series

        const where: any = {}

        if (!clearAll) {
            // Only delete unmatched by default
            where.matched = false
        }

        if (mediaType) {
            where.mediaType = mediaType
        }

        const result = await prisma.scrapeRecord.deleteMany({ where })

        console.log(`[ScrapeRecords] Deleted ${result.count} records`)

        return NextResponse.json({
            success: true,
            deleted: result.count,
        })
    } catch (error) {
        console.error('[ScrapeRecords] DELETE failed:', error)
        return NextResponse.json({ error: '清空记录失败' }, { status: 500 })
    }
}
