'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Database,
    Film,
    Tv,
    Users,
    RefreshCw,
    Loader2,
    Check,
    AlertCircle,
    Key,
    Settings,
    Play,
    Pause,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import Link from 'next/link'

interface SyncStatus {
    type: string
    status: string
    progress: number
    totalItems: number
    syncedItems: number
    lastSyncDate?: string
    message?: string
}

interface TmdbSyncData {
    hasApiKey: boolean
    isSyncing: boolean
    statuses: SyncStatus[]
    cache: {
        movies: number
        tvShows: number
        persons: number
    }
}

interface TmdbConfig {
    hasApiKey: boolean
    language: string
    includeAdult: boolean
    autoSync: boolean
    syncInterval: number
    enableFullSync: boolean
    apiKey?: string
}

export default function TmdbSettingsPage() {
    const queryClient = useQueryClient()
    const [apiKey, setApiKey] = useState('')
    const [showApiKey, setShowApiKey] = useState(false)
    const [isFullSync, setIsFullSync] = useState(false)
    const [autoSync, setAutoSync] = useState(false)
    const [syncInterval, setSyncInterval] = useState(24)

    // 获取同步状态
    const { data: syncData, isLoading } = useQuery<TmdbSyncData>({
        queryKey: ['tmdb-sync'],
        queryFn: async () => {
            const res = await fetch('/api/tmdb/sync')
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
        refetchInterval: (query) => {
            const data = query.state.data as TmdbSyncData | undefined
            // Invalidate config query if sync is running to get updated API key status
            if (data?.isSyncing) {
                queryClient.invalidateQueries({ queryKey: ['tmdb-config'] })
                return 2000 // Refetch every 2 seconds if syncing
            }
            return 10000 // Refetch every 10 seconds if not syncing
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    // 获取配置
    const { data: config, isLoading: isLoadingConfig } = useQuery<TmdbConfig>({ // Added isLoadingConfig
        queryKey: ['tmdb-config'],
        queryFn: async () => {
            const res = await fetch('/api/tmdb/config')
            if (!res.ok) throw new Error('Failed to get config') // Changed error message
            return res.json()
        },
    })

    // 初始化状态
    useEffect(() => {
        if (config) {
            setAutoSync(config.autoSync)
            setSyncInterval(config.syncInterval)
            setIsFullSync(config.enableFullSync || false)
            if (config.apiKey) setApiKey(config.apiKey)
        }
    }, [config])

    // 保存全量同步开关状态
    const toggleFullSync = (checked: boolean) => {
        setIsFullSync(checked)
        saveConfig.mutate({
            enableFullSync: checked,
        })
    }

    // 保存配置
    const saveConfig = useMutation({
        mutationFn: async (data: { apiKey?: string, autoSync?: boolean, syncInterval?: number, enableFullSync?: boolean }) => { // Updated data type
            const res = await fetch('/api/tmdb/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to save')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('配置已保存')
            queryClient.invalidateQueries({ queryKey: ['tmdb-config'] })
            queryClient.invalidateQueries({ queryKey: ['tmdb-sync'] })
            setApiKey('')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    const [forceSync, setForceSync] = useState(false)

    // 启动同步
    const startSync = useMutation({
        mutationFn: async (type: 'movie' | 'tv' | 'person') => {
            const limit = isFullSync ? 0 : 1000
            const res = await fetch('/api/tmdb/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, limit, force: forceSync }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to start sync')
            }
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(data.message)
            queryClient.invalidateQueries({ queryKey: ['tmdb-sync'] })
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    // 停止同步
    const stopSync = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/tmdb/sync', {
                method: 'DELETE',
            })
            if (!res.ok) throw new Error('Failed to stop sync')
            return res.json()
        },
        onSuccess: (data) => {
            toast.info(data.message)
            queryClient.invalidateQueries({ queryKey: ['tmdb-sync'] })
        },
    })

    const handleSyncClick = (type: 'movie' | 'tv' | 'person') => {
        // 检查是否有任何同步任务在运行
        const isRunning = syncData?.isSyncing || (syncData?.statuses?.find(s => s.type === type)?.status === 'running')

        // 如果当前类型正在运行，点击则是停止
        const currentRunning = syncData?.statuses?.find(s => s.type === type)?.status === 'running'

        if (currentRunning) {
            stopSync.mutate()
        } else {
            // 如果点击的是开始，但已有其他任务在跑（且不是当前这个），则禁用（UI已处理），或者这里不做操作
            // 但如果 isSyncing 为 true 且 currentRunning 为 false，说明其他任务在跑
            if (syncData?.isSyncing) return

            startSync.mutate(type)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'running':
                return <Badge variant="default" className="bg-blue-500">同步中</Badge>
            case 'completed':
                return <Badge variant="default" className="bg-green-500">已完成</Badge>
            case 'failed':
                return <Badge variant="destructive">失败</Badge>
            default:
                return <Badge variant="secondary">空闲</Badge>
        }
    }

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
        return num.toString()
    }

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Database className="h-8 w-8 text-violet-500" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">TMDB 刮削缓存</h1>
                        <p className="text-sm text-muted-foreground">
                            缓存 TMDB 元数据，加速本地刮削匹配
                        </p>
                    </div>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/settings">
                        <Settings className="h-4 w-4 mr-2" />
                        返回设置
                    </Link>
                </Button>
            </div>

            {/* API Key 配置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        API 配置
                    </CardTitle>
                    <CardDescription>
                        配置 TMDB API Key 以启用同步功能。
                        <a
                            href="https://www.themoviedb.org/settings/api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline ml-1"
                        >
                            免费申请 API Key →
                        </a>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                        {config?.hasApiKey ? (
                            <Badge variant="default" className="bg-green-500">
                                <Check className="h-3 w-3 mr-1" />
                                已配置
                            </Badge>
                        ) : (
                            <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                未配置
                            </Badge>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Label htmlFor="apiKey" className="sr-only">API Key</Label>
                            <Input
                                id="apiKey"
                                type={showApiKey ? 'text' : 'password'}
                                placeholder="输入新的 TMDB API Key (v3)"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setShowApiKey(!showApiKey)}
                        >
                            {showApiKey ? '隐藏' : '显示'}
                        </Button>
                        <Button
                            onClick={() => saveConfig.mutate({ apiKey })}
                            disabled={!apiKey || saveConfig.isPending}
                        >
                            {saveConfig.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                '保存'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 缓存统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                                <Film className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {formatNumber(syncData?.cache.movies || 0)}
                                </p>
                                <p className="text-sm text-muted-foreground">电影缓存</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-500/10 rounded-lg">
                                <Tv className="h-6 w-6 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {formatNumber(syncData?.cache.tvShows || 0)}
                                </p>
                                <p className="text-sm text-muted-foreground">电视剧缓存</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-500/10 rounded-lg">
                                <Users className="h-6 w-6 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {formatNumber(syncData?.cache.persons || 0)}
                                </p>
                                <p className="text-sm text-muted-foreground">人物缓存</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 同步任务 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        同步任务
                    </CardTitle>
                    <CardDescription>
                        从 TMDB 同步电影和电视剧元数据到本地缓存
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* 全量同步开关 */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/50">
                            <div className="space-y-0.5">
                                <Label className="text-base font-medium">全量同步</Label>
                                <p className="text-sm text-muted-foreground">
                                    启用后将同步 TMDB 所有数据（需较长时间）。关闭则仅同步 1000 条用于测试。
                                </p>
                            </div>
                            <Switch checked={isFullSync} onCheckedChange={toggleFullSync} />
                        </div>

                        <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/50">
                            <div className="space-y-0.5">
                                <Label className="text-base font-medium">强制覆盖 (修复数据)</Label>
                                <p className="text-sm text-muted-foreground">
                                    启用后将重新从 TMDB 获取并覆盖本地已有数据（用于修复缺失信息或更新剧集，速度较慢）。
                                </p>
                            </div>
                            <Switch checked={forceSync} onCheckedChange={setForceSync} />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {/* 电影同步 */}
                            <div className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Film className="h-5 w-5 text-blue-500" />
                                        <span className="font-medium">电影同步</span>
                                        {getStatusBadge(
                                            syncData?.statuses.find(s => s.type === 'movie')?.status || 'idle'
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => handleSyncClick('movie')}
                                        disabled={!config?.hasApiKey || (syncData?.isSyncing && syncData?.statuses.find(s => s.type === 'movie')?.status !== 'running') || startSync.isPending || stopSync.isPending}
                                    >
                                        {syncData?.statuses.find(s => s.type === 'movie')?.status === 'running' ? (
                                            <Pause className="h-4 w-4 mr-1" />
                                        ) : (
                                            <Play className="h-4 w-4 mr-1" />
                                        )}
                                        {syncData?.statuses.find(s => s.type === 'movie')?.status === 'running' ? '暂停同步' : '开始同步'}
                                    </Button>
                                </div>
                                {syncData?.statuses.find(s => s.type === 'movie')?.status === 'running' && (
                                    <div className="space-y-2">
                                        <Progress
                                            value={syncData?.statuses.find(s => s.type === 'movie')?.progress || 0}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {syncData?.statuses.find(s => s.type === 'movie')?.message}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* 电视剧同步 */}
                            <div className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Tv className="h-5 w-5 text-green-500" />
                                        <span className="font-medium">电视剧同步</span>
                                        {getStatusBadge(
                                            syncData?.statuses.find(s => s.type === 'tv')?.status || 'idle'
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => handleSyncClick('tv')}
                                        disabled={!config?.hasApiKey || (syncData?.isSyncing && syncData?.statuses.find(s => s.type === 'tv')?.status !== 'running') || startSync.isPending || stopSync.isPending}
                                    >
                                        {syncData?.statuses.find(s => s.type === 'tv')?.status === 'running' ? (
                                            <Pause className="h-4 w-4 mr-1" />
                                        ) : (
                                            <Play className="h-4 w-4 mr-1" />
                                        )}
                                        {syncData?.statuses.find(s => s.type === 'tv')?.status === 'running' ? '暂停同步' : '开始同步'}
                                    </Button>
                                </div>
                                {syncData?.statuses.find(s => s.type === 'tv')?.status === 'running' && (
                                    <div className="space-y-2">
                                        <Progress
                                            value={syncData?.statuses.find(s => s.type === 'tv')?.progress || 0}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {syncData?.statuses.find(s => s.type === 'tv')?.message}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {!config?.hasApiKey && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-sm text-yellow-600 dark:text-yellow-400">
                            请先配置 TMDB API Key 才能开始同步
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
