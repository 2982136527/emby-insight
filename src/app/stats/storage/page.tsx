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
import { Loader2, HardDrive, Server, Folder, Film, Tv, Music } from 'lucide-react'
import { formatDuration } from '@/types/emby'

interface Library {
    name: string
    type: string
    locations: string[]
    mediaCount: number      // Total items in library
    playedCount: number     // Items we've played
    totalDuration: number
}

interface ServerStorage {
    serverId: string
    serverName: string
    version: string
    operatingSystem: string
    libraries: Library[]
    totalItems: number
    totalDuration: number
}

interface StorageData {
    servers: ServerStorage[]
    totalServers: number
}

const getLibraryIcon = (type: string) => {
    switch (type) {
        case 'movies':
            return <Film className="h-4 w-4" />
        case 'tvshows':
            return <Tv className="h-4 w-4" />
        case 'music':
            return <Music className="h-4 w-4" />
        default:
            return <Folder className="h-4 w-4" />
    }
}

const getLibraryColor = (type: string) => {
    switch (type) {
        case 'movies':
            return 'border-violet-500/20 bg-violet-500/10'
        case 'tvshows':
            return 'border-cyan-500/20 bg-cyan-500/10'
        case 'music':
            return 'border-emerald-500/20 bg-emerald-500/10'
        default:
            return 'border-muted'
    }
}

export default function StoragePage() {
    const { data, isLoading, error } = useQuery<StorageData>({
        queryKey: ['storage'],
        queryFn: async () => {
            const res = await fetch('/api/stats/storage')
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

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">加载失败</p>
            </div>
        )
    }

    // Calculate totals
    const totalItems = data.servers.reduce((sum, s) => sum + s.totalItems, 0)
    const totalDuration = data.servers.reduce((sum, s) => sum + s.totalDuration, 0)
    const totalLibraries = data.servers.reduce((sum, s) => sum + s.libraries.length, 0)
    const totalMediaItems = data.servers.reduce((sum, s) =>
        s.libraries.reduce((libSum, lib) => libSum + lib.mediaCount, 0) + sum, 0)

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 animate-fade-in">
            {/* Header */}
            <div className="flex-none px-1">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <HardDrive className="h-6 w-6 text-amber-500" />
                    存储分析
                </h1>
                <p className="text-sm text-muted-foreground">
                    查看所有服务器和媒体库的统计信息
                </p>
            </div>

            {/* Summary Cards */}
            <div className="flex-none grid gap-4 grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                        <CardTitle className="text-sm font-medium">服务器数量</CardTitle>
                        <Server className="h-4 w-4 text-violet-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl md:text-3xl font-bold">{data.totalServers}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                        <CardTitle className="text-sm font-medium">媒体库数量</CardTitle>
                        <Folder className="h-4 w-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl md:text-3xl font-bold">{totalLibraries}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                        <CardTitle className="text-sm font-medium">媒体总数</CardTitle>
                        <Film className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl md:text-3xl font-bold">{totalMediaItems.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                        <CardTitle className="text-sm font-medium">已播放项目</CardTitle>
                        <Film className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl md:text-3xl font-bold">{totalItems.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card className="col-span-2 lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                        <CardTitle className="text-sm font-medium">总播放时长</CardTitle>
                        <HardDrive className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl md:text-3xl font-bold">{formatDuration(totalDuration)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Server Details List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 rounded-lg">
                {data.servers.map((server) => (
                    <Card key={server.serverId} className="flex-none">
                        <CardHeader className="py-3 px-4 border-b bg-muted/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Server className="h-4 w-4 text-primary" />
                                        {server.serverName}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-xs h-5">{server.version}</Badge>
                                        <Badge variant="secondary" className="text-xs h-5">{server.operatingSystem}</Badge>
                                    </CardDescription>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold">{server.totalItems}</div>
                                    <p className="text-xs text-muted-foreground">已播放项目</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            {server.libraries.length > 0 ? (
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {server.libraries.map((lib) => (
                                        <div
                                            key={lib.name}
                                            className={`p-3 rounded-lg border flex flex-col gap-2 ${getLibraryColor(lib.type)}`}
                                        >
                                            <div className="flex items-center gap-2 justify-between">
                                                <div className="flex items-center gap-1.5 font-medium text-sm">
                                                    {getLibraryIcon(lib.type)}
                                                    {lib.name}
                                                </div>
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                                    {lib.mediaCount.toLocaleString()}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1">
                                                <div>
                                                    <p className="opacity-70">已播放</p>
                                                    <p className="font-medium text-foreground">{lib.playedCount}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="opacity-70">时长</p>
                                                    <p className="font-medium text-foreground">{formatDuration(lib.totalDuration)}</p>
                                                </div>
                                            </div>
                                            {lib.locations.length > 0 && (
                                                <div className="mt-auto pt-2 border-t border-border/10 text-[10px] text-muted-foreground truncate" title={lib.locations[0]}>
                                                    📁 {lib.locations[0]}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-center py-4">
                                    无法获取媒体库信息
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {data.servers.length === 0 && (
                    <Card>
                        <CardContent className="flex items-center justify-center py-12">
                            <p className="text-muted-foreground">暂无服务器数据</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
