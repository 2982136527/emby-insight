'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Flame, Clock, Tv, Trophy, Loader2, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserSelector } from '@/components/user-selector'
import Link from 'next/link'

interface MarathonSession {
    date: string
    startTime: string
    endTime: string
    duration: number
    episodes: number
    seriesName: string
    userName: string
    userId: string
}

interface MarathonData {
    marathons: MarathonSession[]
    stats: {
        totalMarathons: number
        totalHours: number
        avgDuration: number
        longestMarathon: MarathonSession | null
    }
}

export default function MarathonPage() {
    const [selectedUserId, setSelectedUserId] = useState<string>()

    const { data, isLoading } = useQuery<MarathonData>({
        queryKey: ['marathon', selectedUserId],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (selectedUserId) params.set('userId', selectedUserId)
            const res = await fetch(`/api/stats/marathon?${params}`)
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
    })

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 animate-fade-in">
            {/* Header */}
            <div className="flex-none flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Flame className="h-6 w-6 text-orange-500" />
                        观看马拉松
                    </h1>
                    <p className="text-sm text-muted-foreground">检测连续观看同一剧集3小时以上的记录</p>
                </div>
                <UserSelector value={selectedUserId} onChange={setSelectedUserId} />
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-4 min-h-0">
                    {/* Stats Cards */}
                    <div className="flex-none grid gap-4 grid-cols-2 md:grid-cols-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-2xl md:text-3xl font-bold text-orange-500">
                                    {data?.stats.totalMarathons || 0}
                                </div>
                                <p className="text-xs text-muted-foreground">马拉松次数</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-2xl md:text-3xl font-bold">
                                    {data?.stats.totalHours || 0}h
                                </div>
                                <p className="text-xs text-muted-foreground">总时长</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-2xl md:text-3xl font-bold">
                                    {data?.stats.avgDuration || 0}h
                                </div>
                                <p className="text-xs text-muted-foreground">平均时长</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-2xl md:text-3xl font-bold text-primary">
                                    {data?.stats.longestMarathon?.duration || 0}h
                                </div>
                                <p className="text-xs text-muted-foreground">最长记录</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Longest Marathon Highlight */}
                    {data?.stats.longestMarathon && (
                        <Card className="flex-none bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30">
                            <CardHeader className="p-4 pb-2">
                                <div className="flex items-center gap-2">
                                    <Trophy className="h-4 w-4 text-yellow-500" />
                                    <CardTitle className="text-base">最长马拉松记录</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div>
                                        <p className="text-xl font-bold">{data.stats.longestMarathon.seriesName}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {data.stats.longestMarathon.episodes}集 · {data.stats.longestMarathon.duration}小时
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                        {data.stats.longestMarathon.date}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                        {data.stats.longestMarathon.startTime} - {data.stats.longestMarathon.endTime}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Marathon List */}
                    <Card className="flex-1 flex flex-col min-h-0 border-border/50">
                        <CardHeader className="flex-none p-4 pb-2 border-b">
                            <CardTitle className="text-base">马拉松记录</CardTitle>
                            <CardDescription className="text-xs">按时长排序的所有马拉松观看记录</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 overflow-y-auto p-0">
                            {data?.marathons.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <Flame className="h-12 w-12 mb-4 opacity-50" />
                                    <p>暂无马拉松记录</p>
                                    <p className="text-sm">连续观看3集以上且3小时以上才算马拉松</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {data?.marathons.map((marathon, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-4 p-3 hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 font-bold text-sm shrink-0">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Tv className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <p className="font-medium truncate text-sm">{marathon.seriesName}</p>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <User className="h-3 w-3" />
                                                    <Link
                                                        href={`/users/${marathon.userId}`}
                                                        className="hover:underline"
                                                    >
                                                        {marathon.userName}
                                                    </Link>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="font-semibold text-sm">{marathon.duration}h</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {marathon.episodes}集
                                                </p>
                                            </div>
                                            <div className="text-right text-xs text-muted-foreground shrink-0 w-24">
                                                <p>{marathon.date}</p>
                                                <p className="opacity-75">{marathon.startTime} - {marathon.endTime}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
