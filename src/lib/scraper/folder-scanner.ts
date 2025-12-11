/**
 * Folder Scanner Utility
 * Scans local file system folders for media files including STRM files.
 */

import * as fs from 'fs'
import * as path from 'path'

// Supported media file extensions
const MEDIA_EXTENSIONS = new Set([
    '.mkv', '.mp4', '.avi', '.strm', '.ts', '.m2ts',
    '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg'
])

// Extensions to skip (subtitles, images, etc.)
const SKIP_EXTENSIONS = new Set([
    '.srt', '.ass', '.ssa', '.sub', '.idx', '.vtt',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff',
    '.nfo', '.txt', '.log', '.md'
])

export interface ScannedMediaFile {
    filePath: string
    fileName: string
    folderName: string
    parsedTitle: string
    parsedYear: number | null
    isStrm: boolean
    strmContent?: string // URL content from STRM file
}

export interface ParsedFileName {
    title: string
    year: number | null
}

/**
 * Parse title and year from a file or folder name
 * Handles various naming conventions including PT releases:
 * - "The Matrix (1999).mkv"
 * - "Inception.2010.1080p.BluRay.mkv"
 * - "阿凡达 Avatar (2009)"
 * - "[PTer].流浪地球.The.Wandering.Earth.2019.2160p.BluRay.x265-GTVG.mkv"
 * - "萧十一郎（狄龙版） 邵氏"
 */
export function parseFileName(name: string): ParsedFileName {
    // Remove file extension if present
    let baseName = name.replace(/\.[^/.]+$/, '')

    // PT站常见前缀 - 先移除这些
    baseName = baseName
        .replace(/^\[.*?\]\s*/g, '')  // Remove leading [brackets] like [PTer]
        .replace(/^【.*?】\s*/g, '')  // Remove leading 【brackets】
        .replace(/^@.*?\s+/g, '')     // Remove @username prefixes

    // PT站常见后缀和标签 - 更全面的清理列表
    const ptPatterns = [
        // 分辨率
        /\b(2160p|1080p|720p|480p|4K|UHD)\b/gi,
        // 组合格式 (4K265, 4Kx265, 4K H265 等)
        /4K\s*[xhHX]?\.?265/gi,
        /4K\s*[xhHX]?\.?264/gi,
        // 视频编码
        /\b(x264|x265|H\s*\.?\s*264|H\s*\.?\s*265|HEVC|AVC|VP9|AV1|10bit|8bit|265)(?:\b|$)/gi,
        // 音频编码 - 扩展更多格式
        /\b(AAC|DTS|DTS-HD|TrueHD|Atmos|DD5?\.?1|DD\+|EAC3|FLAC|LPCM|7\.1|5\.1|2\.0|DDP5?\.?1|AC3)\b/gi,
        // 来源 - 添加流媒体平台
        /\b(BluRay|Blu-Ray|BDRip|BDRemux|REMUX|WEBRip|WEB-DL|WEBDL|WEB|HDTV|DVDRip|DVD|HDRip|HC|TS|TC|CAM|R5|R6|ATVP|AMZN|NF|DSNP|HMAX|APTV)\b/gi,
        // HDR相关
        /\b(HDR|HDR10|HDR10\+|DV|DoVi|Dolby\.?Vision)\b/gi,
        // 发布组
        /-[A-Za-z0-9]+$/g,  // 结尾的 -GroupName
        /\b(GTVG|CMCT|FRDS|CHD|PTer|HDChina|TTG|MTeam|OPS|SuGo|REGRET|ALT|FLUX|SPARKS)\b/gi,
        // 其他常见标签
        /\b(PROPER|REPACK|RERIP|INTERNAL|LIMITED|EXTENDED|UNRATED|DIRECTORS\.?CUT|DC|IMAX|3D|MULTI|HYBRID)\b/gi,
        // 语言标签
        /\b(CHINESE|CHI|CHS|CHT|ENG|JPN|KOR|GER|FRE|SPA)\b/gi,
        // 字幕相关
        /\b(SUBBED|DUBBED|HARDSUB|SOFTSUB)\b/gi,
        // 字幕组和发布标签
        /\b(HiveWeb|HiVe|WEB4K|Web)\b/gi,
        // 文件大小 (16.55GB, 11.09GB, 666.20GB 等)
        /\d+\.?\d*\s*[GTM]B/gi,
        // 简写大小格式 (如单独的数字后面接GB的遗留)
        /\(\d+\.?\d*\s*[GTM]B\)/gi,
        // SDR/HDR 等画质标记
        /\bSDR\b/gi,
        /\bHQ\b/gi,
    ]

    // 中文常见后缀标签
    const chinesePatterns = [
        /邵氏/g,
        /国粤双语/g,
        /国语/g,
        /粤语/g,
        /国配/g,
        /台配/g,
        /港版/g,
        /台版/g,
        /加长版/g,
        /导演剪辑版/g,
        /修复版/g,
        /重制版/g,
        /电影版/g,
        /剧场版/g,
        /完整版/g,
        /内封/g,
        /外挂/g,
        /官方/g,
        /简体/g,
        /繁体/g,
        /中字/g,
        /中文/g,
        /字幕/g,
        /（.*?版）/g,  // (xxx版)
        /\(.*?版\)/g,   // (xxx版)
        // 豆瓣评分 (⭐豆瓣 8.8 等)
        /⭐.*?豆瓣.*?\d+\.?\d*/g,
        /豆瓣.*?\d+\.?\d*/g,
        /⭐+/g,  // 星号
        // 内封/外挂字幕标签
        /\[内封.*?\]/g,
        /\[外挂.*?\]/g,
        /内封简繁中字/g,
        /内封简繁中字幕/g,
        /内嵌简中字幕/g,
        /内封简日双语特效字幕/g,
        // 合集标签
        /\(合集\)/g,
        /（合集）/g,
    ]

    let cleanName = baseName
    for (const pattern of ptPatterns) {
        cleanName = cleanName.replace(pattern, ' ')
    }
    for (const pattern of chinesePatterns) {
        cleanName = cleanName.replace(pattern, ' ')
    }

    // 移除各种括号内容
    cleanName = cleanName
        .replace(/\[(.*?)\]/g, ' ') // Remove [brackets]
        .replace(/\{(.*?)\}/g, ' ') // Remove {braces}
        .replace(/【(.*?)】/g, ' ') // Remove Chinese brackets
        .replace(/\(((?!\d{4}\)).*?)\)/g, ' ') // Remove (parentheses) except (year)
        .replace(/（(?!\d{4}）).*?）/g, ' ') // Remove Chinese parentheses except (year)

    // 清理多余分隔符和空格
    cleanName = cleanName
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    // 尝试提取年份
    let year: number | null = null
    let title = cleanName

    // Pattern 1: (YYYY) 括号中的年份
    const parenYearMatch = cleanName.match(/^(.+?)\s*[（(](\d{4})[）)]\s*$/)
    if (parenYearMatch) {
        title = parenYearMatch[1].trim()
        year = parseInt(parenYearMatch[2])
    } else {
        // Pattern 2: 空格或分隔符后的年份
        const yearMatch = cleanName.match(/^(.+?)\s+(19\d{2}|20\d{2})(?:\s|$)/)
        if (yearMatch) {
            title = yearMatch[1].trim()
            year = parseInt(yearMatch[2])
        }
    }

    // 最终清理
    title = title
        .replace(/\s+/g, ' ')
        .trim()

    // 如果标题为空，使用原始名称（去掉扩展名）
    if (!title) {
        title = name.replace(/\.[^/.]+$/, '').replace(/[._-]+/g, ' ').trim()
    }

    return { title, year }
}

/**
 * Split a mixed Chinese/English title into separate search terms
 * e.g., "里约大冒险 Rio" -> ["里约大冒险", "Rio"]
 */
export function splitMixedTitle(title: string): string[] {
    const results: string[] = [title]

    // Try to split Chinese and English parts
    const chineseMatch = title.match(/^([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9]+)\s+([A-Za-z].*)$/)
    if (chineseMatch) {
        results.push(chineseMatch[1].trim()) // Chinese part
        results.push(chineseMatch[2].trim()) // English part
    }

    // Also try English first then Chinese
    const englishFirstMatch = title.match(/^([A-Za-z][A-Za-z0-9\s]+?)\s+([\u4e00-\u9fa5].*)$/)
    if (englishFirstMatch) {
        results.push(englishFirstMatch[1].trim()) // English part
        results.push(englishFirstMatch[2].trim()) // Chinese part
    }

    // Remove duplicates and empty strings
    return [...new Set(results.filter(s => s.length > 0))]
}

/**
 * Check if a file is a video file
 */
export function isVideoFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return MEDIA_EXTENSIONS.has(ext)
}

/**
 * Check if a file should be skipped
 */
export function shouldSkipFile(filePath: string): boolean {
    const fileName = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase()

    // Skip hidden files (macOS .DS_Store, ._xxx Apple Double files, etc.)
    if (fileName.startsWith('.') || fileName.startsWith('._')) {
        return true
    }

    return SKIP_EXTENSIONS.has(ext)
}

/**
 * Read STRM file content (typically contains a URL)
 */
export function readStrmContent(filePath: string): string | undefined {
    try {
        const content = fs.readFileSync(filePath, 'utf-8').trim()
        return content || undefined
    } catch {
        return undefined
    }
}

/**
 * Scan a single folder for media files
 */
function scanFolder(folderPath: string, results: ScannedMediaFile[]): void {
    try {
        if (!fs.existsSync(folderPath)) {
            console.warn(`[Scanner] Folder does not exist: ${folderPath}`)
            return
        }

        const stats = fs.statSync(folderPath)
        if (!stats.isDirectory()) {
            console.warn(`[Scanner] Not a directory: ${folderPath}`)
            return
        }

        const entries = fs.readdirSync(folderPath, { withFileTypes: true })

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name)

            if (entry.isDirectory()) {
                // Recursively scan subdirectories
                scanFolder(fullPath, results)
            } else if (entry.isFile()) {
                if (shouldSkipFile(entry.name)) {
                    continue
                }

                if (isVideoFile(entry.name)) {
                    const folderName = path.basename(folderPath)
                    const parentFolderPath = path.dirname(folderPath)
                    const parentFolderName = path.basename(parentFolderPath)
                    const isStrm = path.extname(entry.name).toLowerCase() === '.strm'

                    // Try multiple sources for title: file name -> folder name -> parent folder
                    let parsed = parseFileName(entry.name)

                    // Check if parsed title looks valid (has Chinese chars or meaningful English)
                    const hasChinese = /[\u4e00-\u9fa5]/.test(parsed.title)
                    const hasOnlyTechInfo = /^[\d\s.+@\-A-Z]+$/i.test(parsed.title) ||
                        parsed.title.length < 2 ||
                        /^(19|20)\d{2}/.test(parsed.title)  // Starts with year

                    // If file name doesn't have a valid title, try folder name
                    if (!hasChinese && hasOnlyTechInfo) {
                        const folderParsed = parseFileName(folderName)
                        if (/[\u4e00-\u9fa5]/.test(folderParsed.title) || folderParsed.title.length > parsed.title.length) {
                            parsed = folderParsed
                        }
                    }

                    // Still no good title? Try parent folder (grandparent of file)
                    const stillInvalid = !(/[\u4e00-\u9fa5]/.test(parsed.title)) &&
                        (/^[\d\s.+@\-A-Z]+$/i.test(parsed.title) || parsed.title.length < 3)
                    if (stillInvalid && parentFolderName && parentFolderName !== '电影' && parentFolderName !== '剧集') {
                        const parentParsed = parseFileName(parentFolderName)
                        if (/[\u4e00-\u9fa5]/.test(parentParsed.title)) {
                            parsed = parentParsed
                        }
                    }

                    const mediaFile: ScannedMediaFile = {
                        filePath: fullPath,
                        fileName: entry.name,
                        folderName,
                        parsedTitle: parsed.title,
                        parsedYear: parsed.year,
                        isStrm,
                    }

                    // Read STRM content if applicable
                    if (isStrm) {
                        mediaFile.strmContent = readStrmContent(fullPath)
                    }

                    results.push(mediaFile)
                }
            }
        }
    } catch (error) {
        console.error(`[Scanner] Error scanning folder ${folderPath}:`, error)
    }
}

/**
 * Scan multiple folders for media files
 */
export function scanFolders(folderPaths: string[]): ScannedMediaFile[] {
    const results: ScannedMediaFile[] = []

    for (const folderPath of folderPaths) {
        const normalizedPath = path.normalize(folderPath.trim())
        console.log(`[Scanner] Scanning: ${normalizedPath}`)
        scanFolder(normalizedPath, results)
    }

    console.log(`[Scanner] Found ${results.length} media files`)
    return results
}

/**
 * Deduplicate results by title (keep first occurrence or prefer non-STRM)
 */
export function deduplicateByTitle(files: ScannedMediaFile[]): ScannedMediaFile[] {
    const seen = new Map<string, ScannedMediaFile>()

    for (const file of files) {
        const key = `${file.parsedTitle.toLowerCase()}-${file.parsedYear || 'unknown'}`

        if (!seen.has(key)) {
            seen.set(key, file)
        } else {
            // Prefer non-STRM over STRM
            const existing = seen.get(key)!
            if (existing.isStrm && !file.isStrm) {
                seen.set(key, file)
            }
        }
    }

    return Array.from(seen.values())
}
