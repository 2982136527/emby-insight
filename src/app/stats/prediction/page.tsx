'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Clock, TrendingUp, User, Users, UserCog } from 'lucide-react'
import { UserSelector } from '@/components/user-selector'

interface UserPattern {
    name: string
    peakHour: number
    peakHourLabel: string
    isGlobal?: boolean
    heatmap?: Array<{
        day: number
        dayName: string
        hour: number
        hourLabel: string
        value: number
        intensity: number
    }>
}

interface PredictionData {
    heatmap: Array<{
        day: number
        dayName: string
        hour: number
        hourLabel: string
        value: number
        intensity: number
    }>
    peakHours: Array<{
        hour: number
        label: string
    }>
    prediction: {
        currentHour: number
        currentDay: number
        currentDayName: string
        nextLikelyHour: number
        nextLikelyLabel: string
    }
    userPatterns: UserPattern[]
}

export default function PredictionPage() {
    const [selectedUserId, setSelectedUserId] = useState<string>()

    const { data, isLoading, error } = useQuery<PredictionData>({
        queryKey: ['prediction', selectedUserId],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (selectedUserId) params.set('userId', selectedUserId)
            const res = await fetch(`/api/stats/prediction?${params}`)
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
        refetchInterval: 60000, // Refresh every minute
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

    // Create heatmap grid
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const hours = Array.from({ length: 24 }, (_, i) => i)

    const getIntensity = (day: number, hour: number) => {
        const cell = data.heatmap.find((h) => h.day === day && h.hour === hour)
        return cell?.intensity || 0
    }

    const getIntensityColor = (intensity: number) => {
        if (intensity === 0) return 'bg-muted/30'
        if (intensity < 0.2) return 'bg-violet-500/20'
        if (intensity < 0.4) return 'bg-violet-500/40'
        if (intensity < 0.6) return 'bg-violet-500/60'
        if (intensity < 0.8) return 'bg-violet-500/80'
        return 'bg-violet-500'
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 animate-fade-in">
            {/* Header */}
            <div className="flex-none flex items-start justify-between px-1">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Clock className="h-6 w-6 text-violet-500" />
                        观看预测
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        基于过去 7 天的观看模式分析和预测
                    </p>
                </div>
                <UserSelector value={selectedUserId} onChange={setSelectedUserId} />
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-4 min-h-0">
                    {/* Prediction Cards */}
                    <div className="flex-none grid gap-4 grid-cols-1 md:grid-cols-3">
                        <Card className="bg-gradient-to-br from-violet-500/10 to-transparent border-violet-500/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                                <CardTitle className="text-sm font-medium">现在是</CardTitle>
                                <Clock className="h-4 w-4 text-violet-500" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">
                                    {data?.prediction.currentDayName} {data?.prediction.currentHour}:00
                                </div>
                                <p className="text-xs text-muted-foreground">当前时间</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                                <CardTitle className="text-sm font-medium">预测下次观看</CardTitle>
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-emerald-500">
                                    {data?.prediction.nextLikelyLabel}
                                </div>
                                <p className="text-xs text-muted-foreground">基于历史活动预测</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                                <CardTitle className="text-sm font-medium">高峰时段</CardTitle>
                                <Clock className="h-4 w-4 text-amber-500" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="flex gap-2 flex-wrap">
                                    {data?.peakHours.slice(0, 3).map((peak) => (
                                        <Badge key={peak.hour} variant="secondary" className="text-sm">
                                            {peak.label}
                                        </Badge>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">最频繁的观看时间</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Heatmap Centerpiece */}
                    <Card className="flex-1 flex flex-col min-h-0 border-border/50">
                        <CardHeader className="flex-none p-4 pb-2 border-b">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        📊 观看时间热力图
                                    </CardTitle>
                                    <CardDescription className="text-xs">过去 7 天每小时的观看活动强度</CardDescription>
                                </div>
                                {/* Legend */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">少</span>
                                    <div className="flex gap-0.5">
                                        <div className="w-2 h-2 rounded-[1px] bg-muted/30" />
                                        <div className="w-2 h-2 rounded-[1px] bg-violet-500/20" />
                                        <div className="w-2 h-2 rounded-[1px] bg-violet-500/40" />
                                        <div className="w-2 h-2 rounded-[1px] bg-violet-500/60" />
                                        <div className="w-2 h-2 rounded-[1px] bg-violet-500" />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">多</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-2">
                            {/* Hour Labels */}
                            <div className="flex mb-1 ml-8">
                                {hours.map((hour) => (
                                    <div key={hour} className="flex-1 text-center">
                                        {hour % 2 === 0 && (
                                            <span className="text-[10px] text-muted-foreground">{hour}</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Heatmap Rows */}
                            <div className="flex-1 flex flex-col min-h-0 gap-1">
                                {days.map((dayName, dayIndex) => (
                                    <div key={dayName} className="flex-1 flex items-center gap-2 min-h-0">
                                        <div className="w-6 text-xs text-muted-foreground text-right shrink-0">
                                            {dayName}
                                        </div>
                                        <div className="flex-1 h-full flex gap-1">
                                            {hours.map((hour) => {
                                                const intensity = getIntensity(dayIndex, hour)
                                                return (
                                                    <div
                                                        key={`${dayIndex}-${hour}`}
                                                        className={`flex-1 h-full rounded-sm transition-all hover:opacity-80 cursor-default ${getIntensityColor(intensity)}`}
                                                        title={`${dayName} ${hour}:00 - 活动强度: ${Math.round(intensity * 100)}%`}
                                                    />
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* User Patterns Footer */}
                    <Card className="flex-none border-border/50">
                        <CardHeader className="p-3 pb-0">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <User className="h-4 w-4" />
                                用户观看习惯
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                            <div className="flex flex-wrap gap-2 max-h-[60px] overflow-y-auto">
                                {data?.userPatterns.map((user, idx) => (
                                    <div
                                        key={`${user.name}-${idx}`}
                                        className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs ${user.isGlobal ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-muted/30'
                                            }`}
                                    >
                                        {user.isGlobal ? (
                                            <UserCog className="h-3 w-3 text-violet-500" />
                                        ) : (
                                            <User className="h-3 w-3 text-cyan-500" />
                                        )}
                                        <span className="font-medium truncate max-w-[80px]">{user.name}</span>
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                            {user.peakHourLabel}
                                        </Badge>
                                    </div>
                                ))}
                                {data?.userPatterns.length === 0 && (
                                    <p className="text-xs text-muted-foreground pl-1">暂无用户数据</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
