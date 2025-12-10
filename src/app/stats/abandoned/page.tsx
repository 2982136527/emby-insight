'use client'

import { useQuery } from '@tanstack/react-query'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Ban, TrendingDown, Users } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { formatDuration } from '@/types/emby'

interface AbandonedItem {
    id: string
    itemId: string
    itemName: string
    itemType: string
    seriesName: string | null
    imageUrl: string
    playedAt: string
    progress: number
    duration: number
    playbackPosition: number
    userName: string
    serverName: string
    abandonCount?: number
    users?: string[]
}

interface AbandonedData {
    total: number
    byItem: AbandonedItem[]
    recent: AbandonedItem[]
}

export default function AbandonedPage() {
    const { data, isLoading, error } = useQuery<AbandonedData>({
        queryKey: ['abandoned'],
        queryFn: async () => {
            const res = await fetch('/api/stats/abandoned')
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">加载失败</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 animate-fade-in">
            {/* Header */}
            <div className="flex-none px-1">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Ban className="h-6 w-6 text-orange-500" />
                    弃剧分析
                </h1>
                <p className="text-sm text-muted-foreground">
                    分析用户观看进度不足 30% 的内容
                </p>
            </div>

            {/* Stats Overview */}
            <div className="flex-none grid gap-4 grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                        <CardTitle className="text-sm font-medium">弃剧总数</CardTitle>
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-3xl font-bold">{data.total}</div>
                        <p className="text-xs text-muted-foreground">进度 &lt; 30% 的记录</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                        <CardTitle className="text-sm font-medium">不同影片数</CardTitle>
                        <Ban className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-3xl font-bold">{data.byItem.length}</div>
                        <p className="text-xs text-muted-foreground">被放弃的独立影片</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                        <CardTitle className="text-sm font-medium">最常被放弃</CardTitle>
                        <Users className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-bold truncate">
                            {data.byItem[0]?.itemName || '暂无数据'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            被 {data.byItem[0]?.abandonCount || 0} 人放弃
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex-1 grid gap-4 lg:grid-cols-2 min-h-0">
                {/* Most Abandoned */}
                <Card className="flex flex-col h-full border-border/50">
                    <CardHeader className="flex-none p-4 pb-2 border-b">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-orange-500" />
                            最常被放弃的内容
                        </CardTitle>
                        <CardDescription className="text-xs">按放弃次数排序</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 p-0">
                        <ScrollArea className="h-full">
                            <div className="p-4 space-y-3">
                                {data.byItem.map((item, index) => (
                                    <div
                                        key={item.itemId}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 font-bold text-xs shrink-0">
                                            {index + 1}
                                        </div>
                                        <div className="w-10 h-14 rounded overflow-hidden bg-muted shrink-0">
                                            <img
                                                src={item.imageUrl}
                                                alt={item.itemName}
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-sm">{item.itemName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-[10px] h-5">{item.itemType}</Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {item.abandonCount} 次放弃
                                                </span>
                                            </div>
                                            {item.users && item.users.length > 0 && (
                                                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                                    用户: {item.users.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                        <Badge variant="destructive" className="shrink-0 text-xs h-5">
                                            {item.progress}%
                                        </Badge>
                                    </div>
                                ))}
                                {data.byItem.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        暂无弃剧数据
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Recent Abandoned */}
                <Card className="flex flex-col h-full border-border/50">
                    <CardHeader className="flex-none p-4 pb-2 border-b">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Ban className="h-4 w-4 text-red-500" />
                            最近被放弃
                        </CardTitle>
                        <CardDescription className="text-xs">按时间排序</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 p-0">
                        <ScrollArea className="h-full">
                            <div className="p-4 space-y-3">
                                {data.recent.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="w-10 h-14 rounded overflow-hidden bg-muted shrink-0">
                                            <img
                                                src={item.imageUrl}
                                                alt={item.itemName}
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-sm">{item.itemName}</p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <Badge variant="secondary" className="text-[10px] h-5">{item.userName}</Badge>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {format(new Date(item.playedAt), 'MM-dd HH:mm', { locale: zhCN })}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                观看 {formatDuration(item.playbackPosition)} / {formatDuration(item.duration)}
                                            </p>
                                        </div>
                                        <Badge variant="destructive" className="shrink-0 text-xs h-5">
                                            {item.progress}%
                                        </Badge>
                                    </div>
                                ))}
                                {data.recent.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        暂无弃剧数据
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
