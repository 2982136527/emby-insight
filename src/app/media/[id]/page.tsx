'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'next/navigation'
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
import { Loader2, Film, Tv, ArrowLeft, Clock, Users, Play, CheckCircle, Star } from 'lucide-react'
import { formatDuration } from '@/types/emby'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'

interface MediaStats {
    media: {
        itemId: string
        serverId: string
        itemName: string
        itemType: string
        seriesName?: string
        seasonName?: string
        episodeNumber?: number
        genres: string[]
        year?: number
        duration: number
        videoCodec?: string
        resolution?: string
        isHdr: boolean
        overview?: string
        communityRating?: number
        officialRating?: string
    }
    summary: {
        totalDuration: number
        totalPlays: number
        uniqueUsers: number
        completedPlays: number
        completionRate: number
        firstWatched: string
        lastWatched: string
    }
    watchers: Array<{
        name: string
        duration: number
        count: number
        lastPlayed: string
    }>
    hourlyData: number[]
    recentPlays: Array<{
        id: string
        username: string
        duration: number
        playedAt: string
        isCompleted: boolean
    }>
}

export default function MediaDetailsPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const itemId = params.id as string
    const serverId = searchParams.get('serverId')

    const { data, isLoading, error } = useQuery<MediaStats>({
        queryKey: ['media-stats', itemId, serverId],
        queryFn: async () => {
            const res = await fetch(`/api/media/${itemId}?serverId=${serverId}`)
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
        enabled: !!serverId,
    })

    if (!serverId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground mb-4">缺少 serverId 参数</p>
                <Link href="/">
                    <Button variant="outline">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        返回首页
                    </Button>
                </Link>
            </div>
        )
    }

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
                <p className="text-muted-foreground mb-4">媒体不存在或加载失败</p>
                <Link href="/">
                    <Button variant="outline">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        返回首页
                    </Button>
                </Link>
            </div>
        )
    }

    const posterUrl = `/api/image?serverId=${serverId}&itemId=${itemId}&type=Primary`
    const backdropUrl = `/api/image?serverId=${serverId}&itemId=${itemId}&type=Backdrop`

    const hourlyChartData = data.hourlyData.map((value, hour) => ({
        hour: `${hour}:00`,
        plays: value,
    }))

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/" className="hover:text-foreground transition-colors">首页</Link>
                <span>/</span>
                <Link href="/leaderboard" className="hover:text-foreground transition-colors">排行榜</Link>
                <span>/</span>
                <span className="text-foreground font-medium truncate max-w-[200px]">
                    {data.media.seriesName || data.media.itemName}
                </span>
            </nav>

            {/* Hero Section */}
            <div className="relative rounded-xl overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${backdropUrl})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

                <div className="relative p-6 flex gap-6">

                    {/* Poster */}
                    <div className="w-32 h-48 rounded-lg overflow-hidden shadow-xl shrink-0 mt-8">
                        <img
                            src={posterUrl}
                            alt={data.media.itemName}
                            className="w-full h-full object-cover"
                            onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                    </div>

                    {/* Info */}
                    <div className="flex-1 pt-8">
                        <div className="flex items-center gap-2 mb-2">
                            {data.media.itemType === 'Movie' ? (
                                <Film className="h-5 w-5 text-violet-500" />
                            ) : (
                                <Tv className="h-5 w-5 text-cyan-500" />
                            )}
                            <Badge variant="secondary">
                                {data.media.itemType === 'Movie' ? '电影' : '剧集'}
                            </Badge>
                            {data.media.year && <Badge variant="outline">{data.media.year}</Badge>}
                            {data.media.resolution && <Badge variant="outline">{data.media.resolution}</Badge>}
                            {data.media.isHdr && <Badge className="bg-amber-500">HDR</Badge>}
                        </div>

                        <h1 className="text-2xl font-bold mb-1">
                            {data.media.seriesName || data.media.itemName}
                        </h1>
                        {data.media.seriesName && (
                            <p className="text-lg text-muted-foreground">
                                {data.media.seasonName} · {data.media.itemName}
                            </p>
                        )}

                        {data.media.communityRating && (
                            <div className="flex items-center gap-1 mt-2">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                <span className="font-medium">{data.media.communityRating.toFixed(1)}</span>
                            </div>
                        )}

                        {data.media.genres.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                                {data.media.genres.slice(0, 5).map(genre => (
                                    <Badge key={genre} variant="outline" className="text-xs">{genre}</Badge>
                                ))}
                            </div>
                        )}

                        {data.media.overview && (
                            <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
                                {data.media.overview}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">总观看时长</CardTitle>
                        <Clock className="h-4 w-4 text-violet-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatDuration(data.summary.totalDuration)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">播放次数</CardTitle>
                        <Play className="h-4 w-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.totalPlays}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">观看用户</CardTitle>
                        <Users className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.uniqueUsers}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">完播率</CardTitle>
                        <CheckCircle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.completionRate}%</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">片长</CardTitle>
                        <Film className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatDuration(data.media.duration)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts and Lists */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Hourly Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>观看时段分布</CardTitle>
                        <CardDescription>各小时播放次数</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyChartData}>
                                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={5} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="plays" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Watchers */}
                <Card>
                    <CardHeader>
                        <CardTitle>观看用户</CardTitle>
                        <CardDescription>按观看时长排序</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {data.watchers.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">暂无数据</p>
                        ) : (
                            <div className="space-y-3">
                                {data.watchers.slice(0, 8).map((watcher, i) => (
                                    <div key={watcher.name} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                                            <span className="text-sm font-medium">{watcher.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium">{formatDuration(watcher.duration)}</p>
                                            <p className="text-xs text-muted-foreground">{watcher.count}次</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Plays */}
            <Card>
                <CardHeader>
                    <CardTitle>最近播放</CardTitle>
                    <CardDescription>最近 10 次播放记录</CardDescription>
                </CardHeader>
                <CardContent>
                    {data.recentPlays.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">暂无记录</p>
                    ) : (
                        <div className="space-y-2">
                            {data.recentPlays.map((play) => (
                                <div
                                    key={play.id}
                                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium">{play.username}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(play.playedAt), 'M月d日 HH:mm', { locale: zhCN })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {play.isCompleted && (
                                            <Badge variant="secondary" className="text-[10px]">完播</Badge>
                                        )}
                                        <span className="text-sm text-muted-foreground">{formatDuration(play.duration)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
