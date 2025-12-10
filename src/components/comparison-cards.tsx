'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatDuration } from '@/types/emby'

interface ComparisonPeriod {
    current: {
        playDuration: number
        playCount: number
    }
    previous: {
        playDuration: number
        playCount: number
    }
    change: {
        durationPercent: number
        countPercent: number
    }
}

interface ComparisonData {
    week: ComparisonPeriod
    month: ComparisonPeriod
    today: ComparisonPeriod
}

export function ComparisonCards() {
    const { data, isLoading } = useQuery<ComparisonData>({
        queryKey: ['comparison'],
        queryFn: async () => {
            const res = await fetch('/api/stats/comparison')
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
        refetchInterval: 60000, // Refresh every minute
    })

    if (isLoading || !data) {
        return null
    }

    const renderChange = (percent: number) => {
        if (percent === 0) {
            return (
                <span className="flex items-center gap-1 text-muted-foreground">
                    <Minus className="h-3 w-3" />
                    持平
                </span>
            )
        }
        if (percent > 0) {
            return (
                <span className="flex items-center gap-1 text-green-500">
                    <ArrowUpRight className="h-3 w-3" />
                    +{percent}%
                </span>
            )
        }
        return (
            <span className="flex items-center gap-1 text-red-500">
                <ArrowDownRight className="h-3 w-3" />
                {percent}%
            </span>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* Today Comparison */}
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">今日趋势</CardTitle>
                    <Calendar className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatDuration(data.today.current.playDuration)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">时长</span>
                            {renderChange(data.today.change.durationPercent)}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">次数</span>
                            {renderChange(data.today.change.countPercent)}
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        对比昨日
                    </p>
                </CardContent>
            </Card>

            {/* Week Comparison */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">本周趋势</CardTitle>
                    {data.week.change.durationPercent >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatDuration(data.week.current.playDuration)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">时长</span>
                            {renderChange(data.week.change.durationPercent)}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">次数</span>
                            {renderChange(data.week.change.countPercent)}
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        对比上周同期
                    </p>
                </CardContent>
            </Card>

            {/* Month Comparison */}
            <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">本月趋势</CardTitle>
                    {data.month.change.durationPercent >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatDuration(data.month.current.playDuration)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">时长</span>
                            {renderChange(data.month.change.durationPercent)}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">次数</span>
                            {renderChange(data.month.change.countPercent)}
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        对比上月同期
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
