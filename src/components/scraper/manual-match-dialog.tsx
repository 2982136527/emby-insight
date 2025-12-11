'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Film, Tv, Check } from 'lucide-react'
import Image from 'next/image'

interface SearchResult {
    id: number
    title: string
    titleCn: string | null
    originalTitle: string | null
    posterPath: string | null
    releaseDate: string | null
    overview: string | null
    voteAverage: number | null
    mediaType: 'movie' | 'tv'
    source?: 'cache' | 'api'
}

interface ManualMatchDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    itemName: string
    itemType: 'Movie' | 'Series'
    filePath?: string
    onSelect: (result: SearchResult) => void
}

export function ManualMatchDialog({
    open,
    onOpenChange,
    itemName,
    itemType,
    filePath,
    onSelect,
}: ManualMatchDialogProps) {
    // Extract clean title from file path
    const extractTitleFromPath = (path: string | undefined, mediaType: string): string => {
        if (!path) return itemName

        // Split path and get folder names
        const parts = path.split('/')
        const fileName = parts[parts.length - 1]
        const parentFolder = parts[parts.length - 2] || ''
        const grandparentFolder = parts[parts.length - 3] || ''


        // Helper to clean a folder/file name
        const cleanName = (name: string): string => {
            console.log('[CleanName] Input:', name)

            let clean = name
                // Remove video file extensions only (not .28GB which is file size)
                .replace(/\.(mkv|mp4|avi|strm|ts|m2ts|mov|wmv|flv|webm|m4v)$/gi, '')

            console.log('[CleanName] After ext cleanup:', clean)

            clean = clean
                // Remove common patterns
                .replace(/\b(2160p|1080p|720p|480p|4K|UHD)\b/gi, '')
                .replace(/4K\s*[xhHX]?\.?26[45]/gi, '')
                .replace(/\b(x264|x265|H\.?264|H\.?265|HEVC|AVC|10bit|8bit)\b/gi, '')
                .replace(/\b(AAC|DTS|DTS-HD|TrueHD|Atmos|DD5?\.?1|FLAC|AC3|DDP5?\.?1)\b/gi, '')
                .replace(/\b(BluRay|Blu-Ray|BDRip|REMUX|WEBRip|WEB-DL|WEBDL|WEB|HDTV)\b/gi, '')
                .replace(/\b(HDR|HDR10|DV|DoVi|Dolby\.?Vision|SDR|HQ)\b/gi, '')
                .replace(/-[A-Za-z0-9@]+$/g, '')  // Remove -GroupName
                .replace(/\b(HiveWeb|HiVe|iTunes|NF|AMZN|ATVP|DSNP)\b/gi, '')

            console.log('[CleanName] After tech/group cleanup:', clean)

            clean = clean
                // File sizes - more comprehensive patterns
                .replace(/\d+\.?\d*\s*[GTM]B/gi, '')  // 18.28GB, 666GB
                .replace(/\(\s*\d+\.?\d*\s*[GTM]B\s*\)/gi, '')  // (18.28 GB)
                .replace(/\b\d{1,3}(?:\.\d+)?(?=\s|$)/g, '')  // Orphaned numbers like "18" at word boundary

            console.log('[CleanName] After size cleanup:', clean)

            clean = clean
                .replace(/⭐.*?豆瓣.*?\d+\.?\d*/g, '')  // Douban ratings
                .replace(/豆瓣.*?\d+\.?\d*/g, '')
                .replace(/⭐+/g, '')
                .replace(/\[.*?\]/g, '')  // [brackets]
                .replace(/（.*?）/g, ' ')  // Chinese parentheses (except year)
                .replace(/蓝光原盘/g, '')
                .replace(/蓝光/g, '')
                .replace(/杜比全景声/g, '')
                .replace(/内封.*?字幕?/g, '')
                .replace(/简日双字/g, '')
                .replace(/特效字幕/g, '')
                .replace(/国粤双语/g, '')

            console.log('[CleanName] After tags cleanup:', clean)

            clean = clean
                // Clean up symbols
                .replace(/[&＆]+/g, ' ')  // Ampersand
                .replace(/[._-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                // Remove trailing loose numbers and symbols
                .replace(/[\s&＆]+\d*$/, '')
                .trim()

            console.log('[CleanName] After symbol/whitespace cleanup:', clean)

            // Extract year if present (format: Title (YYYY) or Title YYYY)
            const yearMatch = clean.match(/^(.+?)\s*[(（](19\d{2}|20\d{2})[)）]\s*.*$/)
            if (yearMatch && yearMatch[1].trim().length > 1) {
                console.log('[CleanName] Matched year format 1:', yearMatch[1].trim())
                return yearMatch[1].trim()  // Return title WITHOUT year for cleaner search
            }

            // Also try: Title YYYY at end
            const yearMatch2 = clean.match(/^(.+?)\s+(19\d{2}|20\d{2})\s*$/)
            if (yearMatch2 && yearMatch2[1].trim().length > 1) {
                console.log('[CleanName] Matched year format 2:', yearMatch2[1].trim())
                return yearMatch2[1].trim()
            }

            return clean
        }

        // Check if parent folder is a season folder (Season XX, S01, 第X季 etc.)
        const isSeasonFolder = /^(Season|S)\s*\d+|第.+季$/i.test(parentFolder)

        // For TV series in season folder, use grandparent (show name)
        if (mediaType === 'Series' && isSeasonFolder) {
            const showName = cleanName(grandparentFolder)
            if (showName.length > 2) return showName
            if (showName.length > 1) return showName
        }

        // Check if grandparent has a movie title format (with year)
        // e.g., "猩球崛起：新世界 (2024)" - this is the correct title
        const grandparentHasYear = /[(（](19|20)\d{2}[)）]/.test(grandparentFolder)
        const grandparentClean = cleanName(grandparentFolder)


        // Generic folder names to ignore as titles
        const genericNames = /^(电影|剧集|Movies|TV|Series|Shows|Anime|动漫|Downloads|189share|strm|4K|1080p|合集|Collections?)$/i

        // Clean parent folder
        const parentClean = cleanName(parentFolder)

        // Check if parent has a strong signal (Year)
        // e.g. "魔女宅急便 (1989) ... (28GB)" -> Cleaned: "魔女宅急便" -> Valid
        const parentHasYear = /[(（](19|20)\d{2}[)）]/.test(parentFolder) || /[(（](19|20)\d{2}[)）]/.test(parentClean)

        // If parent has year and is valid Chinese, use it! (Priority 1)
        if (parentHasYear && parentClean.length > 1 && /[\u4e00-\u9fa5]/.test(parentClean)) {
            return parentClean
        }

        // Only look at grandparent if parent is NOT good enough
        // Check grandparent for year signal
        if (
            (grandparentHasYear) &&
            grandparentClean.length > 1 &&
            /[\u4e00-\u9fa5]/.test(grandparentClean) &&
            !genericNames.test(grandparentClean) &&
            !/合集|Collection/i.test(grandparentClean) // Explicitly avoid collections as titles
        ) {
            return grandparentClean
        }

        // Try parent folder again (even if no year, but has Chinese)
        if (parentClean.length > 1 && /[\u4e00-\u9fa5]/.test(parentClean)) {
            return parentClean
        }

        // Try grandparent folder as fallback
        if (
            grandparentClean.length > 1 &&
            /[\u4e00-\u9fa5]/.test(grandparentClean) &&
            !genericNames.test(grandparentClean) &&
            !/合集|Collection/i.test(grandparentFolder)
        ) {
            return grandparentClean
        }

        // Fallback to parent or original itemName
        return parentClean.length > 1 ? parentClean : itemName
    }

    // Compute clean title from file path
    const computedTitle = useMemo(() => {
        const title = extractTitleFromPath(filePath, itemType)
        return title
    }, [filePath, itemType, itemName])

    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)

    // Reset state when item changes - use computedTitle
    useEffect(() => {
        console.log('[ManualMatch] Setting query to:', computedTitle)
        setQuery(computedTitle)
        setResults([])
        setHasSearched(false)
    }, [computedTitle])

    const handleSearch = async () => {
        if (!query.trim()) return

        setIsSearching(true)
        try {
            const res = await fetch('/api/scraper/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query.trim(),
                    type: itemType === 'Movie' ? 'movie' : 'tv',
                }),
            })
            const data = await res.json()
            setResults(data.results || [])
            setHasSearched(true)
        } catch (error) {
            console.error('Search failed:', error)
            setResults([])
        } finally {
            setIsSearching(false)
        }
    }

    const handleSelect = (result: SearchResult) => {
        onSelect(result)
        onOpenChange(false)
    }

    // Auto-search when dialog opens
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen && !hasSearched) {
            setQuery(itemName)
            setTimeout(() => handleSearch(), 100)
        }
        if (!isOpen) {
            setResults([])
            setHasSearched(false)
        }
        onOpenChange(isOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>手动匹配</DialogTitle>
                    <DialogDescription>
                        搜索并选择正确的匹配项
                    </DialogDescription>
                </DialogHeader>

                {/* File Path Display */}
                {filePath && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md break-all">
                        <span className="font-medium">文件路径: </span>{filePath}
                    </div>
                )}

                {/* Search Input */}
                <div className="flex gap-2">
                    <Input
                        placeholder="输入搜索关键词..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Search className="h-4 w-4" />
                        )}
                    </Button>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto space-y-2 mt-4">
                    {isSearching ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : results.length === 0 && hasSearched ? (
                        <div className="text-center py-8 text-muted-foreground">
                            未找到匹配项，请尝试其他关键词
                        </div>
                    ) : (
                        results.map((result) => (
                            <div
                                key={`${result.mediaType}-${result.id}`}
                                className="flex gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                                onClick={() => handleSelect(result)}
                            >
                                {/* Poster */}
                                <div className="flex-shrink-0 w-16 h-24 bg-muted rounded overflow-hidden">
                                    {result.posterPath ? (
                                        <Image
                                            src={`https://image.tmdb.org/t/p/w154${result.posterPath}`}
                                            alt={result.title}
                                            width={64}
                                            height={96}
                                            className="object-cover w-full h-full"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            {result.mediaType === 'movie' ? (
                                                <Film className="h-6 w-6 text-muted-foreground" />
                                            ) : (
                                                <Tv className="h-6 w-6 text-muted-foreground" />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium truncate">
                                            {result.titleCn || result.title}
                                        </span>
                                        {result.releaseDate && (
                                            <Badge variant="outline" className="text-xs">
                                                {result.releaseDate.slice(0, 4)}
                                            </Badge>
                                        )}
                                        <Badge variant="secondary" className="text-xs">
                                            {result.mediaType === 'movie' ? '电影' : '剧集'}
                                        </Badge>
                                        {result.source && (
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${result.source === 'api' ? 'border-blue-500 text-blue-500' : ''}`}
                                            >
                                                {result.source === 'cache' ? '缓存' : '在线'}
                                            </Badge>
                                        )}
                                    </div>
                                    {result.titleCn && result.title !== result.titleCn && (
                                        <div className="text-sm text-muted-foreground truncate">
                                            {result.title}
                                        </div>
                                    )}
                                    {result.voteAverage && (
                                        <div className="text-sm text-yellow-500">
                                            ★ {result.voteAverage.toFixed(1)}
                                        </div>
                                    )}
                                    {result.overview && (
                                        <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                            {result.overview}
                                        </div>
                                    )}
                                </div>

                                {/* Select Button */}
                                <div className="flex-shrink-0 self-center">
                                    <Button size="sm" variant="ghost">
                                        <Check className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
