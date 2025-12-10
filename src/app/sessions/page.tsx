'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Clock, Play, Zap, Monitor, ChevronLeft, ChevronRight, Search, Film, Tv, X, MessageSquare, Ban, Send } from 'lucide-react'
import { formatDuration } from '@/types/emby'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserSelector } from '@/components/user-selector'
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from 'recharts'

interface SessionLogsResponse {
    sessions: Array<{
        id: string
        sessionId: string
        serverId: string
        serverUserId: string | null
        username: string
        client: string
        deviceName: string
        itemId: string
        itemName: string
        itemType: string
        seriesName?: string
        startedAt: string
        endedAt?: string
        duration: number
        positionTicks: number
        realDuration: number
        isPaused: boolean
        isActive: boolean
        isTranscoding: boolean
        videoCodec?: string
        audioCodec?: string
        bitrate?: number
    }>
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
    stats: {
        totalSessions: number
        totalRealDuration: number
        totalPositionTicks: number
        transcodingCount: number
        directPlayCount: number
        transcodingRate: number
    }
    clientDistribution: Array<{ client: string; count: number }>
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

export default function SessionsPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [clientFilter, setClientFilter] = useState<string>('all')
    const [messageSessionId, setMessageSessionId] = useState<string | null>(null)
    const [messageText, setMessageText] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [selectedUserId, setSelectedUserId] = useState<string>()

    const queryClient = useQueryClient() // Need to import this or just refetch

    const handleStopSession = async (sessionId: string) => {
        if (!window.confirm('确定要终止此会话吗？这将停止用户的播放。')) return

        setActionLoading(sessionId)
        try {
            const res = await fetch(`/api/sessions/${sessionId}/command`, {
                method: 'POST',
                body: JSON.stringify({ command: 'stop' }),
            })
            if (!res.ok) throw new Error('Failed to stop session')

            toast.success('会话已终止')
            queryClient.invalidateQueries({ queryKey: ['session-logs'] })
        } catch (error) {
            toast.error('操作失败，请重试')
        } finally {
            setActionLoading(null)
        }
    }

    const handleMessageSession = async (sessionId: string) => {
        setActionLoading(sessionId)
        try {
            const res = await fetch(`/api/sessions/${sessionId}/command`, {
                method: 'POST',
                body: JSON.stringify({ command: 'message', text: messageText }),
            })
            if (!res.ok) throw new Error('Failed to send message')

            toast.success('消息已发送')
            setMessageSessionId(null)
            setMessageText('')
        } catch (error) {
            toast.error('发送失败，请重试')
        } finally {
            setActionLoading(null)
        }
    }

    const { data, isLoading } = useQuery<SessionLogsResponse>({
        queryKey: ['session-logs', page, search, clientFilter, selectedUserId],
        queryFn: async () => {
            const params = new URLSearchParams({ page: page.toString(), limit: '20' })
            if (search) params.set('username', search)
            if (clientFilter && clientFilter !== 'all') params.set('client', clientFilter)
            if (selectedUserId) params.set('userId', selectedUserId)
            const res = await fetch(`/api/sessions?${params}`)
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
    })

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 animate-fade-in p-1">
            {/* Header */}
            <div className="flex-none">
                <h1 className="text-2xl font-bold tracking-tight">会话日志</h1>
                <p className="text-sm text-muted-foreground">详细的观看会话记录，包含真实观看时长和转码信息</p>
            </div>

            {/* Stats Cards */}
            {data && (
                <div className="flex-none grid gap-4 grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                            <CardTitle className="text-sm font-medium">总会话数</CardTitle>
                            <Play className="h-4 w-4 text-violet-500" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold">{data.stats.totalSessions}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                            <CardTitle className="text-sm font-medium">真实总时长</CardTitle>
                            <Clock className="h-4 w-4 text-cyan-500" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold">
                                {Math.floor(data.stats.totalRealDuration / 1000 / 60 / 60)}h {Math.floor((data.stats.totalRealDuration / 1000 / 60) % 60)}m
                            </div>
                            <p className="text-xs text-muted-foreground">用户实际花费时间</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                            <CardTitle className="text-sm font-medium">视频进度总时长</CardTitle>
                            <Film className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold">
                                {formatDuration(data.stats.totalPositionTicks)}
                            </div>
                            <p className="text-xs text-muted-foreground">视频播放进度</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                            <CardTitle className="text-sm font-medium">转码率</CardTitle>
                            <Zap className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold">{data.stats.transcodingRate}%</div>
                            <p className="text-xs text-muted-foreground">
                                {data.stats.transcodingCount} 次转码
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="col-span-2 lg:col-span-1">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                            <CardTitle className="text-sm font-medium">直接播放</CardTitle>
                            <Monitor className="h-4 w-4 text-rose-500" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold">{data.stats.directPlayCount}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Client Distribution - Optional, can be made smaller or collapsible if needed, but for now keeping it fixed-ish */}
            {data && data.clientDistribution.length > 0 && (
                <Card className="flex-none">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium">客户端分布</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="flex flex-wrap gap-2">
                            {data.clientDistribution
                                .sort((a, b) => b.count - a.count)
                                .map((item, index) => (
                                    <div
                                        key={item.client}
                                        className="flex items-center gap-2 bg-muted/50 px-2 py-1 rounded-full text-xs"
                                    >
                                        <span className="font-medium">{item.client}</span>
                                        <span className="text-primary font-semibold">{item.count}</span>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Main Session List */}
            <Card className="flex-1 flex flex-col min-h-0 border-border/50">
                <CardHeader className="flex-none p-4 border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-base">会话列表</CardTitle>
                            <CardDescription className="text-xs mt-1">
                                {data ? `共 ${data.pagination.total} 条记录` : '加载中...'}
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-[130px] h-8 text-xs shrink-0">
                                    <SelectValue placeholder="客户端" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部客户端</SelectItem>
                                    {data?.clientDistribution.map((c) => (
                                        <SelectItem key={c.client} value={c.client}>
                                            {c.client} ({c.count})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="w-[150px] shrink-0">
                                <UserSelector
                                    value={selectedUserId}
                                    onChange={(v) => { setSelectedUserId(v); setPage(1); }}
                                    className="w-full h-8 text-xs"
                                />
                            </div>
                            <div className="relative w-40 shrink-0">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="搜索..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value)
                                        setPage(1)
                                    }}
                                    className="pl-8 h-8 text-xs"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-0 min-h-0 bg-muted/10">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : data?.sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <p>暂无会话记录</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4">
                            {data?.sessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
                                >
                                    {/* Image Header */}
                                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                                        <img
                                            src={`/api/image?serverId=${session.serverId}&itemId=${session.itemId}&type=Backdrop`}
                                            alt={session.itemName}
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                                // Fallback to Primary if Backdrop fails, or icon
                                                const parent = e.currentTarget.parentElement!
                                                parent.innerHTML = '' // Clear
                                                // Try loading Primary instead 
                                                const img = document.createElement('img')
                                                img.src = `/api/image?serverId=${session.serverId}&itemId=${session.itemId}&type=Primary`
                                                img.className = "h-full w-full object-cover opacity-50 blur-sm scale-110"
                                                img.onerror = () => {
                                                    parent.innerHTML = session.itemType === 'Movie'
                                                        ? '<div class="w-full h-full flex items-center justify-center bg-muted"><svg class="h-12 w-12 text-violet-500/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg></div>'
                                                        : '<div class="w-full h-full flex items-center justify-center bg-muted"><svg class="h-12 w-12 text-cyan-500/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></div>'
                                                }
                                                parent.appendChild(img)
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                                        {/* Status Badge */}
                                        <div className="absolute top-2 right-2 flex gap-1">
                                            {session.isActive && (
                                                <Badge className="bg-green-500/90 hover:bg-green-500 text-[10px] h-5 px-1.5 shadow-sm border-none backdrop-blur-sm">Live</Badge>
                                            )}
                                            {session.isTranscoding ? (
                                                <Badge variant="outline" className="text-[10px] bg-black/40 text-orange-300 border-none backdrop-blur-md h-5 px-1.5">
                                                    转码
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] bg-black/40 text-green-300 border-none backdrop-blur-md h-5 px-1.5">
                                                    直播
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Bottom Title in Image */}
                                        <div className="absolute bottom-2 left-3 right-3">
                                            <div className="font-semibold text-white text-sm truncate text-shadow-sm">
                                                {session.seriesName ? session.seriesName : session.itemName}
                                            </div>
                                            {session.seriesName && (
                                                <div className="text-xs text-white/80 truncate text-shadow-sm">
                                                    {session.itemName}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Content */}
                                    <div className="flex flex-col flex-1 p-3 gap-3">
                                        {/* User & Client Row */}
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {session.serverUserId ? (
                                                    <Link href={`/users/${session.serverUserId}`} className="font-medium hover:text-primary hover:underline truncate flex items-center gap-1.5">
                                                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary shrink-0">
                                                            {session.username.slice(0, 1).toUpperCase()}
                                                        </div>
                                                        <span className="truncate">{session.username}</span>
                                                    </Link>
                                                ) : (
                                                    <div className="font-medium truncate flex items-center gap-1.5">
                                                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">
                                                            {session.username.slice(0, 1).toUpperCase()}
                                                        </div>
                                                        <span className="truncate">{session.username}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 max-w-[40%] justify-end" title={`${session.client} - ${session.deviceName}`}>
                                                <Monitor className="h-3 w-3" />
                                                <span className="truncate">{session.client}</span>
                                            </div>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2 rounded-md">
                                            <div className="space-y-0.5">
                                                <div className="text-muted-foreground scale-90 origin-left">进度</div>
                                                <div className="font-mono">{formatDuration(session.positionTicks)}</div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-muted-foreground scale-90 origin-left">真实</div>
                                                <div className="font-mono text-cyan-600 dark:text-cyan-400">
                                                    {formatDuration(session.realDuration * 10000)}
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-muted-foreground scale-90 origin-left">开始</div>
                                                <div className="font-mono">{format(new Date(session.startedAt), 'HH:mm')}</div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-muted-foreground scale-90 origin-left">结束</div>
                                                <div className={`font-mono ${!session.endedAt ? 'text-green-500' : ''}`}>
                                                    {session.endedAt ? format(new Date(session.endedAt), 'HH:mm') : '...'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hover Actions */}
                                    {session.isActive && (
                                        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-7 w-7 bg-background/80 backdrop-blur-md shadow-sm hover:bg-background"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    setMessageSessionId(session.id)
                                                    setMessageText('')
                                                }}
                                            >
                                                <MessageSquare className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-7 w-7 opacity-90 shadow-sm hover:opacity-100"
                                                disabled={actionLoading === session.id}
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    handleStopSession(session.id)
                                                }}
                                            >
                                                {actionLoading === session.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Ban className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>

                {/* Fixed Pagination Footer (moved outside of scrollable area) */}
                {data && data.pagination.totalPages > 1 && (
                    <div className="flex-none p-2 border-t bg-muted/20 flex items-center justify-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {page} / {data.pagination.totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                            disabled={page === data.pagination.totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </Card>

            {/* Message Dialog */}
            <Dialog open={!!messageSessionId} onOpenChange={(open) => !open && setMessageSessionId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>发送消息给用户</DialogTitle>
                        <DialogDescription>
                            消息将即时显示在用户的客户端上。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Input
                                placeholder="输入消息内容..."
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMessageSessionId(null)}>取消</Button>
                        <Button
                            onClick={() => messageSessionId && handleMessageSession(messageSessionId)}
                            disabled={!messageText.trim() || !!actionLoading}
                        >
                            {actionLoading === messageSessionId ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Send className="h-4 w-4 mr-2" />
                            )}
                            发送
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
