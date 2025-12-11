/**
 * File Organizer API
 * POST: Organize loose media files into same-name folders
 */

import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// Supported media file extensions
const MEDIA_EXTENSIONS = new Set([
    '.mkv', '.mp4', '.avi', '.strm', '.ts', '.m2ts',
    '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg'
])

interface OrganizeResult {
    organized: number
    skipped: number
    errors: string[]
    details: Array<{
        from: string
        to: string
    }>
}

/**
 * Check if a file needs to be organized
 * Returns true if the file is not in a folder with its own name
 */
function needsOrganizing(filePath: string): boolean {
    const fileName = path.basename(filePath, path.extname(filePath))
    const parentDir = path.dirname(filePath)
    const parentName = path.basename(parentDir)

    // If parent folder name matches the file name (without extension), already organized
    // Also check if the file name starts with the parent name
    if (parentName === fileName || fileName.startsWith(parentName)) {
        return false
    }

    return true
}

/**
 * Organize a single file into its own folder
 */
function organizeFile(filePath: string): { success: boolean; newPath?: string; error?: string } {
    try {
        const parentDir = path.dirname(filePath)
        const fileName = path.basename(filePath)
        const fileNameWithoutExt = path.basename(filePath, path.extname(filePath))

        // Create new folder path
        const newFolderPath = path.join(parentDir, fileNameWithoutExt)
        const newFilePath = path.join(newFolderPath, fileName)

        // Check if folder already exists
        if (fs.existsSync(newFolderPath)) {
            // Check if it's a directory
            if (!fs.statSync(newFolderPath).isDirectory()) {
                return { success: false, error: `路径已存在但不是文件夹: ${newFolderPath}` }
            }
            // Check if file already exists in the target folder
            if (fs.existsSync(newFilePath)) {
                return { success: false, error: `目标文件已存在: ${newFilePath}` }
            }
        } else {
            // Create the folder
            fs.mkdirSync(newFolderPath, { recursive: true })
        }

        // Move the file
        fs.renameSync(filePath, newFilePath)

        return { success: true, newPath: newFilePath }
    } catch (error) {
        return { success: false, error: `移动失败: ${error}` }
    }
}
/**
 * Recursively scan folders for loose media files
 * Only organize folders that have MORE than 2 media files (indicating a collection/dump folder)
 * Folders with 2 or fewer media files are considered already organized (movie + sample)
 */
function scanForLooseFiles(folderPath: string, result: OrganizeResult, depth: number = 0): void {
    try {
        if (!fs.existsSync(folderPath)) {
            result.errors.push(`文件夹不存在: ${folderPath}`)
            return
        }

        const stats = fs.statSync(folderPath)
        if (!stats.isDirectory()) {
            result.errors.push(`不是文件夹: ${folderPath}`)
            return
        }

        const entries = fs.readdirSync(folderPath, { withFileTypes: true })
        const dirs = entries.filter(e => e.isDirectory())
        const files = entries.filter(e => e.isFile())

        // Count media files in this folder
        const mediaFiles = files.filter(f => {
            const ext = path.extname(f.name).toLowerCase()
            return MEDIA_EXTENSIONS.has(ext)
        })

        const indent = '  '.repeat(depth)
        console.log(`${indent}[Organizer] 扫描: ${path.basename(folderPath)} (${dirs.length} 子文件夹, ${mediaFiles.length} 媒体文件)`)

        // First, recurse into subdirectories
        for (const dir of dirs) {
            scanForLooseFiles(path.join(folderPath, dir.name), result, depth + 1)
        }

        // Only organize if this folder has MORE than 2 media files
        // (2 or fewer = a proper movie folder with maybe a sample file)
        if (mediaFiles.length <= 2) {
            if (mediaFiles.length > 0) {
                console.log(`${indent}[Organizer] 跳过: 只有 ${mediaFiles.length} 个媒体文件，视为已整理`)
            }
            return
        }

        console.log(`${indent}[Organizer] 需要整理: ${mediaFiles.length} 个媒体文件`)

        // Organize media files
        for (const file of mediaFiles) {
            const fullPath = path.join(folderPath, file.name)

            // Check if needs organizing (not already in a same-name folder)
            if (!needsOrganizing(fullPath)) {
                result.skipped++
                continue
            }

            // Organize the file
            const organizeResult = organizeFile(fullPath)
            if (organizeResult.success) {
                result.organized++
                result.details.push({
                    from: fullPath,
                    to: organizeResult.newPath!,
                })
                console.log(`${indent}[Organizer] ✓ 已整理: ${file.name}`)
            } else {
                result.errors.push(organizeResult.error!)
            }
        }
    } catch (error) {
        result.errors.push(`扫描失败 ${folderPath}: ${error}`)
    }
}

// POST /api/scraper/organize - Organize files in folders
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { folders } = body as { folders: string[] }

        if (!folders || !Array.isArray(folders) || folders.length === 0) {
            return NextResponse.json({ error: '请提供要整理的文件夹路径' }, { status: 400 })
        }

        const result: OrganizeResult = {
            organized: 0,
            skipped: 0,
            errors: [],
            details: [],
        }

        for (const folder of folders) {
            const normalizedPath = path.normalize(folder.trim())
            if (normalizedPath) {
                console.log(`[Organizer] 扫描根目录: ${normalizedPath}`)
                scanForLooseFiles(normalizedPath, result)
            }
        }

        console.log(`[Organizer] 完成: 整理 ${result.organized} 个文件，跳过 ${result.skipped} 个，${result.errors.length} 个错误`)

        return NextResponse.json({
            success: true,
            message: `已整理 ${result.organized} 个文件`,
            ...result,
        })
    } catch (error) {
        console.error('[Organizer] Failed:', error)
        return NextResponse.json({ error: '整理失败' }, { status: 500 })
    }
}
