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
import { Loader2, Monitor, Smartphone, Zap, Play, Film } from 'lucide-react'
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'

interface DeviceStats {
    summary: {
        totalSessions: number
        uniqueClients: number
        uniqueDevices: number
        transcodingRate: number
    }
    playbackMethod: {
        transcode: number
        directPlay: number
    }
    clients: Array<{
        client: string
        count: number
        duration: number
        transcodeCount: number
        transcodeRate: number
    }>
    devices: Array<{
        device: string
        count: number
        duration: number
    }>
    codecs: Array<{
        codec: string
        count: number
    }>
    bitrateDistribution: Array<{
        range: string
        count: number
    }>
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#14b8a6']

export default function DevicesPage() {
    const { data, isLoading } = useQuery<DeviceStats>({
        queryKey: ['device-stats'],
        queryFn: async () => {
            const res = await fetch('/api/stats/devices')
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

    if (!data) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">加载失败</p>
            </div>
        )
    }

    const playMethodData = [
        { name: '直接播放', value: data.playbackMethod.directPlay, color: '#10b981' },
        { name: '转码', value: data.playbackMethod.transcode, color: '#f59e0b' },
    ]

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">设备分析</h1>
                <p className="text-muted-foreground">客户端、设备和转码统计</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">总会话数</CardTitle>
                        <Play className="h-4 w-4 text-violet-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.totalSessions}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">客户端类型</CardTitle>
                        <Monitor className="h-4 w-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.uniqueClients}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">独立设备</CardTitle>
                        <Smartphone className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.uniqueDevices}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">转码率</CardTitle>
                        <Zap className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.transcodingRate}%</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Playback Method */}
                <Card>
                    <CardHeader>
                        <CardTitle>播放方式</CardTitle>
                        <CardDescription>直接播放 vs 转码</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] flex items-center justify-center">
                            <ResponsiveContainer width="60%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={playMethodData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {playMethodData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                                    <span className="text-sm">直接播放</span>
                                    <span className="text-sm font-bold">{data.playbackMethod.directPlay}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                                    <span className="text-sm">转码</span>
                                    <span className="text-sm font-bold">{data.playbackMethod.transcode}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Client Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>客户端分布</CardTitle>
                        <CardDescription>各客户端使用次数</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.clients.slice(0, 6)} layout="vertical">
                                    <XAxis type="number" />
                                    <YAxis dataKey="client" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Codec and Bitrate Row */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Video Codecs */}
                <Card>
                    <CardHeader>
                        <CardTitle>视频编码</CardTitle>
                        <CardDescription>转码输出编码分布</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {data.codecs.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">暂无转码数据</p>
                        ) : (
                            <div className="space-y-3">
                                {data.codecs.slice(0, 8).map((codec, i) => {
                                    const maxCount = data.codecs[0]?.count || 1
                                    const percentage = (codec.count / maxCount) * 100
                                    return (
                                        <div key={codec.codec} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">{codec.codec.toUpperCase()}</span>
                                                <span className="text-muted-foreground">{codec.count}次</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        backgroundColor: COLORS[i % COLORS.length],
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Bitrate Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>转码比特率</CardTitle>
                        <CardDescription>转码输出比特率分布</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {data.bitrateDistribution.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">暂无转码数据</p>
                        ) : (
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.bitrateDistribution}>
                                        <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Client Details Table */}
            <Card>
                <CardHeader>
                    <CardTitle>客户端详情</CardTitle>
                    <CardDescription>各客户端的详细统计</CardDescription>
                </CardHeader>
                <CardContent>
                    {data.clients.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">暂无数据</p>
                    ) : (
                        <div className="space-y-2">
                            {data.clients.map((client, i) => (
                                <div
                                    key={client.client}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                                        <div>
                                            <p className="font-medium">{client.client}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {client.count} 次会话
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm font-medium">
                                                {Math.round(client.duration / 1000 / 60)}分钟
                                            </p>
                                            <p className="text-xs text-muted-foreground">观看时长</p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={
                                                client.transcodeRate > 50
                                                    ? 'bg-orange-500/20 text-orange-500'
                                                    : 'bg-green-500/20 text-green-500'
                                            }
                                        >
                                            {client.transcodeRate}% 转码
                                        </Badge>
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
