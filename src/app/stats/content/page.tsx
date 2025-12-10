'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Film, Tv, Loader2, Clapperboard, Monitor } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDuration, ticksToHours } from '@/types/emby'
import { UserSelector } from '@/components/user-selector'
import { ServerSelector } from '@/components/server-selector'
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts'

interface ContentData {
    genres: Array<{ genre: string; duration: number }>
    itemTypes: Array<{ type: string; duration: number; count: number }>
    resolutions: Array<{ resolution: string; duration: number; count: number }>
    hdr: Array<{ type: string; duration: number; count: number }>
    years: Array<{ year: number | null; duration: number; count: number }>
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16']
const TYPE_ICONS: Record<string, React.ReactNode> = {
    Movie: <Film className="h-4 w-4" />,
    Episode: <Tv className="h-4 w-4" />,
    Series: <Clapperboard className="h-4 w-4" />,
}

export default function ContentAnalysisPage() {
    const [selectedUserId, setSelectedUserId] = useState<string>()
    const [selectedServerIds, setSelectedServerIds] = useState<string[]>()

    const { data, isLoading } = useQuery<ContentData>({
        queryKey: ['stats', 'content', selectedUserId, selectedServerIds],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (selectedUserId) params.set('userId', selectedUserId)
            if (selectedServerIds?.length) params.set('serverIds', selectedServerIds.join(','))

            const res = await fetch(`/api/stats/content?${params.toString()}`)
            if (!res.ok) throw new Error('Failed to fetch content stats')
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
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">Failed to load content analysis</p>
            </div>
        )
    }

    const genreChartData = data.genres.map((g) => ({
        ...g,
        hours: ticksToHours(g.duration),
        formatted: formatDuration(g.duration),
    }))

    const typeChartData = data.itemTypes.map((t) => ({
        name: t.type,
        value: t.count,
        duration: t.duration,
        hours: ticksToHours(t.duration),
    }))

    const resolutionChartData = data.resolutions.map((r) => ({
        name: r.resolution,
        value: r.count,
        duration: r.duration,
    }))

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-2 animate-fade-in">
            {/* Header */}
            <div className="flex-none flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">内容分析</h1>
                    <p className="text-sm text-muted-foreground">
                        探索您最常观看的内容类型
                    </p>
                </div>
                {/* Selectors */}
                <div className="flex items-center gap-2">
                    <ServerSelector value={selectedServerIds} onChange={setSelectedServerIds} />
                    <UserSelector value={selectedUserId} onChange={setSelectedUserId} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col gap-4 min-h-0">
                {/* Top Row: Media Type & Resolution - Takes ~40% of available space */}
                <div className="flex-[0.55] grid gap-4 lg:grid-cols-2 min-h-0">
                    {/* Media Type Distribution */}
                    <Card className="flex flex-col h-full border-border/50">
                        <CardHeader className="flex-none p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Film className="h-4 w-4" />
                                媒体类型
                            </CardTitle>
                            <CardDescription className="text-xs">电影与剧集占比</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-4 pt-0 min-h-0 relative">
                            <div className="h-full w-full min-h-0">
                                {typeChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={typeChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius="45%"
                                                outerRadius="75%"
                                                paddingAngle={5}
                                                dataKey="value"
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                label={(props: any) =>
                                                    `${props.name}`
                                                }
                                                labelLine={false}
                                                style={{ fontSize: '14px', fontWeight: 500 }}
                                            >
                                                {typeChartData.map((_, index) => (
                                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--card))',
                                                    border: '1px solid hsl(var(--border))',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    padding: '8px 12px',
                                                }}
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                formatter={(value: number, name: string, props: any) => [
                                                    `${value} (${formatDuration(props.payload.duration)})`,
                                                    name,
                                                ]}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                        暂无数据
                                    </div>
                                )}
                            </div>
                            <div className="absolute bottom-3 left-0 right-0 flex flex-wrap gap-2 justify-center pointer-events-none">
                                {data.itemTypes.map((type, index) => (
                                    <Badge
                                        key={type.type}
                                        variant="outline"
                                        className="flex items-center gap-1.5 px-2.5 py-0.5 text-xs h-6 bg-background/80 backdrop-blur-sm shadow-sm"
                                        style={{ borderColor: COLORS[index % COLORS.length] }}
                                    >
                                        {TYPE_ICONS[type.type] || <Film className="h-3.5 w-3.5" />}
                                        {type.type}: {type.count}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Resolution Distribution */}
                    <Card className="flex flex-col h-full border-border/50">
                        <CardHeader className="flex-none p-4 pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Monitor className="h-4 w-4" />
                                        画质分布
                                    </CardTitle>
                                    <CardDescription className="text-xs">分辨率占比</CardDescription>
                                </div>
                                <div className="flex gap-1.5 transform origin-right">
                                    {data.hdr.map((item) => (
                                        <Badge
                                            key={item.type}
                                            variant={item.type === 'HDR' ? 'default' : 'secondary'}
                                            className="px-2 py-0.5 text-xs h-5"
                                        >
                                            {item.type}: {item.count}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-4 pt-0 min-h-0">
                            <div className="h-full w-full min-h-0">
                                {resolutionChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={resolutionChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius="45%"
                                                outerRadius="75%"
                                                paddingAngle={5}
                                                dataKey="value"
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                label={(props: any) =>
                                                    `${props.name}`
                                                }
                                                labelLine={false}
                                                style={{ fontSize: '14px', fontWeight: 500 }}
                                            >
                                                {resolutionChartData.map((_, index) => (
                                                    <Cell key={index} fill={COLORS[(index + 2) % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--card))',
                                                    border: '1px solid hsl(var(--border))',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    padding: '8px 12px',
                                                }}
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                formatter={(value: number, name: string, props: any) => [
                                                    `${value} (${formatDuration(props.payload.duration)})`,
                                                    name,
                                                ]}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                        暂无数据
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Bottom Row: Genres - Takes remaining space */}
                <Card className="flex-1 flex flex-col min-h-0 border-border/50">
                    <CardHeader className="flex-none p-4 pb-2">
                        <CardTitle className="text-base">类型分布</CardTitle>
                        <CardDescription className="text-xs">观看最多的影视类型</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 pt-0 min-h-0 pb-6">
                        <div className="h-full w-full min-h-0">
                            {genreChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={genreChartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                        <XAxis
                                            type="number"
                                            stroke="hsl(var(--muted-foreground))"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `${value}h`}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="genre"
                                            stroke="hsl(var(--muted-foreground))"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            width={80}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                padding: '8px 12px',
                                            }}
                                            cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                                            formatter={(_, __, props) => {
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                const item = genreChartData.find((g: any) => g.genre === props?.payload?.genre)
                                                return [item?.formatted || '0m', '观看时长']
                                            }}
                                        />
                                        <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={28}>
                                            {genreChartData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                    暂无类型数据
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
