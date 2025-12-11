'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import { Loader2, Play, Square, RefreshCw, CheckCircle, XCircle, AlertCircle, Film, Tv, Plus, X, Folder, FileVideo, FolderInput, Undo2, Trash2, Search } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { ManualMatchDialog } from '@/components/scraper/manual-match-dialog'

interface FolderEntry {
    path: string
    type: 'Movie' | 'Series'
}

interface ScrapedItem {
    embyItemId: string
    embyItemName: string
    embyItemType: 'Movie' | 'Series'
    filePath?: string
    isStrm?: boolean
    matchResult: {
        matched: boolean
        tmdbId?: number
        confidence: number
        matchType?: string
        candidates: Array<{
            id: number
            title: string
            titleCn: string | null
            releaseDate: string | null
            similarity: number
        }>
    }
    metadata?: {
        tmdbId: number
        title: string
        titleCn: string | null
        posterPath: string | null
        voteAverage: number | null
        releaseDate: string | null
    }
    source: 'cache' | 'api' | 'none'
    debugInfo?: {
        parsedTitle: string
        parsedYear: number | null
        searchedType: 'movie' | 'tv'
        cacheResultCount: number
        reason: string
    }
}

interface ScrapeProgress {
    total: number
    processed: number
    matched: number
    unmatched: number
    status: 'idle' | 'running' | 'completed' | 'cancelled'
    currentItem?: string
}

export default function ScraperPage() {
    const queryClient = useQueryClient()
    const [folders, setFolders] = useState<FolderEntry[]>([{ path: '', type: 'Movie' }])
    const [filter, setFilter] = useState<string>('all')
    const [categoryTab, setCategoryTab] = useState<'Movie' | 'Series'>('Movie')
    const [isLoaded, setIsLoaded] = useState(false)
    const [manualMatchOpen, setManualMatchOpen] = useState(false)
    const [manualMatchItem, setManualMatchItem] = useState<ScrapedItem | null>(null)

    // Load folders from API on mount
    useEffect(() => {
        fetch('/api/scraper/folders')
            .then(res => res.json())
            .then(data => {
                if (data.folders && data.folders.length > 0) {
                    setFolders(data.folders)
                }
                setIsLoaded(true)
            })
            .catch(() => setIsLoaded(true))
    }, [])

    // Debounced save function using a ref to avoid re-creating
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const saveFolders = useCallback((foldersToSave: FolderEntry[]) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = setTimeout(() => {
            const validFolders = foldersToSave.filter(f => f.path.trim().length > 0)
            if (validFolders.length > 0) {
                fetch('/api/scraper/folders', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folders: validFolders }),
                }).catch(console.error)
            }
        }, 1000)
    }, [])

    // Auto-save folders when they change (after initial load)
    useEffect(() => {
        if (isLoaded) {
            saveFolders(folders)
        }
    }, [folders, isLoaded, saveFolders])

    // Add a new folder entry
    const addFolder = () => {
        setFolders([...folders, { path: '', type: 'Movie' }])
    }

    // Remove a folder entry
    const removeFolder = (index: number) => {
        if (folders.length > 1) {
            setFolders(folders.filter((_, i) => i !== index))
        }
    }

    // Update folder path
    const updateFolderPath = (index: number, path: string) => {
        const newFolders = [...folders]
        newFolders[index].path = path
        setFolders(newFolders)
    }

    // Update folder type
    const updateFolderType = (index: number, type: 'Movie' | 'Series') => {
        const newFolders = [...folders]
        newFolders[index].type = type
        setFolders(newFolders)
    }

    // Get valid folders
    const validFolders = folders.filter(f => f.path.trim().length > 0)

    // Fetch scrape status
    const { data: scrapeData, refetch } = useQuery({
        queryKey: ['scraper', filter],
        queryFn: async () => {
            const res = await fetch(`/api/scraper?results=true&filter=${filter}`)
            if (!res.ok) throw new Error('Failed to fetch scraper status')
            return res.json() as Promise<{
                progress: ScrapeProgress
                results?: ScrapedItem[]
                resultCount: { total: number; matched: number; unmatched: number }
            }>
        },
        refetchInterval: (query) => {
            return query.state.data?.progress.status === 'running' ? 1000 : false
        },
    })

    // Fetch persisted records from database
    const { data: recordsData, refetch: refetchRecords } = useQuery({
        queryKey: ['scraper-records', categoryTab, filter],
        queryFn: async () => {
            const params = new URLSearchParams()
            params.set('type', categoryTab)
            if (filter === 'matched') params.set('matched', 'true')
            else if (filter === 'unmatched') params.set('matched', 'false')

            const res = await fetch(`/api/scraper/records?${params}`)
            if (!res.ok) throw new Error('Failed to fetch records')
            return res.json()
        },
    })

    // Track previous status to detect when scraping completes
    const prevStatusRef = useRef<string | undefined>(undefined)
    useEffect(() => {
        const currentStatus = scrapeData?.progress?.status
        if (prevStatusRef.current === 'running' && currentStatus === 'completed') {
            // Scraping just finished - refresh records from database
            setTimeout(() => refetchRecords(), 1000) // Give backend time to save
        }
        prevStatusRef.current = currentStatus
    }, [scrapeData?.progress?.status, refetchRecords])

    // Start scrape mutation
    const startScrape = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/scraper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folders: validFolders,
                    deduplicate: true,
                }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to start scraping')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scraper'] })
        },
    })

    // Cancel scrape mutation
    const cancelScrape = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/scraper', { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to cancel')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scraper'] })
        },
    })

    // Organize files mutation
    const organizeFiles = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/scraper/organize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folders: validFolders.map(f => f.path),
                }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to organize')
            }
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(`整理完成！移动了 ${data.organized} 个文件`)
            if (data.errors.length > 0) {
                toast.warning(`${data.errors.length} 个错误`)
            }
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    // Flatten/Undo files mutation
    const flattenFiles = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/scraper/flatten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folders: validFolders.map(f => f.path),
                }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to flatten')
            }
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(`撤销完成！恢复了 ${data.flattened} 个文件`)
            if (data.errors.length > 0) {
                toast.warning(`${data.errors.length} 个错误`)
            }
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    // Cleanup empty folders mutation
    const cleanupFolders = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/scraper/cleanup', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folders: validFolders.map(f => f.path),
                }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to cleanup')
            }
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(`清理完成！删除了 ${data.removed} 个空文件夹`)
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    const progress = scrapeData?.progress
    const results = scrapeData?.results || []
    const resultCount = scrapeData?.resultCount

    const isRunning = progress?.status === 'running'
    const progressPercent = progress && progress.total > 0 ? (progress.processed / progress.total) * 100 : 0

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">媒体刮削</h1>
                    <p className="text-muted-foreground">
                        扫描本地文件夹，从 TMDB 缓存匹配媒体元数据
                    </p>
                </div>
                <Button onClick={() => refetch()} variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Folder className="h-5 w-5" />
                        刮削设置
                    </CardTitle>
                    <CardDescription>添加要扫描的文件夹，每个文件夹可以独立设置媒体类型</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Folder Inputs */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">文件夹列表</label>
                        {folders.map((folder, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <Input
                                    placeholder="/path/to/movies 或 /media/strm"
                                    value={folder.path}
                                    onChange={(e) => updateFolderPath(index, e.target.value)}
                                    disabled={isRunning}
                                    className="flex-1"
                                />
                                <Select
                                    value={folder.type}
                                    onValueChange={(v) => updateFolderType(index, v as 'Movie' | 'Series')}
                                    disabled={isRunning}
                                >
                                    <SelectTrigger className="w-[100px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Movie">
                                            <span className="flex items-center gap-1">
                                                <Film className="h-3 w-3" /> 电影
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="Series">
                                            <span className="flex items-center gap-1">
                                                <Tv className="h-3 w-3" /> 剧集
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {folders.length > 1 && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => removeFolder(index)}
                                        disabled={isRunning}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addFolder}
                            disabled={isRunning}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            添加文件夹
                        </Button>
                    </div>

                    {/* Per-folder action buttons removed, now part of each folder row */}
                </CardContent>
            </Card>

            {/* Individual Folder Control Cards */}
            {validFolders.map((folder, index) => (
                <Card key={`actions-${index}`}>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            {folder.type === 'Movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                            {folder.path.split('/').pop() || folder.path}
                        </CardTitle>
                        <CardDescription className="text-xs truncate">{folder.path}</CardDescription>
                    </CardHeader>
                    <CardContent className="py-2">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={organizeFiles.isPending || isRunning}
                                onClick={() => {
                                    // Override validFolders temporarily for this operation
                                    fetch('/api/scraper/organize', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ folders: [folder.path] }),
                                    }).then(res => res.json()).then(data => {
                                        toast.success(`整理完成！移动了 ${data.organized} 个文件`)
                                    }).catch(() => toast.error('整理失败'))
                                }}
                            >
                                <FolderInput className="h-3 w-3 mr-1" />
                                整理
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={flattenFiles.isPending || isRunning}
                                onClick={() => {
                                    fetch('/api/scraper/flatten', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ folders: [folder.path] }),
                                    }).then(res => res.json()).then(data => {
                                        toast.success(`撤销完成！恢复了 ${data.flattened} 个文件`)
                                    }).catch(() => toast.error('撤销失败'))
                                }}
                            >
                                <Undo2 className="h-3 w-3 mr-1" />
                                撤销
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={cleanupFolders.isPending || isRunning}
                                onClick={() => {
                                    fetch('/api/scraper/cleanup', {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ folders: [folder.path] }),
                                    }).then(res => res.json()).then(data => {
                                        toast.success(`清理完成！删除了 ${data.removed} 个空文件夹`)
                                    }).catch(() => toast.error('清理失败'))
                                }}
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                清理
                            </Button>
                            {isRunning ? (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => cancelScrape.mutate()}
                                    disabled={cancelScrape.isPending}
                                >
                                    <Square className="h-3 w-3 mr-1" />
                                    停止
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    disabled={startScrape.isPending}
                                    onClick={() => {
                                        fetch('/api/scraper', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ folders: [folder] }),
                                        }).then(res => res.json()).then(() => {
                                            queryClient.invalidateQueries({ queryKey: ['scraper'] })
                                        }).catch(() => toast.error('刮削失败'))
                                    }}
                                >
                                    <Play className="h-3 w-3 mr-1" />
                                    刮削
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Error Display */}
            {startScrape.isError && (
                <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
                    {startScrape.error.message}
                </div>
            )}

            {/* Progress */}
            {progress && progress.status !== 'idle' && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span>
                            {progress.status === 'running' && progress.currentItem
                                ? `正在处理: ${progress.currentItem}`
                                : progress.status === 'completed'
                                    ? '刮削完成'
                                    : progress.status === 'cancelled'
                                        ? '已取消'
                                        : '准备中...'}
                        </span>
                        <span>{progress.processed} / {progress.total}</span>
                    </div>
                    <Progress value={progressPercent} />
                    <div className="flex gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            匹配: {progress.matched}
                        </span>
                        <span className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-red-500" />
                            未匹配: {progress.unmatched}
                        </span>
                    </div>
                </div>
            )}

            {/* Results with Category Tabs */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>刮削记录</CardTitle>
                            <CardDescription>
                                {recordsData?.stats && (
                                    <>
                                        电影: {recordsData.stats.movieMatched}/{recordsData.stats.movieTotal} 已匹配 |
                                        剧集: {recordsData.stats.seriesMatched}/{recordsData.stats.seriesTotal} 已匹配
                                    </>
                                )}
                            </CardDescription>
                        </div>
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部</SelectItem>
                                <SelectItem value="matched">已匹配</SelectItem>
                                <SelectItem value="unmatched">未匹配</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={isRunning}
                            onClick={async () => {
                                if (!confirm('确定要清空所有未匹配的记录吗？清空后需要重新刮削。')) return
                                try {
                                    const res = await fetch('/api/scraper/records', { method: 'DELETE' })
                                    const data = await res.json()
                                    if (data.success) {
                                        toast.success(`已清空 ${data.deleted} 条未匹配记录`)
                                        refetchRecords()
                                    } else {
                                        toast.error(data.error || '清空失败')
                                    }
                                } catch {
                                    toast.error('清空失败')
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            清空未匹配
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={categoryTab} onValueChange={(v) => setCategoryTab(v as 'Movie' | 'Series')}>
                        <TabsList className="mb-4">
                            <TabsTrigger value="Movie" className="flex items-center gap-2">
                                <Film className="h-4 w-4" />
                                电影
                                {recordsData?.stats && (
                                    <Badge variant="secondary" className="ml-1">
                                        {recordsData.stats.movieTotal}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="Series" className="flex items-center gap-2">
                                <Tv className="h-4 w-4" />
                                剧集
                                {recordsData?.stats && (
                                    <Badge variant="secondary" className="ml-1">
                                        {recordsData.stats.seriesTotal}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value={categoryTab}>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[60px]">封面</TableHead>
                                        <TableHead>文件名称</TableHead>
                                        <TableHead className="w-[80px]">类型</TableHead>
                                        <TableHead className="w-[100px]">状态</TableHead>
                                        <TableHead className="w-[80px]">来源</TableHead>
                                        <TableHead>匹配结果</TableHead>
                                        <TableHead className="w-[80px]">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* Show live results during scraping */}
                                    {isRunning && scrapeData?.results && scrapeData.results.length > 0 ? (
                                        scrapeData.results
                                            .filter((item: ScrapedItem) => item.embyItemType === categoryTab)
                                            .map((item: ScrapedItem) => (
                                                <TableRow key={item.embyItemId}>
                                                    <TableCell>
                                                        {item.metadata?.posterPath ? (
                                                            <Image
                                                                src={`https://image.tmdb.org/t/p/w92${item.metadata.posterPath}`}
                                                                alt={item.embyItemName}
                                                                width={40}
                                                                height={60}
                                                                className="rounded object-cover"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-15 bg-muted rounded flex items-center justify-center">
                                                                {item.isStrm ? (
                                                                    <FileVideo className="h-4 w-4 text-muted-foreground" />
                                                                ) : item.embyItemType === 'Movie' ? (
                                                                    <Film className="h-4 w-4 text-muted-foreground" />
                                                                ) : (
                                                                    <Tv className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="max-w-[300px]">
                                                            <p className="font-medium truncate">{item.embyItemName}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{item.filePath}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {item.embyItemType === 'Movie' ? '电影' : '剧集'}
                                                        </Badge>
                                                        {item.isStrm && (
                                                            <Badge variant="secondary" className="ml-1 text-xs">STRM</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.matchResult.matched ? (
                                                            <Badge variant="default" className="bg-green-500 hover:bg-green-500">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                已匹配
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="destructive">
                                                                <XCircle className="h-3 w-3 mr-1" />
                                                                未匹配
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">
                                                            {item.source === 'cache' ? '缓存' : item.source === 'api' ? 'API' : '-'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.metadata ? (
                                                            <div className="text-sm">
                                                                <span className="font-medium">
                                                                    {item.metadata.titleCn || item.metadata.title}
                                                                </span>
                                                                {item.metadata.releaseDate && (
                                                                    <span className="text-muted-foreground ml-2">
                                                                        ({item.metadata.releaseDate.substring(0, 4)})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">无匹配</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {!item.metadata && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setManualMatchItem(item)
                                                                    setManualMatchOpen(true)
                                                                }}
                                                            >
                                                                <Search className="h-3 w-3 mr-1" />
                                                                匹配
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                    ) : recordsData?.records?.length > 0 ? (
                                        /* Show database records when idle */
                                        recordsData.records.map((record: any) => (
                                            <TableRow key={record.id}>
                                                <TableCell>
                                                    {record.posterPath ? (
                                                        <Image
                                                            src={`https://image.tmdb.org/t/p/w92${record.posterPath}`}
                                                            alt={record.fileName}
                                                            width={40}
                                                            height={60}
                                                            className="rounded object-cover"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-15 bg-muted rounded flex items-center justify-center">
                                                            {record.isStrm ? (
                                                                <FileVideo className="h-4 w-4 text-muted-foreground" />
                                                            ) : record.mediaType === 'Movie' ? (
                                                                <Film className="h-4 w-4 text-muted-foreground" />
                                                            ) : (
                                                                <Tv className="h-4 w-4 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="max-w-[300px]">
                                                        <p className="font-medium truncate">{record.fileName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{record.filePath}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {record.mediaType === 'Movie' ? '电影' : '剧集'}
                                                    </Badge>
                                                    {record.isStrm && (
                                                        <Badge variant="secondary" className="ml-1 text-xs">STRM</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {record.matched ? (
                                                        <Badge variant="default" className="bg-green-500 hover:bg-green-500">
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            已匹配
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="destructive">
                                                            <XCircle className="h-3 w-3 mr-1" />
                                                            未匹配
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {record.matchSource === 'cache' ? '缓存' : record.matchSource === 'api' ? 'API' : record.matchSource === 'manual' ? '手动' : '-'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {record.matched ? (
                                                        <div className="text-sm">
                                                            <span className="font-medium">
                                                                {record.titleCn || record.title}
                                                            </span>
                                                            {record.releaseDate && (
                                                                <span className="text-muted-foreground ml-2">
                                                                    ({record.releaseDate.substring(0, 4)})
                                                                </span>
                                                            )}
                                                            {record.voteAverage && (
                                                                <Badge variant="secondary" className="ml-2 bg-yellow-500/10 text-yellow-600">
                                                                    {record.voteAverage.toFixed(1)}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">无匹配</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {!record.matched && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setManualMatchItem({
                                                                    embyItemId: record.id,
                                                                    embyItemName: record.fileName,
                                                                    embyItemType: record.mediaType,
                                                                    filePath: record.filePath,
                                                                    isStrm: record.isStrm,
                                                                    matchResult: { matched: false, confidence: 0, candidates: [] },
                                                                    source: 'none',
                                                                } as unknown as ScrapedItem)
                                                                setManualMatchOpen(true)
                                                            }}
                                                        >
                                                            <Search className="h-3 w-3 mr-1" />
                                                            匹配
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                暂无记录，请先刮削文件夹
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Manual Match Dialog */}
            {manualMatchItem && (
                <ManualMatchDialog
                    open={manualMatchOpen}
                    onOpenChange={setManualMatchOpen}
                    itemName={(manualMatchItem as any).debugInfo?.parsedTitle || manualMatchItem.embyItemName}
                    itemType={manualMatchItem.embyItemType}
                    filePath={manualMatchItem.filePath}
                    onSelect={async (result) => {
                        // Save manual match to database
                        try {
                            const res = await fetch('/api/scraper/records', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    filePath: manualMatchItem.filePath,
                                    tmdbId: result.id,
                                    tmdbType: result.mediaType,
                                    title: result.title,
                                    titleCn: result.titleCn,
                                    posterPath: result.posterPath,
                                    releaseDate: result.releaseDate,
                                    voteAverage: result.voteAverage,
                                }),
                            })

                            if (res.ok) {
                                toast.success(`已匹配: ${result.titleCn || result.title}`)
                                // Immediately refetch to update UI
                                refetchRecords()
                            } else {
                                const error = await res.json()
                                toast.error(`匹配失败: ${error.error || '未知错误'}`)
                            }
                        } catch (error) {
                            console.error('Manual match failed:', error)
                            toast.error('匹配失败，请重试')
                        }
                    }}
                />
            )}
        </div>
    )
}

