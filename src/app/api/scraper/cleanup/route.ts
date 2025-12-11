/**
 * Clean Empty Folders API
 * DELETE: Remove all empty folders in specified paths
 */

import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

interface CleanResult {
    removed: number
    errors: string[]
    folders: string[]
}

/**
 * Check if a folder is empty (or only contains other empty folders)
 */
function isEmptyFolder(folderPath: string): boolean {
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true })

        if (entries.length === 0) {
            return true
        }

        // Check if all children are empty folders
        for (const entry of entries) {
            if (entry.isFile()) {
                return false
            }
            if (entry.isDirectory()) {
                const childPath = path.join(folderPath, entry.name)
                if (!isEmptyFolder(childPath)) {
                    return false
                }
            }
        }

        return true
    } catch {
        return false
    }
}
/**
 * Recursively remove empty folders (bottom-up)
 * Ignores macOS resource fork files (._xxx)
 */
function removeEmptyFolders(folderPath: string, result: CleanResult, depth: number = 0): void {
    try {
        if (!fs.existsSync(folderPath)) return

        const entries = fs.readdirSync(folderPath, { withFileTypes: true })
        const indent = '  '.repeat(depth)

        // Filter out macOS resource fork files when counting
        const realEntries = entries.filter(e => !e.name.startsWith('._'))
        const dirs = realEntries.filter(e => e.isDirectory())
        const files = realEntries.filter(e => e.isFile())

        // Only log folders that have subdirectories or are candidates for deletion
        if (dirs.length > 0 || realEntries.length === 0) {
            console.log(`${indent}[Cleanup] 扫描: ${path.basename(folderPath)} (${dirs.length} 子文件夹, ${files.length} 文件)`)
        }

        // If this is a leaf folder (no subdirectories) and has real files, skip
        if (dirs.length === 0 && files.length > 0) {
            return
        }

        // First, recurse into subdirectories
        for (const dir of dirs) {
            const childPath = path.join(folderPath, dir.name)
            removeEmptyFolders(childPath, result, depth + 1)
        }

        // After recursion, check if this folder is now empty (or only has ._ files)
        const remainingEntries = fs.readdirSync(folderPath)
        const realRemaining = remainingEntries.filter(name => !name.startsWith('._'))

        if (realRemaining.length === 0) {
            try {
                // First remove macOS ._ files if any
                for (const entry of remainingEntries) {
                    if (entry.startsWith('._')) {
                        try {
                            fs.unlinkSync(path.join(folderPath, entry))
                        } catch { /* ignore */ }
                    }
                }

                fs.rmdirSync(folderPath)
                result.removed++
                result.folders.push(folderPath)
                console.log(`${indent}[Cleanup] ✓ 删除空文件夹: ${path.basename(folderPath)}`)
            } catch (error) {
                result.errors.push(`删除失败 ${folderPath}: ${error}`)
                console.log(`${indent}[Cleanup] ✗ 删除失败: ${path.basename(folderPath)} - ${error}`)
            }
        } else if (realRemaining.length <= 5) {
            console.log(`${indent}[Cleanup] 非空(${realRemaining.length}项): ${realRemaining.slice(0, 3).join(', ')}${realRemaining.length > 3 ? '...' : ''}`)
        }
    } catch (error) {
        result.errors.push(`扫描失败 ${folderPath}: ${error}`)
    }
}

// DELETE /api/scraper/cleanup - Remove empty folders
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json()
        const { folders } = body as { folders: string[] }

        if (!folders || !Array.isArray(folders) || folders.length === 0) {
            return NextResponse.json({ error: '请提供要清理的文件夹路径' }, { status: 400 })
        }

        const result: CleanResult = {
            removed: 0,
            errors: [],
            folders: [],
        }

        for (const folder of folders) {
            const normalizedPath = path.normalize(folder.trim())
            if (normalizedPath) {
                console.log(`[Cleanup] 扫描: ${normalizedPath}`)
                // Don't remove the root folder itself, only its empty children
                const entries = fs.readdirSync(normalizedPath, { withFileTypes: true })
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        removeEmptyFolders(path.join(normalizedPath, entry.name), result)
                    }
                }
            }
        }

        console.log(`[Cleanup] 完成: 删除 ${result.removed} 个空文件夹`)

        return NextResponse.json({
            success: true,
            message: `已删除 ${result.removed} 个空文件夹`,
            ...result,
        })
    } catch (error) {
        console.error('[Cleanup] Failed:', error)
        return NextResponse.json({ error: '清理失败' }, { status: 500 })
    }
}
