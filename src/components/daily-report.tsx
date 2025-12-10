'use client'

import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { FileImage, Download, Loader2, Play, Clock, Users, Film, TrendingUp, Tv, Sparkles } from 'lucide-react'
import { formatDuration } from '@/types/emby'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import html2canvas from 'html2canvas'

interface DailyStats {
    date: string
    summary: {
        totalDuration: number
        totalItems: number
        uniqueUsers: number
        totalSessions: number
        peakHour: string
        durationTrend: number
    }
    topUsers: Array<{ name: string; duration: number; count: number; items: string[] }>
    topItems: Array<{ name: string; type: string; duration: number; count: number }>
    topGenres: Array<{ genre: string; duration: number }>
    topClients: Array<{ client: string; count: number }>
    quality: {
        hdrCount: number
        count4k: number
        count1080p: number
        total: number
    }
    hourlyData: number[]
    recentItems: Array<{ name: string; type: string; user: string; duration: number; playedAt: string }>
}

export function DailyReportButton() {
    const [open, setOpen] = useState(false)
    const [exporting, setExporting] = useState(false)
    const reportRef = useRef<HTMLDivElement>(null)

    const { data, isLoading } = useQuery<DailyStats>({
        queryKey: ['daily-report'],
        queryFn: async () => {
            const res = await fetch('/api/stats/daily')
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
        enabled: open,
    })

    const handleExport = async () => {
        if (!reportRef.current) return
        setExporting(true)

        try {
            const canvas = await html2canvas(reportRef.current, {
                backgroundColor: null, // Respect CSS background
                scale: 2,
                useCORS: true,
                logging: false,
            })

            const link = document.createElement('a')
            link.download = `emby-daily-report-${format(new Date(), 'yyyy-MM-dd')}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        } catch (error) {
            console.error('Export failed:', error)
        } finally {
            setExporting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <FileImage className="h-4 w-4" />
                    当日报告
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
                <DialogHeader className="p-4 pb-2">
                    <DialogTitle>当日观影报告</DialogTitle>
                    <div className="flex justify-end pt-2">
                        <Button
                            size="sm"
                            onClick={handleExport}
                            disabled={exporting || isLoading || !data}
                            className="gap-2"
                        >
                            {exporting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            导出图片
                        </Button>
                    </div>
                </DialogHeader>

                {isLoading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {data && (
                    <div
                        ref={reportRef}
                        className="bg-background p-6 text-foreground min-h-[600px]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-8">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl font-bold tracking-tight">每日观影报告</h2>
                                    <Badge variant="outline" className="font-normal text-xs">
                                        EmbyInsight
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    {format(new Date(data.date), 'yyyy年M月d日 EEEE', { locale: zhCN })}
                                </p>
                            </div>
                            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <TrendingUp className="h-6 w-6" />
                            </div>
                        </div>

                        {/* Main Stats */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20 rounded-xl p-4 relative overflow-hidden">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-md bg-violet-500/10">
                                        <Clock className="h-4 w-4 text-violet-500" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">观看时长</span>
                                </div>
                                <div className="text-2xl font-bold tabular-nums">
                                    {formatDuration(data.summary.totalDuration)}
                                </div>
                                {data.summary.durationTrend !== 0 && (
                                    <div className={`text-[10px] font-medium mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${data.summary.durationTrend > 0
                                        ? 'bg-green-500/10 text-green-600'
                                        : 'bg-red-500/10 text-red-600'
                                        }`}>
                                        {data.summary.durationTrend > 0 ? '↑' : '↓'}
                                        {Math.abs(data.summary.durationTrend).toFixed(1)}%
                                    </div>
                                )}
                            </div>

                            <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-md bg-cyan-500/10">
                                        <Play className="h-4 w-4 text-cyan-500" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">播放次数</span>
                                </div>
                                <div className="flex items-end justify-between">
                                    <div className="text-2xl font-bold tabular-nums">
                                        {data.summary.totalItems}
                                    </div>
                                    {data.quality && (
                                        <div className="flex gap-1 mb-1">
                                            {data.quality.count4k > 0 && (
                                                <Badge variant="secondary" className="text-[9px] px-1 h-4">4K</Badge>
                                            )}
                                            {data.quality.hdrCount > 0 && (
                                                <Badge variant="secondary" className="text-[9px] px-1 h-4">HDR</Badge>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-md bg-emerald-500/10">
                                        <Users className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">活跃用户</span>
                                </div>
                                <div className="text-2xl font-bold tabular-nums">
                                    {data.summary.uniqueUsers}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-md bg-amber-500/10">
                                        <TrendingUp className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">高峰时段</span>
                                </div>
                                <div className="text-2xl font-bold tabular-nums">
                                    {data.summary.peakHour}
                                </div>
                            </div>
                        </div>

                        {/* Top Users & Items */}
                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    活跃用户
                                </h3>
                                <div className="space-y-3">
                                    {data.topUsers.slice(0, 5).map((user, i) => (
                                        <div key={user.name} className="flex items-center justify-between text-sm group">
                                            <div className="flex items-center gap-3">
                                                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${i === 0 ? 'bg-yellow-500/10 text-yellow-600' :
                                                    i === 1 ? 'bg-zinc-500/10 text-zinc-600' :
                                                        i === 2 ? 'bg-orange-500/10 text-orange-600' :
                                                            'bg-muted text-muted-foreground'
                                                    }`}>
                                                    {i + 1}
                                                </span>
                                                <span className="font-medium group-hover:text-primary transition-colors">{user.name}</span>
                                            </div>
                                            <span className="text-muted-foreground tabular-nums text-xs">
                                                {formatDuration(user.duration)}
                                            </span>
                                        </div>
                                    ))}
                                    {data.topUsers.length === 0 && (
                                        <div className="text-center py-4 text-xs text-muted-foreground">暂无数据</div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <Film className="h-4 w-4" />
                                    热门内容
                                </h3>
                                <div className="space-y-3">
                                    {data.topItems.slice(0, 5).map((item, i) => (
                                        <div key={`${item.name}-${i}`} className="flex items-center justify-between text-sm group">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${i === 0 ? 'bg-yellow-500/10 text-yellow-600' :
                                                    i === 1 ? 'bg-zinc-500/10 text-zinc-600' :
                                                        i === 2 ? 'bg-orange-500/10 text-orange-600' :
                                                            'bg-muted text-muted-foreground'
                                                    }`}>
                                                    {i + 1}
                                                </span>
                                                <span className="font-medium truncate group-hover:text-primary transition-colors">{item.name}</span>
                                            </div>
                                            <span className="text-muted-foreground tabular-nums text-xs shrink-0 ml-2">
                                                {item.count}次
                                            </span>
                                        </div>
                                    ))}
                                    {data.topItems.length === 0 && (
                                        <div className="text-center py-4 text-xs text-muted-foreground">暂无数据</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Top Clients - New Section */}
                        {data.topClients && data.topClients.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                    <Tv className="h-4 w-4" />
                                    客户端分布
                                </h3>
                                <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-2 gap-4">
                                    {data.topClients.slice(0, 4).map((client) => {
                                        const percent = Math.round((client.count / data.summary.totalSessions) * 100) || 0
                                        return (
                                            <div key={client.client} className="flex items-center justify-between text-xs">
                                                <span className="font-medium truncate mr-2">{client.client}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${percent}%` }} />
                                                    </div>
                                                    <span className="text-muted-foreground tabular-nums w-8 text-right">{percent}%</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Hourly Chart */}
                        <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                时段分布
                            </h3>
                            <div className="h-24 flex items-end gap-1 pt-1">
                                {data.hourlyData.map((value, hour) => {
                                    const maxValue = Math.max(...data.hourlyData, 1)
                                    const height = (value / maxValue) * 100
                                    return (
                                        <div
                                            key={hour}
                                            className="group flex-1 flex flex-col justify-end gap-1 h-full"
                                            title={`${hour}:00 - ${formatDuration(value)}`}
                                        >
                                            <div
                                                className="w-full bg-primary/20 rounded-t-sm transition-all group-hover:bg-primary/50"
                                                style={{ height: `${Math.max(height, 5)}%`, opacity: height > 0 ? 1 : 0.3 }}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
                                <span>00:00</span>
                                <span>06:00</span>
                                <span>12:00</span>
                                <span>18:00</span>
                                <span>23:59</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-6 border-t border-border/50 text-[10px] text-muted-foreground">
                            <div className="flex gap-4">
                                <span>EmbyInsight 每日报告</span>
                                <span>{data.quality?.count4k > 0 ? `✨ 4K: ${data.quality.count4k}` : ''}</span>
                            </div>
                            <span>{format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</span>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
