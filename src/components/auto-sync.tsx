'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { RefreshCw, Clock, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface AutoSyncProps {
    className?: string
}

type SyncInterval = '0' | '10s' | '30s' | '5' | '10' | '30' | '60'

export function AutoSync({ className }: AutoSyncProps) {
    const [syncInterval, setSyncInterval] = useState<SyncInterval>('10s') // Default to 10s
    const [lastSync, setLastSync] = useState<Date | null>(null)
    const [nextSync, setNextSync] = useState<Date | null>(null)
    const [countdown, setCountdown] = useState<number>(0)
    const queryClient = useQueryClient()

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('auto-sync-interval')
        if (saved) {
            setSyncInterval(saved as SyncInterval)
        }
    }, [])

    const syncMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/sync', { method: 'POST' })
            if (!res.ok) throw new Error('Sync failed')
            return res.json()
        },
        onSuccess: () => {
            setLastSync(new Date())
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['servers'] })
            // Silent success - no toast notification
        },
        onError: () => {
            toast.error('同步失败', {
                description: '请检查服务器连接',
            })
        },
    })

    // Use ref to store mutation to avoid re-render loop
    const syncMutationRef = useRef(syncMutation)
    syncMutationRef.current = syncMutation

    const triggerSync = useCallback(() => {
        if (!syncMutationRef.current.isPending) {
            syncMutationRef.current.mutate()
        }
    }, [])

    // Auto-sync timer
    useEffect(() => {
        if (syncInterval === '0') {
            setNextSync(null)
            setCountdown(0)
            return
        }

        // Parse interval - 's' suffix means seconds, otherwise minutes
        const intervalMs = syncInterval.endsWith('s')
            ? parseInt(syncInterval) * 1000
            : parseInt(syncInterval) * 60 * 1000

        // Set initial next sync time
        const next = new Date(Date.now() + intervalMs)
        setNextSync(next)

        // Countdown updater
        const countdownTimer = window.setInterval(() => {
            const remaining = Math.max(0, Math.floor((next.getTime() - Date.now()) / 1000))
            setCountdown(remaining)
        }, 1000)

        // Sync timer
        const syncTimer = window.setInterval(() => {
            triggerSync()
            const newNext = new Date(Date.now() + intervalMs)
            setNextSync(newNext)
        }, intervalMs)

        return () => {
            window.clearInterval(countdownTimer)
            window.clearInterval(syncTimer)
        }
    }, [syncInterval, triggerSync])

    const formatCountdown = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const intervalLabels: Record<SyncInterval, string> = {
        '0': '关闭',
        '10s': '10秒',
        '30s': '30秒',
        '5': '5分钟',
        '10': '10分钟',
        '30': '30分钟',
        '60': '1小时',
    }

    return (
        <div className={className}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 h-9"
                    >
                        <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                        <span className="flex-1 text-left">自动同步</span>
                        {syncInterval !== '0' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                                {countdown > 0 ? formatCountdown(countdown) : '同步中...'}
                            </Badge>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h4 className="font-medium text-sm">自动同步设置</h4>
                            <p className="text-xs text-muted-foreground">
                                设置自动从 Emby 服务器同步播放记录的间隔
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium">同步间隔</label>
                            <div className="grid grid-cols-5 gap-1">
                                {Object.entries(intervalLabels).map(([value, label]) => (
                                    <Button
                                        key={value}
                                        variant={syncInterval === value ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-7 text-xs px-1"
                                        onClick={() => {
                                            setSyncInterval(value as SyncInterval)
                                            localStorage.setItem('auto-sync-interval', value)
                                        }}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">状态</span>
                            {syncInterval === '0' ? (
                                <Badge variant="outline" className="gap-1">
                                    <X className="h-3 w-3" />
                                    已关闭
                                </Badge>
                            ) : (
                                <Badge variant="default" className="gap-1 bg-green-600">
                                    <Check className="h-3 w-3" />
                                    运行中
                                </Badge>
                            )}
                        </div>

                        {lastSync && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">上次同步</span>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {lastSync.toLocaleTimeString('zh-CN')}
                                </span>
                            </div>
                        )}

                        <Button
                            size="sm"
                            className="w-full"
                            onClick={() => triggerSync()}
                            disabled={syncMutation.isPending}
                        >
                            {syncMutation.isPending ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    同步中...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    立即同步
                                </>
                            )}
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
