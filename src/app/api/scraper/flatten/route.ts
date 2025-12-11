/**
 * File Flatten/Undo API
 * POST: Undo incorrect organization - move files back up from same-name folders
 */

import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// Supported media file extensions
const MEDIA_EXTENSIONS = new Set([
    '.mkv', '.mp4', '.avi', '.strm', '.ts', '.m2ts',
    '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg'
])

interface FlattenResult {
    flattened: number
    skipped: number
    errors: string[]
    details: Array<{
        from: string
        to: string
        removedFolder: string
    }>
}

/**
 * Check if a folder contains only a single media file with matching name
 * Returns the file path if it should be flattened, null otherwise
 */
function shouldFlatten(folderPath: string): string | null {
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true })
        const folderName = path.basename(folderPath)

        // Find media files in this folder
        const mediaFiles = entries.filter(e => {
            if (!e.isFile()) return false
            const ext = path.extname(e.name).toLowerCase()
            return MEDIA_EXTENSIONS.has(ext)
        })

        // If there's exactly one media file
        if (mediaFiles.length === 1) {
            const mediaFile = mediaFiles[0]
            const fileNameWithoutExt = path.basename(mediaFile.name, path.extname(mediaFile.name))

            // Check if the folder name matches the file name (indicating it was auto-organized)
            if (folderName === fileNameWithoutExt) {
                return path.join(folderPath, mediaFile.name)
            }
        }

        return null
    } catch {
        return null
    }
}

/**
 * Flatten a file - move it up and remove the folder
 */
function flattenFile(filePath: string): { success: boolean; newPath?: string; error?: string } {
    try {
        const fileName = path.basename(filePath)
        const folderPath = path.dirname(filePath)
        const parentDir = path.dirname(folderPath)
        const newFilePath = path.join(parentDir, fileName)

        // Check if target already exists
        if (fs.existsSync(newFilePath)) {
            return { success: false, error: `目标文件已存在: ${newFilePath}` }
        }

        // Move the file up
        fs.renameSync(filePath, newFilePath)

        // Try to remove the now-empty folder
        try {
            // Only remove if folder is now empty or only has non-media files
            const remaining = fs.readdirSync(folderPath)
            const hasMedia = remaining.some(f => {
                const ext = path.extname(f).toLowerCase()
                return MEDIA_EXTENSIONS.has(ext)
            })

            if (!hasMedia && remaining.length <= 3) {
                // Remove remaining files (like nfo, jpg, etc) and folder
                for (const f of remaining) {
                    fs.unlinkSync(path.join(folderPath, f))
                }
                fs.rmdirSync(folderPath)
            }
        } catch {
            // Folder removal failed, but file was moved successfully
        }

        return { success: true, newPath: newFilePath }
    } catch (error) {
        return { success: false, error: `移动失败: ${error}` }
    }
}

/**
 * Recursively scan for folders that need flattening
 */
function scanForFlatten(folderPath: string, result: FlattenResult): void {
    try {
        if (!fs.existsSync(folderPath)) {
            result.errors.push(`文件夹不存在: ${folderPath}`)
            return
        }

        const entries = fs.readdirSync(folderPath, { withFileTypes: true })

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name)

            if (entry.isDirectory()) {
                // Check if this folder should be flattened
                const fileToFlatten = shouldFlatten(fullPath)

                if (fileToFlatten) {
                    const flattenResult = flattenFile(fileToFlatten)
                    if (flattenResult.success) {
                        result.flattened++
                        result.details.push({
                            from: fileToFlatten,
                            to: flattenResult.newPath!,
                            removedFolder: fullPath,
                        })
                        console.log(`[Flatten] 已恢复: ${entry.name}`)
                    } else {
                        result.errors.push(flattenResult.error!)
                    }
                } else {
                    // Recursively scan subdirectories
                    scanForFlatten(fullPath, result)
                }
            }
        }
    } catch (error) {
        result.errors.push(`扫描失败 ${folderPath}: ${error}`)
    }
}

// POST /api/scraper/flatten - Undo organization
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { folders } = body as { folders: string[] }

        if (!folders || !Array.isArray(folders) || folders.length === 0) {
            return NextResponse.json({ error: '请提供要恢复的文件夹路径' }, { status: 400 })
        }

        const result: FlattenResult = {
            flattened: 0,
            skipped: 0,
            errors: [],
            details: [],
        }

        for (const folder of folders) {
            const normalizedPath = path.normalize(folder.trim())
            if (normalizedPath) {
                console.log(`[Flatten] 扫描: ${normalizedPath}`)
                scanForFlatten(normalizedPath, result)
            }
        }

        console.log(`[Flatten] 完成: 恢复 ${result.flattened} 个文件，${result.errors.length} 个错误`)

        return NextResponse.json({
            success: true,
            message: `已恢复 ${result.flattened} 个文件`,
            ...result,
        })
    } catch (error) {
        console.error('[Flatten] Failed:', error)
        return NextResponse.json({ error: '恢复失败' }, { status: 500 })
    }
}
