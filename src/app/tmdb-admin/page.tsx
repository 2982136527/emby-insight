'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
    Database, RefreshCw, Trash2, Search, Settings, Activity,
    Play, Square, Loader2, Globe, Shield, Zap, BarChart3,
    Film, Tv, Users, Clock, CheckCircle, XCircle, Save,
    Star, Image as ImageIcon, ExternalLink, Copy, BookOpen,
} from 'lucide-react'

interface CacheStats {
    total: number
    expired: number
    active: number
    typeBreakdown: Record<string, number>
    isWarmerRunning: boolean
}

interface CacheEntry {
    id: number
    url: string
    createdAt: string
    updatedAt: string
    expiresAt: string
}

interface Config {
    hasApiKey: boolean
    apiKey: string
    language: string
    authKey: string
    proxyImages: boolean
    resolveTmdbDns: boolean
    httpProxy: string
    logRetentionDays: number
}

interface LogStats {
    total: number
    today: number
    hitRate: number
    topTitles: Array<{ title: string; count: number }>
}

interface DnsTestResult {
    dnsReachable: boolean
    dnsLatency: number
    resolveSuccess: boolean
    resolveLatency: number
    resolvedIp: string | null
    httpsSuccess: boolean
    httpsLatency: number
    error?: string
}

export default function TmdbAdminPage() {
    const [stats, setStats] = useState<CacheStats | null>(null)
    const [config, setConfig] = useState<Config | null>(null)
    const [logStats, setLogStats] = useState<LogStats | null>(null)
    const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([])
    const [cacheTotal, setCacheTotal] = useState(0)
    const [cachePage, setCachePage] = useState(1)
    const [cacheSearch, setCacheSearch] = useState('')
    const [cacheType, setCacheType] = useState('all')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [clearing, setClearing] = useState(false)
    const [dnsTesting, setDnsTesting] = useState(false)
    const [dnsResult, setDnsResult] = useState<DnsTestResult | null>(null)
    const [apiKey, setApiKey] = useState('')
    const [language, setLanguage] = useState('zh-CN')
    const [httpProxy, setHttpProxy] = useState('')
    const [authKey, setAuthKey] = useState('')
    const [resolveDns, setResolveDns] = useState(false)
    const [logRetention, setLogRetention] = useState(30)

    // Poster wall state
    const [posterItems, setPosterItems] = useState<any[]>([])
    const [posterSearch, setPosterSearch] = useState('')
    const [posterType, setPosterType] = useState('all')
    const [posterPage, setPosterPage] = useState(1)
    const [posterTotal, setPosterTotal] = useState(0)
    const [posterTotalPages, setPosterTotalPages] = useState(0)
    const [posterLoading, setPosterLoading] = useState(false)
    const [selectedPoster, setSelectedPoster] = useState<any>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailData, setDetailData] = useState<any>(null)

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/tmdb-proxy/admin/stats')
            if (res.ok) setStats(await res.json())
        } catch { /* ignore */ }
    }, [])

    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/tmdb-proxy/admin/config')
            if (res.ok) {
                const data = await res.json()
                setConfig(data)
                setLanguage(data.language || 'zh-CN')
                setHttpProxy(data.httpProxy || '')
                setAuthKey(data.authKey || '')
                setResolveDns(data.resolveTmdbDns || false)
                setLogRetention(data.logRetentionDays ?? 30)
            }
        } catch { /* ignore */ }
    }, [])

    const fetchLogStats = useCallback(async () => {
        try {
            const res = await fetch('/api/tmdb-proxy/admin/logs/stats')
            if (res.ok) setLogStats(await res.json())
        } catch { /* ignore */ }
    }, [])

    const fetchCacheEntries = useCallback(async () => {
        try {
            const params = new URLSearchParams({ page: String(cachePage), limit: '20' })
            if (cacheSearch) params.set('search', cacheSearch)
            if (cacheType !== 'all') params.set('type', cacheType)
            const res = await fetch(`/api/tmdb-proxy/admin/cache?${params}`)
            if (res.ok) {
                const data = await res.json()
                setCacheEntries(data.items || [])
                setCacheTotal(data.total || 0)
            }
        } catch { /* ignore */ }
    }, [cachePage, cacheSearch, cacheType])

    useEffect(() => {
        setLoading(true)
        Promise.all([fetchStats(), fetchConfig(), fetchLogStats()]).finally(() => setLoading(false))
    }, [fetchStats, fetchConfig, fetchLogStats])

    useEffect(() => { fetchCacheEntries() }, [fetchCacheEntries])

    // Auto-refresh stats every 30s
    useEffect(() => {
        const timer = setInterval(() => {
            fetchStats()
            fetchLogStats()
        }, 30000)
        return () => clearInterval(timer)
    }, [fetchStats, fetchLogStats])

    const handleSaveConfig = async () => {
        setSaving(true)
        try {
            const body: any = {
                tmdb: { language, httpProxy, authKey, resolveTmdbDns: resolveDns },
                logRetentionDays: logRetention,
            }
            if (apiKey) body.tmdb.apiKey = apiKey
            const res = await fetch('/api/tmdb-proxy/admin/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (res.ok) {
                toast.success('配置已保存')
                setApiKey('')
                fetchConfig()
            } else toast.error('保存失败')
        } catch { toast.error('保存失败') }
        finally { setSaving(false) }
    }

    const handleClearCache = async () => {
        if (!confirm('确定要清除所有 TMDB 缓存吗？')) return
        setClearing(true)
        try {
            const res = await fetch('/api/tmdb-proxy/admin/cache/clear', { method: 'POST' })
            if (res.ok) {
                toast.success('缓存已清除')
                fetchStats()
                fetchCacheEntries()
            }
        } catch { toast.error('清除失败') }
        finally { setClearing(false) }
    }

    const handleDeleteEntry = async (id: number) => {
        try {
            await fetch(`/api/tmdb-proxy/admin/cache/${id}`, { method: 'DELETE' })
            fetchStats()
            fetchCacheEntries()
        } catch { /* ignore */ }
    }

    const handleWarmer = async (action: 'start' | 'stop') => {
        try {
            const res = await fetch(`/api/tmdb-proxy/admin/warmer/${action}`, { method: 'POST' })
            if (res.ok) {
                toast.success(action === 'start' ? 'Warmer 已启动' : 'Warmer 已停止')
                fetchStats()
            }
        } catch { toast.error('操作失败') }
    }

    const handleDnsTest = async () => {
        setDnsTesting(true)
        setDnsResult(null)
        try {
            const res = await fetch('/api/tmdb-proxy/admin/dns/test')
            if (res.ok) setDnsResult(await res.json())
        } catch { toast.error('DNS 测试失败') }
        finally { setDnsTesting(false) }
    }

    const handleClearLogs = async () => {
        if (!confirm('确定要清除所有日志吗？')) return
        try {
            await fetch('/api/tmdb-proxy/admin/logs/clear', { method: 'POST' })
            toast.success('日志已清除')
            fetchLogStats()
        } catch { toast.error('清除失败') }
    }

    const fetchPosters = useCallback(async () => {
        setPosterLoading(true)
        try {
            const params = new URLSearchParams({ page: String(posterPage), limit: '24', type: posterType })
            if (posterSearch) params.set('search', posterSearch)
            const res = await fetch(`/api/tmdb-proxy/admin/posters?${params}`)
            if (res.ok) {
                const data = await res.json()
                setPosterItems(data.items || [])
                setPosterTotal(data.total || 0)
                setPosterTotalPages(data.totalPages || 0)
            }
        } catch { /* ignore */ }
        finally { setPosterLoading(false) }
    }, [posterPage, posterSearch, posterType])

    const fetchDetail = async (tmdbId: number) => {
        setDetailLoading(true)
        setDetailData(null)
        try {
            const res = await fetch(`/api/tmdb-proxy/admin/posters/detail/${tmdbId}`)
            if (res.ok) setDetailData(await res.json())
        } catch { /* ignore */ }
        finally { setDetailLoading(false) }
    }

    useEffect(() => { fetchPosters() }, [fetchPosters])

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'movie': return <Film className="h-3 w-3" />
            case 'tv': return <Tv className="h-3 w-3" />
            case 'person': return <Users className="h-3 w-3" />
            default: return <Database className="h-3 w-3" />
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'movie': return 'bg-blue-500/10 text-blue-500'
            case 'tv': return 'bg-purple-500/10 text-purple-500'
            case 'person': return 'bg-amber-500/10 text-amber-500'
            case 'list': return 'bg-emerald-500/10 text-emerald-500'
            default: return 'bg-gray-500/10 text-gray-500'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">TMDB 缓存管理</h1>
                    <p className="text-muted-foreground text-sm">代理缓存、预热控制、配置管理</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={stats?.isWarmerRunning ? 'default' : 'secondary'}>
                        {stats?.isWarmerRunning ? 'Warmer 运行中' : 'Warmer 已停止'}
                    </Badge>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">概览</TabsTrigger>
                    <TabsTrigger value="posters">缓存预览</TabsTrigger>
                    <TabsTrigger value="cache">缓存管理</TabsTrigger>
                    <TabsTrigger value="config">配置</TabsTrigger>
                    <TabsTrigger value="logs">日志</TabsTrigger>
                    <TabsTrigger value="docs">API 文档</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">总缓存</span>
                                </div>
                                <div className="text-2xl font-bold mt-1">{stats?.total ?? 0}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    <span className="text-sm text-muted-foreground">有效</span>
                                </div>
                                <div className="text-2xl font-bold mt-1">{stats?.active ?? 0}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2">
                                    <XCircle className="h-4 w-4 text-amber-500" />
                                    <span className="text-sm text-muted-foreground">已过期</span>
                                </div>
                                <div className="text-2xl font-bold mt-1">{stats?.expired ?? 0}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">今日调用</span>
                                </div>
                                <div className="text-2xl font-bold mt-1">{logStats?.today ?? 0}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Type Breakdown */}
                    {stats?.typeBreakdown && Object.keys(stats.typeBreakdown).length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">缓存分布</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-3">
                                    {Object.entries(stats.typeBreakdown).map(([type, count]) => (
                                        <div key={type} className="flex items-center gap-2">
                                            <Badge variant="outline" className={getTypeColor(type)}>
                                                {getTypeIcon(type)}
                                                <span className="ml-1 capitalize">{type}</span>
                                            </Badge>
                                            <span className="text-sm font-medium">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Warmer Control */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Zap className="h-4 w-4" /> Cache Warmer
                            </CardTitle>
                            <CardDescription>三引擎缓存预热：热门/历史/变更</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                {stats?.isWarmerRunning ? (
                                    <Button variant="destructive" size="sm" onClick={() => handleWarmer('stop')}>
                                        <Square className="h-4 w-4 mr-1" /> 停止
                                    </Button>
                                ) : (
                                    <Button size="sm" onClick={() => handleWarmer('start')}>
                                        <Play className="h-4 w-4 mr-1" /> 启动
                                    </Button>
                                )}
                                <span className="text-sm text-muted-foreground">
                                    {stats?.isWarmerRunning
                                        ? '正在自动预热 TMDB 缓存...'
                                        : '点击启动自动缓存预热'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top Titles */}
                    {logStats?.topTitles && logStats.topTitles.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">热门查询</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {logStats.topTitles.map((t, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <span className="truncate flex-1">{t.title}</span>
                                            <Badge variant="secondary" className="ml-2">{t.count}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Poster Wall Tab */}
                <TabsContent value="posters" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5">
                                <div className="relative flex-1 min-w-[140px] max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="搜索标题..."
                                        className="pl-9"
                                        value={posterSearch}
                                        onChange={(e) => { setPosterSearch(e.target.value); setPosterPage(1) }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') fetchPosters() }}
                                    />
                                </div>
                                <select
                                    className="border rounded-md px-3 py-2 text-sm bg-background"
                                    value={posterType}
                                    onChange={(e) => { setPosterType(e.target.value); setPosterPage(1) }}
                                >
                                    <option value="all">全部</option>
                                    <option value="movie">电影</option>
                                    <option value="tv">电视剧</option>
                                </select>
                                <Button variant="outline" size="sm" onClick={() => fetchPosters()}>
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>

                            {posterLoading && posterItems.length === 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                    {Array(24).fill(0).map((_, i) => (
                                        <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
                                    ))}
                                </div>
                            ) : posterItems.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground">
                                    <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p>暂无海报数据</p>
                                    <p className="text-sm mt-1">请先同步 TMDB 数据或启动 Cache Warmer</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                        {posterItems.map((item: any) => (
                                            <div
                                                key={`${item.type}-${item.tmdbId}`}
                                                className="group relative rounded-xl overflow-hidden border border-border/50 cursor-pointer hover:border-pink-500/50 hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
                                                onClick={() => {
                                                    setSelectedPoster(item)
                                                    fetchDetail(item.tmdbId)
                                                }}
                                            >
                                                {item.posterPath ? (
                                                    <img
                                                        src={item.posterPath}
                                                        alt={item.title}
                                                        className="w-full aspect-[2/3] object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="w-full aspect-[2/3] flex items-center justify-center bg-muted">
                                                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                                <Badge
                                                    className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0 backdrop-blur-sm ${
                                                        item.type === 'tv' ? 'bg-blue-600/80' : 'bg-pink-600/80'
                                                    }`}
                                                >
                                                    {item.type === 'tv' ? '剧集' : '电影'}
                                                </Badge>
                                                {item.voteAverage > 0 && (
                                                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] text-yellow-400 font-semibold">
                                                        ★ {item.voteAverage.toFixed(1)}
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                                    <div className="text-xs font-medium text-white truncate">{item.title}</div>
                                                    <div className="text-[10px] text-slate-400">{item.releaseDate || ''}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between mt-5">
                                        <span className="text-xs text-muted-foreground">共 {posterTotal} 部，第 {posterPage}/{posterTotalPages} 页</span>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" disabled={posterPage <= 1} onClick={() => setPosterPage(p => p - 1)}>上一页</Button>
                                            <Button variant="outline" size="sm" disabled={posterPage >= posterTotalPages} onClick={() => setPosterPage(p => p + 1)}>下一页</Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Detail Modal */}
                    {selectedPoster && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedPoster(null); setDetailData(null) }}>
                            <div className="bg-background border rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 'min(900px, calc(100vw - 4rem))', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>

                            {detailLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : detailData ? (
                                <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden scrollbar-hidden" style={{ maxWidth: '100%' }}>
                                    {/* Hero */}
                                    <div className="relative h-[260px] sm:h-[360px] overflow-hidden">
                                        {detailData.backdropPath ? (
                                            <img src={detailData.backdropPath} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-950 to-slate-950" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                                        {detailData.posterPath && (
                                            <div className="absolute bottom-4 left-5 w-[100px] sm:w-[130px] rounded-xl overflow-hidden border-2 border-white/15 shadow-2xl z-10">
                                                <img src={detailData.posterPath} alt="" className="w-full block" />
                                            </div>
                                        )}
                                        {detailData.logoPath && (
                                            <div className="absolute bottom-6 left-[130px] sm:left-[175px] z-10">
                                                <img src={detailData.logoPath} alt="" className="max-w-[160px] sm:max-w-[200px] max-h-[40px] sm:max-h-[50px] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="px-5 sm:px-6 pb-6" style={{ paddingTop: '20px', maxWidth: '100%', overflow: 'hidden' }}>
                                        {/* Title & Meta */}
                                        <div className="mb-4">
                                            <h2 className="text-xl font-bold mb-1">
                                                {detailData.title}
                                                {detailData.releaseDate && <span className="text-muted-foreground font-normal ml-2">({detailData.releaseDate.substring(0, 4)})</span>}
                                            </h2>
                                            {detailData.tagline && <p className="text-sm text-muted-foreground italic mb-2">{detailData.tagline}</p>}
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                                                {detailData.voteAverage > 0 && (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold ${
                                                        detailData.voteAverage >= 7 ? 'bg-emerald-500/20 text-emerald-400' : detailData.voteAverage >= 5 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                                                    }`}>
                                                        ★ {detailData.voteAverage.toFixed(1)}
                                                        <span className="text-[10px] font-normal text-muted-foreground">({(detailData.voteCount || 0).toLocaleString()} votes)</span>
                                                    </span>
                                                )}
                                                {detailData.runtime && <span>{Math.floor(detailData.runtime / 60)}h {detailData.runtime % 60}m</span>}
                                                {detailData.status && <span>{detailData.status}</span>}
                                                {detailData.originalLanguage && <span className="uppercase">{detailData.originalLanguage}</span>}
                                                {detailData.type === 'tv' && detailData.numberOfSeasons && <span>{detailData.numberOfSeasons} 季 / {detailData.numberOfEpisodes} 集</span>}
                                            </div>
                                        </div>

                                        {/* Genres */}
                                        {detailData.genres?.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {detailData.genres.map((g: any) => (
                                                    <span key={g.id} className="inline-block px-2.5 py-1 rounded-full text-[11px] bg-pink-500/15 text-pink-300 border border-pink-500/25">{g.name}</span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Overview */}
                                        {detailData.overview && (
                                            <div className="mb-5">
                                                <h3 className="text-sm font-semibold mb-2">简介</h3>
                                                <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-pre-line">{detailData.overview}</p>
                                            </div>
                                        )}

                                        {/* Financial (movie) */}
                                        {detailData.type === 'movie' && (detailData.budget || detailData.revenue) && (
                                            <div className="grid grid-cols-2 gap-3 mb-5">
                                                {detailData.budget > 0 && (
                                                    <div className="rounded-xl border p-3">
                                                        <div className="text-[10px] text-muted-foreground mb-1">预算</div>
                                                        <div className="text-sm font-medium">${(detailData.budget / 1e6).toFixed(1)}M</div>
                                                    </div>
                                                )}
                                                {detailData.revenue > 0 && (
                                                    <div className="rounded-xl border p-3">
                                                        <div className="text-[10px] text-muted-foreground mb-1">票房</div>
                                                        <div className="text-sm font-medium">${(detailData.revenue / 1e6).toFixed(1)}M</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* TV Info */}
                                        {detailData.type === 'tv' && detailData.networks?.length > 0 && (
                                            <div className="mb-5">
                                                <h3 className="text-sm font-semibold mb-2">播出网络</h3>
                                                <div className="flex flex-wrap gap-3">{detailData.networks.map((n: any) => <span key={n.id} className="text-xs text-muted-foreground">{n.name}</span>)}</div>
                                            </div>
                                        )}
                                        {detailData.type === 'tv' && detailData.createdBy?.length > 0 && (
                                            <div className="mb-5">
                                                <h3 className="text-sm font-semibold mb-2">创作者</h3>
                                                <div className="flex flex-wrap gap-3">{detailData.createdBy.map((c: any) => <span key={c.id} className="text-xs text-muted-foreground">{c.name}</span>)}</div>
                                            </div>
                                        )}

                                        {/* Seasons */}
                                        {detailData.type === 'tv' && detailData.seasons?.length > 0 && (
                                            <div className="mb-5">
                                                <h3 className="text-sm font-semibold mb-2">季度</h3>
                                                <div className="flex gap-3 overflow-x-auto pb-2">
                                                    {detailData.seasons.filter((s: any) => s.season_number > 0).map((s: any) => (
                                                        <div key={s.season_number} className="flex-shrink-0 w-24 text-center cursor-pointer hover:opacity-80 transition-opacity">
                                                            {s.posterPath ? (
                                                                <img src={s.posterPath} alt="" className="w-full rounded-lg mb-1.5" />
                                                            ) : (
                                                                <div className="w-full aspect-[2/3] rounded-lg bg-muted mb-1.5" />
                                                            )}
                                                            <div className="text-xs font-medium truncate">{s.name}</div>
                                                            <div className="text-[10px] text-muted-foreground">{s.episode_count} 集</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Cast */}
                                        {detailData.cast?.length > 0 && (
                                            <div className="mb-5">
                                                <h3 className="text-sm font-semibold mb-3">演员</h3>
                                                <div className="flex gap-4 overflow-x-auto pb-2">
                                                    {detailData.cast.map((c: any) => (
                                                        <div key={c.id} className="flex-shrink-0 w-[68px] text-center">
                                                            {c.profilePath ? (
                                                                <img src={c.profilePath} alt={c.name} className="w-14 h-14 rounded-full object-cover mx-auto border-2 border-white/10" loading="lazy" />
                                                            ) : (
                                                                <div className="w-14 h-14 rounded-full bg-muted mx-auto flex items-center justify-center"><Users className="h-5 w-5 text-muted-foreground" /></div>
                                                            )}
                                                            <p className="text-[11px] mt-1.5 truncate">{c.name}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">{c.character}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Backdrops */}
                                        {detailData.backdrops?.length > 0 && (
                                            <div className="mb-5">
                                                <h3 className="text-sm font-semibold mb-3">剧照</h3>
                                                <div className="flex gap-3 overflow-x-auto pb-2">
                                                    {detailData.backdrops.map((b: string, i: number) => (
                                                        <div key={i} className="flex-shrink-0 w-[200px] rounded-lg overflow-hidden border border-border/50">
                                                            <img src={b} alt="" className="w-full block" loading="lazy" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Videos */}
                                        {detailData.videos?.length > 0 && (
                                            <div className="mb-5">
                                                <h3 className="text-sm font-semibold mb-3">预告片</h3>
                                                <div className="flex gap-3 overflow-x-auto pb-2">
                                                    {detailData.videos.map((v: any) => (
                                                        <a
                                                            key={v.key}
                                                            href={`https://www.youtube.com/watch?v=${v.key}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-shrink-0 rounded-xl border p-3 w-48 hover:bg-muted/50 transition-colors"
                                                        >
                                                            <div className="text-xs font-medium truncate">{v.name}</div>
                                                            <div className="text-[10px] text-muted-foreground">{v.type}</div>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Recommendations */}
                                        {detailData.recommendations?.length > 0 && (
                                            <div className="mb-5">
                                                <h3 className="text-sm font-semibold mb-3">推荐</h3>
                                                <div className="flex gap-3 overflow-x-auto pb-2">
                                                    {detailData.recommendations.map((r: any) => (
                                                        <div
                                                            key={r.tmdbId}
                                                            className="flex-shrink-0 w-20 cursor-pointer"
                                                            onClick={() => { setSelectedPoster(r); fetchDetail(r.tmdbId) }}
                                                        >
                                                            {r.posterPath ? (
                                                                <img src={r.posterPath} alt={r.title} className="w-full rounded-lg mb-1 object-cover aspect-[2/3]" loading="lazy" />
                                                            ) : (
                                                                <div className="w-full rounded-lg bg-muted mb-1 aspect-[2/3]" />
                                                            )}
                                                            <div className="text-[10px] text-muted-foreground truncate">{r.title}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Links */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {detailData.imdbId && (
                                                <a href={`https://www.imdb.com/title/${detailData.imdbId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors">
                                                    <ExternalLink className="h-3 w-3" /> IMDb
                                                </a>
                                            )}
                                            {detailData.homepage && (
                                                <a href={detailData.homepage} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors">
                                                    <ExternalLink className="h-3 w-3" /> 官网
                                                </a>
                                            )}
                                            <a href={`https://www.themoviedb.org/${detailData.type}/${detailData.tmdbId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors">
                                                <ExternalLink className="h-3 w-3" /> TMDB
                                            </a>
                                        </div>

                                        {/* Raw JSON */}
                                        <details className="text-xs mt-4">
                                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">查看原始 JSON</summary>
                                            <pre className="mt-2 p-3 bg-muted rounded-lg overflow-x-auto max-h-60 text-[11px]">{JSON.stringify(detailData, null, 2)}</pre>
                                        </details>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-16 text-muted-foreground">无法加载详情</div>
                            )}
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* Cache Management Tab */}
                <TabsContent value="cache" className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索缓存..."
                                className="pl-9"
                                value={cacheSearch}
                                onChange={(e) => { setCacheSearch(e.target.value); setCachePage(1) }}
                            />
                        </div>
                        <select
                            className="border rounded-md px-3 py-2 text-sm bg-background"
                            value={cacheType}
                            onChange={(e) => { setCacheType(e.target.value); setCachePage(1) }}
                        >
                            <option value="all">全部类型</option>
                            <option value="movie">电影</option>
                            <option value="tv">电视剧</option>
                            <option value="person">人物</option>
                            <option value="list">列表</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={() => fetchCacheEntries()}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleClearCache} disabled={clearing}>
                            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            <span className="ml-1">清空</span>
                        </Button>
                    </div>

                    <div className="text-sm text-muted-foreground">共 {cacheTotal} 条记录</div>

                    <div className="space-y-2">
                        {cacheEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                                <Badge variant="outline" className={getTypeColor(
                                    entry.url.includes('/movie') ? 'movie' :
                                    entry.url.includes('/tv') ? 'tv' :
                                    entry.url.includes('/person') ? 'person' : 'other'
                                )}>
                                    {getTypeIcon(
                                        entry.url.includes('/movie') ? 'movie' :
                                        entry.url.includes('/tv') ? 'tv' :
                                        entry.url.includes('/person') ? 'person' : 'other'
                                    )}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{entry.url.split('?')[0]}</div>
                                    <div className="text-xs text-muted-foreground">
                                        更新: {new Date(entry.updatedAt).toLocaleString()} · 过期: {new Date(entry.expiresAt).toLocaleString()}
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(entry.id)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                        {cacheEntries.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">暂无缓存记录</div>
                        )}
                    </div>

                    {cacheTotal > 20 && (
                        <div className="flex items-center justify-center gap-2">
                            <Button variant="outline" size="sm" disabled={cachePage <= 1} onClick={() => setCachePage(p => p - 1)}>上一页</Button>
                            <span className="text-sm">第 {cachePage} 页</span>
                            <Button variant="outline" size="sm" disabled={cacheEntries.length < 20} onClick={() => setCachePage(p => p + 1)}>下一页</Button>
                        </div>
                    )}
                </TabsContent>

                {/* Config Tab */}
                <TabsContent value="config" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Settings className="h-4 w-4" /> TMDB 配置
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>API Key</Label>
                                <Input
                                    type="password"
                                    placeholder={config?.hasApiKey ? '已配置 (留空保持不变)' : '请输入 TMDB API Key'}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                                {config?.hasApiKey && (
                                    <p className="text-xs text-muted-foreground">当前: {config.apiKey}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>语言</Label>
                                <select
                                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                >
                                    <option value="zh-CN">简体中文 (zh-CN)</option>
                                    <option value="en-US">English (en-US)</option>
                                    <option value="ja-JP">日本語 (ja-JP)</option>
                                    <option value="ko-KR">한국어 (ko-KR)</option>
                                    <option value="zh-TW">繁體中文 (zh-TW)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>HTTP 代理</Label>
                                <Input
                                    placeholder="http://127.0.0.1:7890"
                                    value={httpProxy}
                                    onChange={(e) => setHttpProxy(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>认证密钥</Label>
                                <Input
                                    type="password"
                                    placeholder="留空表示不启用认证"
                                    value={authKey}
                                    onChange={(e) => setAuthKey(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">客户端需传此值作为 api_key 参数</p>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>DNS 覆写</Label>
                                    <p className="text-xs text-muted-foreground">使用 8.8.8.8/1.1.1.1 解析 TMDB 域名</p>
                                </div>
                                <Switch checked={resolveDns} onCheckedChange={setResolveDns} />
                            </div>

                            <div className="space-y-2">
                                <Label>日志保留天数</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={logRetention}
                                    onChange={(e) => setLogRetention(parseInt(e.target.value) || 0)}
                                />
                            </div>

                            <Separator />

                            <div className="flex items-center gap-3">
                                <Button onClick={handleSaveConfig} disabled={saving}>
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                    保存配置
                                </Button>

                                <Button variant="outline" onClick={handleDnsTest} disabled={dnsTesting}>
                                    {dnsTesting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
                                    DNS 测试
                                </Button>
                            </div>

                            {dnsResult && (
                                <div className="p-3 border rounded-lg space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        {dnsResult.dnsReachable ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                        DNS 服务器: {dnsResult.dnsReachable ? '可达' : '不可达'} ({dnsResult.dnsLatency}ms)
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {dnsResult.resolveSuccess ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                        域名解析: {dnsResult.resolveSuccess ? `成功 → ${dnsResult.resolvedIp}` : '失败'} ({dnsResult.resolveLatency}ms)
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {dnsResult.httpsSuccess ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                        HTTPS 连接: {dnsResult.httpsSuccess ? '成功' : '失败'} ({dnsResult.httpsLatency}ms)
                                    </div>
                                    {dnsResult.error && <p className="text-red-500">{dnsResult.error}</p>}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Logs Tab */}
                <TabsContent value="logs" className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-sm text-muted-foreground">总调用</div>
                                <div className="text-2xl font-bold">{logStats?.total ?? 0}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-sm text-muted-foreground">今日调用</div>
                                <div className="text-2xl font-bold">{logStats?.today ?? 0}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-sm text-muted-foreground">命中率</div>
                                <div className="text-2xl font-bold">{logStats?.hitRate ?? 0}%</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <Button variant="outline" size="sm" onClick={handleClearLogs}>
                                    <Trash2 className="h-4 w-4 mr-1" /> 清除日志
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* API Docs Tab */}
                <TabsContent value="docs" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <BookOpen className="h-4 w-4" /> TMDB Proxy API 文档
                            </CardTitle>
                            <CardDescription>本服务提供 TMDB API 的代理缓存服务，支持自动缓存、预热、中文翻译增强</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 text-sm">
                            {/* Base URL */}
                            <section>
                                <h3 className="font-semibold text-base mb-2">基础地址</h3>
                                <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all">
                                    {typeof window !== 'undefined' ? window.location.origin : ''}/api/tmdb-proxy
                                </div>
                                <p className="mt-2 text-muted-foreground">
                                    把 TMDB 官方地址 <code className="text-xs bg-muted px-1 rounded">https://api.themoviedb.org</code> 替换成上面的地址，路径不变。
                                </p>
                                <div className="mt-2 p-3 bg-muted rounded-lg font-mono text-xs space-y-1">
                                    <div className="text-muted-foreground"># 示例</div>
                                    <div>官方: <span className="text-destructive">https://api.themoviedb.org</span>/3/movie/123?api_key=xxx</div>
                                    <div>代理: <span className="text-primary">{typeof window !== 'undefined' ? window.location.origin : ''}/api/tmdb-proxy</span>/3/movie/123?api_key=xxx</div>
                                </div>
                            </section>

                            {/* Supported Endpoints */}
                            <section>
                                <h3 className="font-semibold text-base mb-2">支持的端点</h3>
                                <div className="border rounded-lg divide-y">
                                    {[
                                        ['GET', '/3/movie/{id}', '获取电影详情（自动缓存，含中文标题/简介）'],
                                        ['GET', '/3/tv/{id}', '获取电视剧详情'],
                                        ['GET', '/3/search/movie', '搜索电影'],
                                        ['GET', '/3/search/tv', '搜索电视剧'],
                                        ['GET', '/3/discover/movie', '发现电影（按类型、排序等筛选）'],
                                        ['GET', '/3/discover/tv', '发现电视剧'],
                                        ['GET', '/3/trending/{media_type}/{time_window}', '获取趋势内容'],
                                        ['GET', '/3/movie/popular', '热门电影'],
                                        ['GET', '/3/movie/now_playing', '正在上映'],
                                        ['GET', '/3/movie/top_rated', '高分电影'],
                                        ['GET', '/3/tv/popular', '热门剧集'],
                                        ['GET', '/3/person/{id}', '获取人物详情'],
                                        ['GET', '/3/tv/{id}/season/{season}', '获取季信息'],
                                        ['GET', '/3/movie/{id}/similar', '相似电影'],
                                        ['GET', '/3/tv/{id}/similar', '相似剧集'],
                                    ].map(([method, path, desc]) => (
                                        <div key={path} className="flex items-center gap-3 p-2.5">
                                            <Badge variant="outline" className="font-mono text-xs shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{method}</Badge>
                                            <code className="text-xs font-mono shrink-0">{path}</code>
                                            <span className="text-muted-foreground text-xs ml-auto text-right">{desc}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    实际上任何 <code className="text-xs bg-muted px-1 rounded">/3/...</code> 路径均可代理，以上仅为常用端点。
                                    不支持 <code className="text-xs bg-muted px-1 rounded">/4/...</code> 路径。
                                </p>
                            </section>

                            {/* Image Proxy */}
                            <section>
                                <h3 className="font-semibold text-base mb-2">图片代理</h3>
                                <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all">
                                    {typeof window !== 'undefined' ? window.location.origin : ''}/api/tmdb-proxy/img/&#123;size&#125;/&#123;path&#125;
                                </div>
                                <div className="mt-2 space-y-1">
                                    <p className="text-muted-foreground">可用尺寸：</p>
                                    <div className="flex flex-wrap gap-2">
                                        {['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'].map(s => (
                                            <Badge key={s} variant="secondary" className="font-mono text-xs">{s}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    图片代理带内存级 LRU 缓存（最多 500 张，7 天 TTL），重复请求不会访问上游。
                                </p>
                            </section>

                            {/* Auto Enrichment */}
                            <section>
                                <h3 className="font-semibold text-base mb-2">自动增强字段</h3>
                                <p className="text-muted-foreground mb-2">代理会自动为电影/电视剧详情响应追加以下字段：</p>
                                <div className="border rounded-lg divide-y">
                                    {[
                                        ['titleCn / nameCn', '中文标题（从 zh-CN 翻译）'],
                                        ['overviewCn', '中文简介'],
                                    ].map(([field, desc]) => (
                                        <div key={field} className="flex items-center gap-3 p-2.5">
                                            <code className="text-xs font-mono bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">{field}</code>
                                            <span className="text-muted-foreground text-xs">{desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Cache Strategy */}
                            <section>
                                <h3 className="font-semibold text-base mb-2">缓存策略</h3>
                                <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
                                    <li><strong>写入缓存</strong>：首次请求后自动缓存，TTL 为 7 天</li>
                                    <li><strong>自动续期</strong>：缓存命中时自动续期 7 天</li>
                                    <li><strong>后台预取</strong>：请求电影/剧集详情时，自动将相似内容、推荐列表加入预取队列</li>
                                    <li><strong>Cache Warmer</strong>：三引擎预热（热门/历史/变更），可从管理面板启动</li>
                                    <li><strong>URL 规范化</strong>：自动去除 api_key、append_to_response 等参数，最大化缓存命中</li>
                                </ul>
                            </section>

                            {/* Client Config */}
                            <section>
                                <h3 className="font-semibold text-base mb-2">客户端配置示例</h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs font-medium mb-1">Emby / Jellyfin（在 TMDB 插件设置中填写）</p>
                                        <div className="p-3 bg-muted rounded-lg font-mono text-xs space-y-1">
                                            <div>API 地址: <span className="text-primary">{typeof window !== 'undefined' ? window.location.origin : ''}/api/tmdb-proxy</span></div>
                                            <div>API Key: <span className="text-primary">你的认证密钥</span>（如已在配置面板设置）</div>
                                        </div>
                                        <p className="mt-1 text-muted-foreground text-xs">填入基础地址即可，插件会自动拼接 /3/movie/{'{id}'} 等路径。</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium mb-1">StrmAssistant（配置文件）</p>
                                        <div className="p-3 bg-muted rounded-lg font-mono text-xs space-y-1">
                                            <div>&#123;</div>
                                            <div>&nbsp;&nbsp;"TmdbApiHost": "<span className="text-primary">{typeof window !== 'undefined' ? window.location.origin : ''}/api/tmdb-proxy</span>",</div>
                                            <div>&nbsp;&nbsp;"TmdbApiKey": "<span className="text-primary">你的认证密钥</span>"</div>
                                            <div>&#125;</div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Auth Key */}
                            <section>
                                <h3 className="font-semibold text-base mb-2">认证密钥</h3>
                                <p className="text-muted-foreground">
                                    在配置面板中设置认证密钥后，所有 API 请求的 <code className="text-xs bg-muted px-1 rounded">api_key</code> 参数必须匹配该密钥。
                                    未设置密钥时，API 对所有请求开放。图片代理不需要认证。
                                </p>
                            </section>

                            {/* DNS Override */}
                            <section>
                                <h3 className="font-semibold text-base mb-2">DNS 覆写</h3>
                                <p className="text-muted-foreground">
                                    在国内网络环境下，TMDB 域名可能被污染。开启 DNS 覆写后，系统将使用 8.8.8.8 / 1.1.1.1 解析 TMDB 相关域名，
                                    并通过解析出的 IP 直接建立 HTTPS 连接，绕过 DNS 污染。
                                </p>
                            </section>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
