'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, Loader2, Clock, Play, Film, Tv } from 'lucide-react'
import { formatDuration } from '@/types/emby'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { UserSelector } from '@/components/user-selector'

interface CalendarDay {
    date: string
    duration: number
    hours: number
    count: number
    userCount?: number
    items: Array<{ name: string; type: string; seriesName?: string; serverId: string; itemId: string }>
}

interface CalendarData {
    month: string
    days: CalendarDay[]
    summary: {
        totalDuration: number
        totalCount: number
        activeDays: number
        avgDailyHours: number
    }
}

export default function CalendarPage() {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedUserId, setSelectedUserId] = useState<string>()

    const monthStr = format(currentMonth, 'yyyy-MM')

    const { data, isLoading } = useQuery<CalendarData>({
        queryKey: ['calendar', monthStr, selectedUserId],
        queryFn: async () => {
            const params = new URLSearchParams({ month: monthStr })
            if (selectedUserId) params.set('userId', selectedUserId)
            const res = await fetch(`/api/stats/calendar?${params}`)
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
    })

    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDayOfMonth = getDay(startOfMonth(currentMonth))

    // Create calendar grid
    const calendarDays: (CalendarDay | null)[] = []
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(null) // Empty cells before month starts
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${monthStr}-${day.toString().padStart(2, '0')}`
        const dayData = data?.days.find(d => d.date === dateStr)
        calendarDays.push(dayData || { date: dateStr, duration: 0, hours: 0, count: 0, userCount: 0, items: [] })
    }

    const getIntensityColor = (hours: number) => {
        if (hours === 0) return 'bg-muted/30'
        if (hours < 1) return 'bg-violet-500/20 border-violet-500/30'
        if (hours < 2) return 'bg-violet-500/40 border-violet-500/50'
        if (hours < 4) return 'bg-violet-500/60 border-violet-500/70'
        return 'bg-violet-500 border-violet-600 text-white'
    }

    const totalWeeks = Math.ceil(calendarDays.length / 7)

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 animate-fade-in">
            {/* Header */}
            <div className="flex-none flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
                <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-violet-500" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">观看日历</h1>
                        <p className="text-sm text-muted-foreground">按日查看观看活动</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <UserSelector value={selectedUserId} onChange={setSelectedUserId} />
                </div>
            </div>

            {/* Main Content */}
            <Card className="flex-1 flex flex-col min-h-0 border-border/50">
                <CardHeader className="flex-none flex flex-row items-center justify-between py-2 px-4 border-b">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="h-8 w-8"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-xl font-bold">
                        {format(currentMonth, 'yyyy年 M月', { locale: zhCN })}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="h-8 w-8"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-4 gap-4">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {/* Summary Stats */}
                            <div className="flex-none grid grid-cols-4 gap-4">
                                <div className="text-center p-2 bg-muted/30 rounded-lg">
                                    <p className="text-2xl font-bold">{data?.summary.activeDays || 0}</p>
                                    <p className="text-xs text-muted-foreground">活跃天数</p>
                                </div>
                                <div className="text-center p-2 bg-muted/30 rounded-lg">
                                    <p className="text-2xl font-bold">{data?.summary.totalCount || 0}</p>
                                    <p className="text-xs text-muted-foreground">播放次数</p>
                                </div>
                                <div className="text-center p-2 bg-muted/30 rounded-lg">
                                    <p className="text-xl font-bold">
                                        {Math.round((data?.summary.totalDuration || 0) / 10000000 / 3600)}h
                                    </p>
                                    <p className="text-xs text-muted-foreground">总时长</p>
                                </div>
                                <div className="text-center p-2 bg-muted/30 rounded-lg">
                                    <p className="text-xl font-bold">{data?.summary.avgDailyHours || 0}h</p>
                                    <p className="text-xs text-muted-foreground">日均</p>
                                </div>
                            </div>

                            {/* Calendar Area */}
                            <div className="flex-1 flex flex-col min-h-0">
                                {/* Day headers */}
                                <div className="grid grid-cols-7 gap-1 mb-1">
                                    {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                                        <div key={day} className="text-center text-sm font-medium text-muted-foreground">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar Grid */}
                                <div
                                    className="flex-1 grid grid-cols-7 gap-1 min-h-0"
                                    style={{ gridTemplateRows: `repeat(${totalWeeks}, minmax(0, 1fr))` }}
                                >
                                    <TooltipProvider delayDuration={0}>
                                        {calendarDays.map((day, index) => (
                                            <Tooltip key={index}>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className={`w-full h-full rounded-md border flex flex-col items-center justify-center p-1 cursor-default transition-all hover:ring-2 hover:ring-primary/50 hover:z-10 relative overflow-hidden ${day ? getIntensityColor(day.hours) : 'bg-muted/5 border-transparent'
                                                            }`}
                                                    >
                                                        {day && (
                                                            <>
                                                                <span className="text-lg font-bold absolute top-1 left-2 opacity-90">
                                                                    {parseInt(day.date.split('-')[2])}
                                                                </span>
                                                                {day.hours > 0 && (
                                                                    <div className="flex flex-col items-center justify-center h-full pt-4">
                                                                        <span className="text-sm font-bold tracking-tight">{day.hours}h</span>
                                                                        <span className="text-[10px] opacity-75 hidden sm:inline-block">
                                                                            {day.count}次
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                {day && day.count > 0 && (
                                                    <TooltipContent className="max-w-[250px] z-50">
                                                        <p className="font-medium text-base mb-1">{format(new Date(day.date), 'M月d日')}</p>
                                                        <div className="text-xs mb-2 pb-2 border-b border-border/50">
                                                            <span className="font-bold">{day.hours}小时</span>观看 · <span className="font-bold">{day.count}次</span>播放
                                                            {day.userCount && day.userCount > 0 && ` · ${day.userCount}位用户`}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {day.items.slice(0, 5).map((item, i) => (
                                                                <div key={i} className="flex items-center gap-2 text-xs">
                                                                    {item.type === 'Movie' ? (
                                                                        <Film className="h-3 w-3 flex-none text-blue-400" />
                                                                    ) : (
                                                                        <Tv className="h-3 w-3 flex-none text-green-400" />
                                                                    )}
                                                                    <span className="truncate">{item.seriesName || item.name}</span>
                                                                </div>
                                                            ))}
                                                            {day.items.length > 5 && (
                                                                <div className="text-[10px] text-muted-foreground text-center pt-1">
                                                                    还有 {day.items.length - 5} 个...
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                        ))}
                                    </TooltipProvider>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
