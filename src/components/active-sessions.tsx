'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Pause, Tv, Timer } from 'lucide-react'
import { ticksToHours, formatDuration } from '@/types/emby'

interface ActiveSession {
    id: string
    serverId: string
    serverName: string
    username: string
    deviceName: string
    deviceId?: string
    client: string
    clientVersion?: string
    item: {
        id: string
        name: string
        type: string
        seriesName?: string
        seasonName?: string
        episodeIndex?: number
        seasonIndex?: number
        runTimeTicks: number
        width?: number
        height?: number
    }
    playState: {
        positionTicks: number
        isPaused: boolean
        playMethod?: string // DirectPlay, DirectStream, Transcode
    }
    transcoding?: {
        isTranscoding: boolean
        videoCodec?: string | null
        audioCodec?: string | null
        bitrate?: number | null
        width?: number | null
        height?: number | null
        reasons?: string[] | null
        completionPercentage?: number | null
    }
    startedAt?: string
}

export function ActiveSessions() {
    const { data: sessions, isLoading, error, refetch } = useQuery<ActiveSession[]>({
        queryKey: ['active-sessions'],
        queryFn: async () => {
            const res = await fetch('/api/session/live')
            if (!res.ok) throw new Error('Failed to fetch sessions')
            return res.json()
        },
        refetchInterval: 5000, // Poll every 5 seconds
        retry: 3, // 自动重试3次
        retryDelay: 1000, // 重试间隔1秒
        staleTime: 0, // 始终重新获取
    })

    // 实时计算观看时间 - hooks 必须在条件返回之前
    const [now, setNow] = useState(Date.now())
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    const formatRealDuration = (startedAt?: string) => {
        if (!startedAt) return '0m'
        const ms = now - new Date(startedAt).getTime()
        const totalSeconds = Math.floor(ms / 1000)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        if (hours > 0) return `${hours}h ${minutes}m`
        if (minutes > 0) return `${minutes}m ${seconds}s`
        return `${seconds}s`
    }

    if (isLoading && !sessions) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error && !sessions) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <p className="text-muted-foreground">加载失败</p>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    重试
                </button>
            </div>
        )
    }

    if (!sessions || sessions.length === 0) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Tv className="h-5 w-5 mr-2" />
                暂无活跃会话
            </div>
        )
    }

    // 按会话 ID 排序，保持卡片位置稳定
    const sortedSessions = [...sessions].sort((a, b) => a.id.localeCompare(b.id))

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in pb-6">
            {sortedSessions.map((session, index) => {
                const progress = (session.playState.positionTicks / session.item.runTimeTicks) * 100
                const backdropUrl = `/api/image?serverId=${session.serverId}&itemId=${session.item.id}&type=Backdrop`
                const posterUrl = `/api/image?serverId=${session.serverId}&itemId=${session.item.id}&type=Primary`
                const realDuration = formatRealDuration(session.startedAt)

                return (
                    <div
                        key={`${session.id}-${index}`}
                        className="group relative overflow-hidden rounded-xl border bg-background/95 shadow-lg transition-all hover:shadow-xl"
                    >
                        {/* Background Image with Blur */}
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                            style={{ backgroundImage: `url(${backdropUrl})` }}
                        />
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

                        <div className="relative p-4 flex gap-4">
                            {/* Poster */}
                            <div className="w-20 h-28 shrink-0 rounded-md overflow-hidden shadow-md border border-white/10 bg-black/40">
                                <img
                                    src={posterUrl}
                                    alt={session.item.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 text-white flex flex-col justify-between py-0.5">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-md text-[10px] h-5">
                                                {session.username}
                                            </Badge>
                                            <Badge variant="outline" className="bg-black/40 text-white border-white/10 backdrop-blur-md text-[9px] px-1.5 h-5 border-none">
                                                {session.serverName}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-1.5 text-xs text-white/70">
                                                {session.playState.isPaused ? (
                                                    <Pause className="h-3 w-3" />
                                                ) : (
                                                    <Play className="h-3 w-3 animate-pulse text-green-400" />
                                                )}
                                                <span className="truncate max-w-[80px]" title={session.deviceName}>{session.deviceName}</span>
                                            </div>
                                            <span className="text-[9px] text-white/50">{session.client}</span>
                                        </div>
                                    </div>

                                    <h3 className="font-semibold leading-tight truncate text-shadow-sm">
                                        {session.item.seriesName ? (
                                            <>
                                                <span className="opacity-90">{session.item.seriesName}</span>
                                                <span className="mx-1 opacity-50">S{session.item.seasonIndex}E{session.item.episodeIndex}</span>
                                            </>
                                        ) : (
                                            session.item.name
                                        )}
                                    </h3>
                                    {session.item.seriesName && (
                                        <p className="text-xs text-white/70 truncate mt-0.5">
                                            {session.item.name}
                                        </p>
                                    )}
                                </div>

                                {/* Progress */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] text-white/80 font-mono">
                                        <span>{formatDuration(Number(session.playState.positionTicks))}</span>
                                        <span className="flex items-center gap-1 text-cyan-300">
                                            <Timer className="h-3 w-3" />
                                            {realDuration}
                                        </span>
                                        <span>{formatDuration(Number(session.item.runTimeTicks))}</span>
                                    </div>
                                    <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-linear ${session.playState.isPaused ? 'bg-yellow-400' : 'bg-green-400'}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    {/* Playback Info */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {/* Play Method */}
                                        {session.playState.playMethod && (
                                            <Badge
                                                variant="outline"
                                                className={`text-[8px] h-4 px-1 border-none ${session.playState.playMethod === 'DirectPlay'
                                                    ? 'bg-green-500/30 text-green-300'
                                                    : session.playState.playMethod === 'Transcode'
                                                        ? 'bg-orange-500/30 text-orange-300'
                                                        : 'bg-blue-500/30 text-blue-300'
                                                    }`}
                                            >
                                                {session.playState.playMethod === 'DirectPlay' ? '直接播放' :
                                                    session.playState.playMethod === 'Transcode' ? '转码' : '直接串流'}
                                            </Badge>
                                        )}
                                        {/* Transcoding Bitrate */}
                                        {session.transcoding?.isTranscoding && session.transcoding.bitrate && (
                                            <Badge variant="outline" className="text-[8px] h-4 px-1 border-none bg-orange-500/20 text-orange-200">
                                                {session.transcoding.bitrate > 1000
                                                    ? `${(session.transcoding.bitrate / 1000).toFixed(1)} Mbps`
                                                    : `${session.transcoding.bitrate} Kbps`}
                                            </Badge>
                                        )}
                                        {/* Video Codec */}
                                        {session.transcoding?.videoCodec && (
                                            <Badge variant="outline" className="text-[8px] h-4 px-1 border-none bg-white/10 text-white/70">
                                                {session.transcoding.videoCodec.toUpperCase()}
                                            </Badge>
                                        )}
                                        {/* Resolution */}
                                        {(() => {
                                            const width = session.transcoding?.width || session.item.width
                                            const height = session.transcoding?.height || session.item.height
                                            if (width && height) {
                                                const label = height >= 2160 ? '4K' : height >= 1080 ? '1080p' : height >= 720 ? '720p' : `${height}p`
                                                return (
                                                    <Badge variant="outline" className="text-[8px] h-4 px-1 border-none bg-purple-500/20 text-purple-200">
                                                        {label}
                                                    </Badge>
                                                )
                                            }
                                            return null
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
