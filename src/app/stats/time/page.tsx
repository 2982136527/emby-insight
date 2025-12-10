'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Activity, Loader2, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { subDays, format } from 'date-fns'
import { formatDuration, ticksToHours } from '@/types/emby'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ChartTooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { UserSelector } from '@/components/user-selector'
import { ServerSelector } from '@/components/server-selector'

interface HourlyData {
    hour: number
    label: string
    duration: number
}

interface WeeklyData {
    day: number
    label: string
    shortLabel: string
    duration: number
}

interface HeatmapRow {
    day: string
    hours: Array<{
        hour: number
        duration: number
    }>
}

interface TimeData {
    hourly: HourlyData[]
    weekly: WeeklyData[]
    heatmap: HeatmapRow[]
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16']

const DAY_MAP: Record<string, string> = {
    'Sunday': '周日',
    'Monday': '周一',
    'Tuesday': '周二',
    'Wednesday': '周三',
    'Thursday': '周四',
    'Friday': '周五',
    'Saturday': '周六',
}

const getHeatmapColor = (intensity: number) => {
    if (intensity === 0) return 'color-mix(in oklch, var(--color-primary), transparent 90%)'
    if (intensity < 0.25) return 'color-mix(in oklch, var(--color-primary), transparent 75%)'
    if (intensity < 0.5) return 'color-mix(in oklch, var(--color-primary), transparent 50%)'
    if (intensity < 0.75) return 'color-mix(in oklch, var(--color-primary), transparent 25%)'
    return 'var(--color-primary)'
}

export default function TimeStatsPage() {
    const [selectedUserId, setSelectedUserId] = useState<string>()
    const [selectedServerIds, setSelectedServerIds] = useState<string[]>()
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('all')

    const getDateRange = () => {
        const now = new Date()
        switch (dateRange) {
            case '7d': return { start: subDays(now, 7), end: now }
            case '30d': return { start: subDays(now, 30), end: now }
            case '90d': return { start: subDays(now, 90), end: now }
            default: return null
        }
    }

    const { data, isLoading } = useQuery<TimeData>({
        queryKey: ['stats-time', selectedUserId, selectedServerIds, dateRange],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (selectedUserId) params.set('userId', selectedUserId)
            if (selectedServerIds?.length) params.set('serverIds', selectedServerIds.join(','))
            const range = getDateRange()
            if (range) {
                params.set('startDate', format(range.start, 'yyyy-MM-dd'))
                params.set('endDate', format(range.end, 'yyyy-MM-dd'))
            }

            const res = await fetch(`/api/stats/time?${params.toString()}`)
            if (!res.ok) throw new Error('Failed to fetch stats')
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
                <p className="text-muted-foreground">Failed to load time analysis</p>
            </div>
        )
    }

    const hourlyChartData = data.hourly.map((h) => ({
        ...h,
        hours: ticksToHours(h.duration),
        formatted: formatDuration(h.duration),
    }))

    const weeklyChartData = data.weekly.map((d) => ({
        ...d,
        hours: ticksToHours(d.duration),
        formatted: formatDuration(d.duration),
    }))

    // Find max for heatmap color scaling
    const maxHeatmapValue = Math.max(
        ...data.heatmap.flatMap((d) => d.hours.map((h) => h.duration))
    )

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 animate-fade-in">
            {/* Header */}
            <div className="flex-none flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">时段分析</h1>
                    <p className="text-sm text-muted-foreground">
                        发现您的观看习惯数据
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                            <Button
                                key={range}
                                variant={dateRange === range ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setDateRange(range)}
                                className="h-7 px-3 text-xs"
                            >
                                {range === '7d' ? '7天' : range === '30d' ? '30天' : range === '90d' ? '90天' : '全部'}
                            </Button>
                        ))}
                    </div>
                    <ServerSelector value={selectedServerIds} onChange={setSelectedServerIds} />
                    <UserSelector value={selectedUserId} onChange={setSelectedUserId} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col gap-4 min-h-0">
                {/* Top Row: Hourly & Weekly Charts - Takes 55% of available space */}
                <div className="flex-[0.55] grid md:grid-cols-2 gap-4 min-h-0">
                    {/* Hourly Chart */}
                    <Card className="flex flex-col h-full border-border/50">
                        <CardHeader className="flex-none p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Clock className="h-4 w-4" />
                                按小时统计
                            </CardTitle>
                            <CardDescription className="text-xs">观看时间分布</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-4 pt-0 min-h-0">
                            <div className="h-full w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={hourlyChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                        <XAxis
                                            dataKey="label"
                                            stroke="hsl(var(--muted-foreground))"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            interval={2}
                                        />
                                        <YAxis
                                            stroke="hsl(var(--muted-foreground))"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `${value}h`}
                                        />
                                        <ChartTooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                padding: '8px 12px',
                                            }}
                                            cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                                            formatter={(_, __, props) => {
                                                const item = hourlyChartData[props?.payload?.hour]
                                                return [item?.formatted || '0m', '时长']
                                            }}
                                        />
                                        <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                                            {hourlyChartData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Weekly Chart */}
                    <Card className="flex flex-col h-full border-border/50">
                        <CardHeader className="flex-none p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Calendar className="h-4 w-4" />
                                周观看模式
                            </CardTitle>
                            <CardDescription className="text-xs">每周活跃度</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-4 pt-0 min-h-0">
                            <div className="h-full w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={weeklyChartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                        <XAxis
                                            type="number"
                                            stroke="hsl(var(--muted-foreground))"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `${value}h`}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="shortLabel"
                                            stroke="hsl(var(--muted-foreground))"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            width={30}
                                        />
                                        <ChartTooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                padding: '8px 12px',
                                            }}
                                            cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                                            formatter={(_, __, props) => {
                                                const item = weeklyChartData.find(d => d.shortLabel === props?.payload?.shortLabel)
                                                return [item?.formatted || '0m', '时长']
                                            }}
                                        />
                                        <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                                            {weeklyChartData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Heatmap - Takes remaining space */}
                <Card className="flex-1 flex flex-col min-h-0 border-border/50">
                    <CardHeader className="flex-none p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="h-4 w-4" />
                            观看热力图
                        </CardTitle>
                        <CardDescription className="text-xs">全时段活跃分布</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 pt-0 min-h-0 pb-4 flex flex-col justify-center">
                        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
                            <div className="overflow-x-auto w-full flex-1 flex flex-col">
                                <div className="min-w-[600px] w-full flex-1 flex flex-col">
                                    {/* Hour labels */}
                                    <div className="flex mb-1 ml-10 flex-none text-muted-foreground">
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <div
                                                key={i}
                                                className="flex-1 text-[10px] text-center"
                                            >
                                                {i % 4 === 0 ? i : ''}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex-1 flex flex-col gap-1 min-h-0">
                                        <TooltipProvider delayDuration={0}>
                                            {data.heatmap.map((dayData) => (
                                                <div key={dayData.day} className="flex items-center gap-1 flex-1 min-h-0">
                                                    <div className="w-10 text-[10px] text-muted-foreground text-right pr-2 flex items-center justify-end h-full">
                                                        {DAY_MAP[dayData.day] || dayData.day}
                                                    </div>
                                                    <div className="flex flex-1 gap-[2px] h-full">
                                                        {dayData.hours.map((hourData, hourIndex) => {
                                                            const intensity = maxHeatmapValue > 0
                                                                ? hourData.duration / maxHeatmapValue
                                                                : 0
                                                            return (
                                                                <Tooltip key={hourIndex}>
                                                                    <TooltipTrigger asChild>
                                                                        <div
                                                                            className="flex-1 h-full rounded-[2px] transition-colors hover:ring-1 hover:ring-ring hover:z-10"
                                                                            style={{
                                                                                backgroundColor: intensity > 0
                                                                                    ? `color-mix(in oklch, var(--color-primary), transparent ${(1 - Math.max(0.2, intensity)) * 100}%)`
                                                                                    : 'hsl(var(--muted)/0.3)',
                                                                            }}
                                                                        />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="text-xs">
                                                                        <p className="font-semibold">
                                                                            {DAY_MAP[dayData.day]} {hourIndex}:00
                                                                        </p>
                                                                        <p>时长: {formatDuration(hourData.duration)}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </TooltipProvider>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
