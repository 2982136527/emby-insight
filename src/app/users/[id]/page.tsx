'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
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
import { Loader2, User, Clock, Film, Tv, ArrowLeft, TrendingUp, BarChart3, CheckCircle, Monitor } from 'lucide-react'
import { formatDuration } from '@/types/emby'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
} from 'recharts'

interface UserStats {
    user: {
        id: string
        username: string
        embyUserId: string
        serverName: string
        serverId: string
        globalUser?: { name: string; avatar?: string }
    }
    summary: {
        totalDuration: number
        totalRealDuration: number
        totalItems: number
        totalUniqueItems: number
        todayPlayCount: number
        completedItems: number
        completionRate: number
        activeDays: number
        peakHour: string
    }
    topGenres: Array<{ genre: string; duration: number }>
    topItems: Array<{ name: string; type: string; duration: number; count: number; seriesName?: string }>
    typeDistribution: Array<{ type: string; count: number; duration: number }>
    hourlyData: number[]
    recentHistory: Array<{
        id: string
        itemId: string
        itemName: string
        itemType: string
        seriesName?: string
        duration: number
        playedAt: string
        isCompleted: boolean
        serverId: string
    }>
    dailyTrend: Array<{ date: string; duration: number }>
    devices: Array<{
        deviceName: string
        client: string
        ipAddress: string | null
        lastSeen: string
        count: number
    }>
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

export default function UserDetailsPage() {
    const params = useParams()
    const userId = params.id as string

    const { data, isLoading, error } = useQuery<UserStats>({
        queryKey: ['user-stats', userId],
        queryFn: async () => {
            const res = await fetch(`/api/users/${userId}/stats`)
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
                <p className="text-muted-foreground mb-4">用户不存在或加载失败</p>
                <Link href="/users">
                    <Button variant="outline">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        返回用户列表
                    </Button>
                </Link>
            </div>
        )
    }

    const hourlyChartData = data.hourlyData.map((value, hour) => ({
        hour: `${hour}:00`,
        duration: value,
        hours: value / 10000000 / 3600,
        formatted: formatDuration(value),
    }))

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/" className="hover:text-foreground transition-colors">首页</Link>
                <span>/</span>
                <Link href="/users" className="hover:text-foreground transition-colors">用户</Link>
                <span>/</span>
                <span className="text-foreground font-medium">{data.user.globalUser?.name || data.user.username}</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">{data.user.globalUser?.name || data.user.username}</h1>
                    <p className="text-sm text-muted-foreground">
                        {data.user.serverName} · @{data.user.username}
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
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
                        <CardTitle className="text-sm font-medium">真实观看时长</CardTitle>
                        <Clock className="h-4 w-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {data.summary.totalRealDuration > 0
                                ? `${Math.round(data.summary.totalRealDuration / 1000 / 60)}分钟`
                                : '-'}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">影片数量</CardTitle>
                        <Film className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.totalUniqueItems}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">今日影片</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.todayPlayCount}</div>
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
                        <CardTitle className="text-sm font-medium">活跃天数</CardTitle>
                        <BarChart3 className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.activeDays}</div>
                        <p className="text-xs text-muted-foreground">近30天</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">高峰时段</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.peakHour}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Device History */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-blue-500" />
                        设备使用情况
                    </CardTitle>
                    <CardDescription>最近使用的设备与 IP 地址</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data.devices && data.devices.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.devices.map((device, i) => (
                                    <div key={i} className="flex items-start justify-between p-3 rounded-lg border bg-muted/40">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">{device.deviceName}</span>
                                                <Badge variant="outline" className="text-[10px] h-5">{device.client}</Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground font-mono">
                                                {device.ipAddress || 'Unknown IP'}
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="text-xs text-muted-foreground">
                                                {format(new Date(device.lastSeen), 'MM-dd HH:mm', { locale: zhCN })}
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] h-5">
                                                {device.count} 次会话
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">暂无设备记录</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 30-Day Trend Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-violet-500" />
                        30天观看趋势
                    </CardTitle>
                    <CardDescription>每日观看时长变化</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.dailyTrend.map(d => {
                                const dur = Number(d.duration)
                                return {
                                    ...d,
                                    hours: dur / 10000000 / 3600,
                                    formatted: formatDuration(dur),
                                    label: d.date.slice(5) // MM-DD format
                                }
                            })}>
                                <defs>
                                    <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v < 1 ? `${Math.round(v * 60)}m` : `${v.toFixed(0)}h`} />
                                <Tooltip formatter={(_, __, props) => [props?.payload?.formatted || '0m', '时长']} />
                                <Area type="monotone" dataKey="hours" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorDuration)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Charts Row */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Hourly Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>观看时段分布</CardTitle>
                        <CardDescription>各小时观看时长分布</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={5} />
                                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatDuration(v)} />
                                    <Tooltip
                                        formatter={(value: number) => [formatDuration(value), '时长']}
                                        contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                                    />
                                    <Bar dataKey="duration" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Type Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>内容类型分布</CardTitle>
                        <CardDescription>按类型统计观看内容</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] flex items-center">
                            <ResponsiveContainer width="60%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.typeDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={80}
                                        dataKey="count"
                                        nameKey="type"
                                    >
                                        {data.typeDistribution.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-2">
                                {data.typeDistribution.map((item, index) => (
                                    <div key={item.type} className="flex items-center gap-2">
                                        <div
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <span className="text-sm">{item.type === 'Movie' ? '电影' : item.type === 'Episode' ? '剧集' : item.type}</span>
                                        <span className="text-sm text-muted-foreground">({item.count})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Content Row */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Top Genres */}
                <Card>
                    <CardHeader>
                        <CardTitle>偏好标签 TOP10</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.topGenres.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">暂无数据</p>
                        ) : (
                            <div className="space-y-3">
                                {data.topGenres.map((genre, i) => {
                                    const maxDuration = data.topGenres[0]?.duration || 1
                                    const percentage = (genre.duration / maxDuration) * 100
                                    return (
                                        <div key={genre.genre} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                                                    <span>{genre.genre}</span>
                                                </div>
                                                <span className="text-muted-foreground">{formatDuration(genre.duration)}</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top Items */}
                <Card>
                    <CardHeader>
                        <CardTitle>最常观看 TOP10</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.topItems.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">暂无数据</p>
                        ) : (
                            <div className="space-y-3">
                                {data.topItems.map((item, i) => (
                                    <div key={`${item.name}-${i}`} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                                            <Badge variant="outline" className="text-xs shrink-0">{i + 1}</Badge>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate" title={item.seriesName ? item.seriesName : item.name}>
                                                    {item.seriesName ? item.seriesName : item.name}
                                                </p>
                                                {item.seriesName && (
                                                    <p className="text-xs text-muted-foreground truncate" title={item.name}>{item.name}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-medium">{formatDuration(item.duration)}</p>
                                            <p className="text-xs text-muted-foreground">{item.count}次</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent History */}
            <Card>
                <CardHeader>
                    <CardTitle>最近观看</CardTitle>
                    <CardDescription>最近 20 条观看记录</CardDescription>
                </CardHeader>
                <CardContent>
                    {data.recentHistory.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">暂无观看记录</p>
                    ) : (
                        <div className="space-y-2">
                            {data.recentHistory.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="relative h-10 w-7 shrink-0 rounded overflow-hidden bg-muted">
                                            <img
                                                src={`/api/image?serverId=${item.serverId}&itemId=${item.itemId}&type=Primary`}
                                                alt={item.itemName}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    // Fallback to icon if image fails
                                                    e.currentTarget.style.display = 'none'
                                                    e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center')
                                                    const icon = document.createElement('div')
                                                    icon.innerHTML = item.itemType === 'Movie'
                                                        ? '<svg class="h-4 w-4 text-violet-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>'
                                                        : '<svg class="h-4 w-4 text-cyan-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>'
                                                    e.currentTarget.parentElement?.appendChild(icon)
                                                }}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {item.seriesName ? `${item.seriesName} - ${item.itemName}` : item.itemName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(item.playedAt), 'M月d日 HH:mm', { locale: zhCN })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {item.isCompleted && (
                                            <Badge variant="secondary" className="text-[10px]">完播</Badge>
                                        )}
                                        <span className="text-sm text-muted-foreground">{formatDuration(item.duration)}</span>
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
