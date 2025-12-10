'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { Trophy, Users, Film, Server, Loader2, Medal, Tv } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { formatDuration } from '@/types/emby'

interface UserLeaderboard {
    type: 'users'
    data: Array<{
        id: string
        name: string
        serverName: string
        totalDuration: number
        totalPlays: number
    }>
}

interface MediaLeaderboard {
    type: 'media'
    data: Array<{
        itemId: string
        itemName: string
        imageUrl: string | null
        itemType: string
        seriesName: string | null
        totalDuration: number
        totalPlays: number
        watchedBy: string[]
        serverId?: string
    }>
}

interface ServerLeaderboard {
    type: 'servers'
    data: Array<{
        serverId: string
        serverName: string
        totalDuration: number
        totalPlays: number
    }>
}

type LeaderboardData = UserLeaderboard | MediaLeaderboard | ServerLeaderboard

const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

export default function LeaderboardPage() {
    const [activeTab, setActiveTab] = useState<'users' | 'media' | 'servers'>('users')
    const [selectedServerId, setSelectedServerId] = useState<string>('all')

    // Fetch servers for filtering
    const { data: serversData } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['servers-list'],
        queryFn: async () => {
            const res = await fetch('/api/servers')
            if (!res.ok) throw new Error('Failed to fetch servers')
            return res.json()
        },
    })

    const { data, isLoading } = useQuery<LeaderboardData>({
        queryKey: ['leaderboard', activeTab, selectedServerId],
        queryFn: async () => {
            const params = new URLSearchParams({ type: activeTab })
            if (selectedServerId && selectedServerId !== 'all') {
                params.set('serverId', selectedServerId)
            }
            const res = await fetch(`/api/stats/leaderboard?${params}`)
            if (!res.ok) throw new Error('Failed to fetch leaderboard')
            return res.json()
        },
    })

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 animate-fade-in p-1">
            {/* Header */}
            <div className="flex-none flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-yellow-500" />
                        排行榜
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        谁观看得最多？
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {activeTab !== 'servers' && (
                        <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                            <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
                                <SelectValue placeholder="选择服务器" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">所有服务器</SelectItem>
                                {serversData?.map((server) => (
                                    <SelectItem key={server.id} value={server.id}>
                                        {server.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full sm:w-auto">
                        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex h-8">
                            <TabsTrigger value="users" className="flex items-center justify-center gap-2 text-xs">
                                <Users className="h-3 w-3" />
                                <span className="hidden sm:inline">用户</span>
                            </TabsTrigger>
                            <TabsTrigger value="media" className="flex items-center justify-center gap-2 text-xs">
                                <Film className="h-3 w-3" />
                                <span className="hidden sm:inline">媒体</span>
                            </TabsTrigger>
                            <TabsTrigger value="servers" className="flex items-center justify-center gap-2 text-xs">
                                <Server className="h-3 w-3" />
                                <span className="hidden sm:inline">服务器</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* Main Content */}
            <Card className="flex-1 flex flex-col min-h-0 border-border/50">
                <CardHeader className="flex-none p-4 border-b">
                    <CardTitle className="text-base sm:text-lg">
                        {activeTab === 'users' && '观看排行榜'}
                        {activeTab === 'media' && '播放热度榜'}
                        {activeTab === 'servers' && '服务器活跃度'}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                        {activeTab === 'users' && '按总观看时长排序'}
                        {activeTab === 'media' && '按播放次数排序'}
                        {activeTab === 'servers' && '按总观看时长排序'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-0 min-h-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !data?.data?.length ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Trophy className="h-10 w-10 mb-2 opacity-20" />
                            <p>暂无数据</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {data.type === 'users' &&
                                data.data.map((user, index) => (
                                    <div
                                        key={user.id}
                                        className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 transition-colors ${index < 3 ? 'bg-gradient-to-r from-muted/30 to-transparent' : ''}`}
                                    >
                                        <div className="w-8 sm:w-10 text-center flex-shrink-0">
                                            {index < 3 ? (
                                                <Medal className={`h-5 w-5 sm:h-6 sm:w-6 mx-auto ${MEDAL_COLORS[index]}`} />
                                            ) : (
                                                <span className="text-sm sm:text-base font-bold text-muted-foreground/50">
                                                    #{index + 1}
                                                </span>
                                            )}
                                        </div>
                                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 border">
                                            <AvatarFallback className="text-xs">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium truncate text-sm sm:text-base">{user.name}</p>
                                                {index === 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 text-yellow-500 bg-yellow-500/10">MVP</Badge>}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                <Server className="h-3 w-3" />
                                                {user.serverName}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-bold text-sm sm:text-base">{formatDuration(user.totalDuration)}</p>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground">{user.totalPlays} 次播放</p>
                                        </div>
                                    </div>
                                ))}

                            {data.type === 'media' &&
                                data.data.map((item, index) => (
                                    <Link
                                        key={item.itemId}
                                        href={`/media/${item.itemId}?serverId=${item.serverId}`}
                                        className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 transition-colors cursor-pointer group ${index < 3 ? 'bg-gradient-to-r from-muted/30 to-transparent' : ''}`}
                                    >
                                        <div className="w-8 sm:w-10 text-center flex-shrink-0">
                                            {index < 3 ? (
                                                <Medal className={`h-5 w-5 sm:h-6 sm:w-6 mx-auto ${MEDAL_COLORS[index]}`} />
                                            ) : (
                                                <span className="text-sm sm:text-base font-bold text-muted-foreground/50">
                                                    #{index + 1}
                                                </span>
                                            )}
                                        </div>

                                        {/* Cover Image */}
                                        <div className="relative w-10 h-14 sm:w-12 sm:h-16 flex-shrink-0 shadow-sm border rounded overflow-hidden bg-muted transition-transform group-hover:scale-105">
                                            {item.imageUrl ? (
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.itemName}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none'
                                                        e.currentTarget.parentElement!.innerHTML = item.itemType === 'Movie'
                                                            ? '<div class="w-full h-full flex items-center justify-center text-muted-foreground"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg></div>'
                                                            : '<div class="w-full h-full flex items-center justify-center text-muted-foreground"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></div>'
                                                    }}
                                                />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center bg-muted">
                                                    {item.itemType === 'Movie' ? (
                                                        <Film className="h-5 w-5 text-violet-500" />
                                                    ) : (
                                                        <Tv className="h-5 w-5 text-cyan-500" />
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-sm sm:text-base group-hover:text-primary transition-colors">
                                                {item.seriesName ? `${item.seriesName} - ${item.itemName}` : item.itemName}
                                            </p>
                                            <div className="flex flex-col gap-1 mt-1">
                                                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
                                                    <Badge variant="outline" className="text-[10px] px-1 h-4 font-normal">
                                                        {item.itemType}
                                                    </Badge>
                                                    <span>{formatDuration(item.totalDuration)}</span>
                                                </div>
                                                {/* Watchers List */}
                                                {item.watchedBy && item.watchedBy.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                        {item.watchedBy.slice(0, 3).map((user) => (
                                                            <span key={user} className="inline-flex items-center px-1 rounded text-[9px] bg-secondary text-secondary-foreground/80">
                                                                {user}
                                                            </span>
                                                        ))}
                                                        {item.watchedBy.length > 3 && (
                                                            <span className="text-[9px] text-muted-foreground">+{item.watchedBy.length - 3}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs h-5">
                                                {item.totalPlays}x
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground hidden sm:inline">播放次数</span>
                                        </div>
                                    </Link>
                                ))}

                            {data.type === 'servers' &&
                                data.data.map((server, index) => (
                                    <div
                                        key={server.serverId}
                                        className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 transition-colors ${index < 3 ? 'bg-gradient-to-r from-muted/30 to-transparent' : ''}`}
                                    >
                                        <div className="w-8 sm:w-10 text-center flex-shrink-0">
                                            {index < 3 ? (
                                                <Medal className={`h-5 w-5 sm:h-6 sm:w-6 mx-auto ${MEDAL_COLORS[index]}`} />
                                            ) : (
                                                <span className="text-sm sm:text-base font-bold text-muted-foreground/50">
                                                    #{index + 1}
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                                            <Server className="h-5 w-5 sm:h-6 sm:w-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-sm sm:text-base">{server.serverName}</p>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground">{server.totalPlays} 次播放</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-bold text-sm sm:text-base">{formatDuration(server.totalDuration)}</p>
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
