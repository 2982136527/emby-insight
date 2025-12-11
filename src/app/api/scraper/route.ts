/**
 * Scraper API Endpoints (Folder-Based)
 * POST: Start scraping folders
 * GET: Get scrape status/results
 * DELETE: Cancel running scrape
 */

import { NextRequest, NextResponse } from 'next/server'
import {
    scrapeItems,
    getScrapeProgress,
    cancelScrape,
    resetScrape,
    EmbyItemForScrape,
    ScrapedItemResult,
} from '@/lib/scraper/scraper-service'
import { scanFolders, deduplicateByTitle, ScannedMediaFile } from '@/lib/scraper/folder-scanner'
import { prisma } from '@/lib/prisma'

// Cache for results
let lastResults: ScrapedItemResult[] = []

interface FolderEntry {
    path: string
    type: 'Movie' | 'Series'
}

// GET /api/scraper - Get scrape status and results
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const includeResults = searchParams.get('results') === 'true'
    const filter = searchParams.get('filter') || 'all'

    const progress = getScrapeProgress()

    // Filter results if requested
    let results = lastResults
    if (filter === 'matched') {
        results = lastResults.filter(r => r.matchResult.matched)
    } else if (filter === 'unmatched') {
        results = lastResults.filter(r => !r.matchResult.matched)
    }

    return NextResponse.json({
        progress,
        results: includeResults ? results : undefined,
        resultCount: {
            total: lastResults.length,
            matched: lastResults.filter(r => r.matchResult.matched).length,
            unmatched: lastResults.filter(r => !r.matchResult.matched).length,
        },
    })
}

// POST /api/scraper - Start scraping folders
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { folders, deduplicate = true, skipMatched = true } = body as {
            folders: FolderEntry[] | string[]
            deduplicate?: boolean
            skipMatched?: boolean  // Skip files already matched in database
        }

        if (!folders || !Array.isArray(folders) || folders.length === 0) {
            return NextResponse.json({ error: 'folders array is required' }, { status: 400 })
        }

        // Normalize folders to FolderEntry format (support both old string[] and new FolderEntry[])
        const normalizedFolders: FolderEntry[] = folders.map((f: string | FolderEntry) => {
            if (typeof f === 'string') {
                return { path: f.trim(), type: 'Movie' as const }
            }
            return { path: f.path.trim(), type: f.type || 'Movie' }
        }).filter(f => f.path.length > 0)

        if (normalizedFolders.length === 0) {
            return NextResponse.json({ error: 'No valid folder paths provided' }, { status: 400 })
        }

        // Check if already running
        const progress = getScrapeProgress()
        if (progress.status === 'running') {
            return NextResponse.json({ error: 'Scrape already in progress' }, { status: 409 })
        }

        // Reset state
        resetScrape()
        lastResults = []

        // Scan each folder with its type
        let allScannedFiles: (ScannedMediaFile & { mediaType: 'Movie' | 'Series' })[] = []

        for (const folder of normalizedFolders) {
            const scannedFiles = scanFolders([folder.path])
            // Tag each file with its folder's media type
            const taggedFiles = scannedFiles.map(f => ({ ...f, mediaType: folder.type }))
            allScannedFiles.push(...taggedFiles)
        }

        if (allScannedFiles.length === 0) {
            return NextResponse.json({
                error: '未在指定文件夹中找到媒体文件',
                scannedFolders: normalizedFolders.map(f => f.path)
            }, { status: 404 })
        }

        // Skip already matched files from database
        let skippedCount = 0
        if (skipMatched) {
            try {
                // Get all file paths that are already matched
                const matchedRecords = await prisma.scrapeRecord.findMany({
                    where: { matched: true },
                    select: { filePath: true }
                })
                const matchedPaths = new Set(matchedRecords.map(r => r.filePath))

                const originalCount = allScannedFiles.length
                allScannedFiles = allScannedFiles.filter(f => !matchedPaths.has(f.filePath))
                skippedCount = originalCount - allScannedFiles.length

                if (skippedCount > 0) {
                    console.log(`[Scraper] Skipped ${skippedCount} already matched files`)
                }
            } catch (error) {
                console.error('[Scraper] Error loading matched records:', error)
                // Continue without skipping if error
            }
        }

        // Deduplicate if requested (keeping mediaType info)
        if (deduplicate) {
            const seen = new Map<string, typeof allScannedFiles[0]>()
            for (const file of allScannedFiles) {
                const key = `${file.parsedTitle.toLowerCase()}-${file.parsedYear || 'unknown'}-${file.mediaType}`
                if (!seen.has(key)) {
                    seen.set(key, file)
                } else {
                    const existing = seen.get(key)!
                    if (existing.isStrm && !file.isStrm) {
                        seen.set(key, file)
                    }
                }
            }
            allScannedFiles = Array.from(seen.values())
        }

        // Convert to scrape items with proper type from folder config
        const items: EmbyItemForScrape[] = allScannedFiles.map(file => ({
            id: file.filePath,
            name: file.parsedTitle,
            type: file.mediaType,
            productionYear: file.parsedYear,
        }))

        // Start scraping in background
        scrapeItems(items).then(async (results) => {
            // Enrich results with file info
            lastResults = results.map((r, i) => ({
                ...r,
                filePath: allScannedFiles[i].filePath,
                isStrm: allScannedFiles[i].isStrm,
            })) as any

            // Save results to database
            try {
                const { prisma } = await import('@/lib/prisma')

                // Group results by folder path
                const resultsByFolder = new Map<string, typeof lastResults>()
                for (let i = 0; i < lastResults.length; i++) {
                    const filePath = allScannedFiles[i].filePath
                    // Find which folder this file belongs to
                    const folder = normalizedFolders.find(f => filePath.startsWith(f.path))
                    if (folder) {
                        const existing = resultsByFolder.get(folder.path) || []
                        existing.push(lastResults[i])
                        resultsByFolder.set(folder.path, existing)
                    }
                }

                // Save records for each folder
                for (const [folderPath, folderResults] of resultsByFolder) {
                    // Get or create folder
                    const folder = await prisma.scraperFolder.upsert({
                        where: { path: folderPath },
                        update: {},
                        create: {
                            path: folderPath,
                            type: normalizedFolders.find(f => f.path === folderPath)?.type || 'Movie'
                        },
                    })

                    // Save each record
                    for (const result of folderResults) {
                        const r = result as any

                        // Check if record already exists and is matched - don't overwrite!
                        const existingRecord = await prisma.scrapeRecord.findUnique({
                            where: { filePath: r.filePath },
                            select: { matched: true }
                        })

                        // If already matched, skip update (preserve manual/previous match)
                        if (existingRecord?.matched) {
                            console.log(`[Scraper] Skipping already matched: ${r.embyItemName}`)
                            continue
                        }

                        await prisma.scrapeRecord.upsert({
                            where: { filePath: r.filePath },
                            update: {
                                matched: r.matchResult.matched,
                                tmdbId: r.metadata?.tmdbId,
                                tmdbType: r.embyItemType === 'Movie' ? 'movie' : 'tv',
                                title: r.metadata?.title,
                                titleCn: r.metadata?.titleCn,
                                posterPath: r.metadata?.posterPath,
                                releaseDate: r.metadata?.releaseDate,
                                voteAverage: r.metadata?.voteAverage,
                                matchSource: r.source,
                            },
                            create: {
                                filePath: r.filePath,
                                fileName: r.embyItemName,
                                mediaType: r.embyItemType,
                                isStrm: r.isStrm || false,
                                matched: r.matchResult.matched,
                                tmdbId: r.metadata?.tmdbId,
                                tmdbType: r.embyItemType === 'Movie' ? 'movie' : 'tv',
                                title: r.metadata?.title,
                                titleCn: r.metadata?.titleCn,
                                posterPath: r.metadata?.posterPath,
                                releaseDate: r.metadata?.releaseDate,
                                voteAverage: r.metadata?.voteAverage,
                                matchSource: r.source,
                                folderId: folder.id,
                            },
                        })
                    }
                }
                console.log(`[Scraper] Saved ${lastResults.length} records to database`)
            } catch (error) {
                console.error('[Scraper] Failed to save records:', error)
            }
        })

        return NextResponse.json({
            message: 'Scraping started',
            itemCount: items.length,
            scannedFolders: normalizedFolders,
            progress: getScrapeProgress(),
        })
    } catch (error) {
        console.error('[Scraper] Failed to start:', error)
        return NextResponse.json({ error: 'Failed to start scraping' }, { status: 500 })
    }
}

// DELETE /api/scraper - Cancel running scrape
export async function DELETE() {
    const progress = getScrapeProgress()
    if (progress.status !== 'running') {
        return NextResponse.json({ message: 'No scrape in progress' })
    }

    cancelScrape()
    return NextResponse.json({ message: 'Scrape cancelled' })
}
