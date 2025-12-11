/**
 * Scraper Folders API
 * GET: List all scraper folders
 * POST: Add a new folder
 * PUT: Update a folder
 * DELETE: Remove a folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ScraperFolder } from '@prisma/client'

// GET /api/scraper/folders - Get all folders
export async function GET() {
    try {
        const folders = await prisma.scraperFolder.findMany({
            where: { enabled: true },
            orderBy: { createdAt: 'asc' },
        })

        return NextResponse.json({
            success: true,
            folders: folders.map((f: ScraperFolder) => ({
                id: f.id,
                path: f.path,
                type: f.type as 'Movie' | 'Series',
            })),
        })
    } catch (error) {
        console.error('[ScraperFolders] GET failed:', error)
        return NextResponse.json({ error: '获取文件夹失败' }, { status: 500 })
    }
}

// POST /api/scraper/folders - Add a new folder
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { path, type } = body as { path: string; type: 'Movie' | 'Series' }

        if (!path || !path.trim()) {
            return NextResponse.json({ error: '路径不能为空' }, { status: 400 })
        }

        // Upsert - update if exists, create if not
        const folder = await prisma.scraperFolder.upsert({
            where: { path: path.trim() },
            update: { type: type || 'Movie', enabled: true },
            create: { path: path.trim(), type: type || 'Movie' },
        })

        return NextResponse.json({
            success: true,
            folder: {
                id: folder.id,
                path: folder.path,
                type: folder.type,
            },
        })
    } catch (error) {
        console.error('[ScraperFolders] POST failed:', error)
        return NextResponse.json({ error: '添加文件夹失败' }, { status: 500 })
    }
}

// PUT /api/scraper/folders - Batch update folders
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { folders } = body as { folders: Array<{ path: string; type: 'Movie' | 'Series' }> }

        if (!folders || !Array.isArray(folders)) {
            return NextResponse.json({ error: '无效的文件夹数据' }, { status: 400 })
        }

        // Disable all existing folders
        await prisma.scraperFolder.updateMany({
            data: { enabled: false },
        })

        // Upsert each folder
        const results = []
        for (const f of folders) {
            if (f.path && f.path.trim()) {
                const folder = await prisma.scraperFolder.upsert({
                    where: { path: f.path.trim() },
                    update: { type: f.type || 'Movie', enabled: true },
                    create: { path: f.path.trim(), type: f.type || 'Movie' },
                })
                results.push(folder)
            }
        }

        return NextResponse.json({
            success: true,
            count: results.length,
        })
    } catch (error) {
        console.error('[ScraperFolders] PUT failed:', error)
        return NextResponse.json({ error: '保存文件夹失败' }, { status: 500 })
    }
}

// DELETE /api/scraper/folders - Remove a folder
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const path = searchParams.get('path')

        if (!path) {
            return NextResponse.json({ error: '路径不能为空' }, { status: 400 })
        }

        await prisma.scraperFolder.updateMany({
            where: { path: path.trim() },
            data: { enabled: false },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[ScraperFolders] DELETE failed:', error)
        return NextResponse.json({ error: '删除文件夹失败' }, { status: 500 })
    }
}
