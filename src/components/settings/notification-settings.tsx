'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface NotificationConfig {
    enabled: boolean
    webhookUrl: string
    webhookType: string
    onPlaybackStart: boolean
    onPlaybackStop: boolean
}

export function NotificationSettings() {
    const [formData, setFormData] = useState<NotificationConfig>({
        enabled: false,
        webhookUrl: '',
        webhookType: 'generic',
        onPlaybackStart: true,
        onPlaybackStop: false,
    })

    const { data, isLoading } = useQuery({
        queryKey: ['notification-config'],
        queryFn: async () => {
            const res = await fetch('/api/settings/notifications')
            if (!res.ok) throw new Error('Failed to fetch config')
            return res.json()
        }
    })

    useEffect(() => {
        if (data) {
            setFormData({
                enabled: data.enabled ?? false,
                webhookUrl: data.webhookUrl ?? '',
                webhookType: data.webhookType ?? 'generic',
                onPlaybackStart: data.onPlaybackStart ?? true,
                onPlaybackStop: data.onPlaybackStop ?? false,
            })
        }
    }, [data])

    const mutation = useMutation({
        mutationFn: async (newData: NotificationConfig) => {
            const res = await fetch('/api/settings/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData),
            })
            if (!res.ok) throw new Error('Failed to save')
            return res.json()
        },
        onSuccess: () => {
            toast.success('通知设置已保存')
        },
        onError: () => {
            toast.error('保存失败')
        }
    })

    const handleSave = () => {
        mutation.mutate(formData)
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-6 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    通知设置
                </CardTitle>
                <CardDescription>配置 Webhook 以接收实时事件通知</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>启用通知</Label>
                        <p className="text-sm text-muted-foreground">
                            开启后将向指定 Webhook 发送事件
                        </p>
                    </div>
                    <Switch
                        checked={formData.enabled}
                        onCheckedChange={(c) => setFormData(prev => ({ ...prev, enabled: c }))}
                    />
                </div>

                {formData.enabled && (
                    <div className="space-y-4 border-t pt-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <Input
                                placeholder="https://discord.com/api/webhooks/..."
                                value={formData.webhookUrl}
                                onChange={(e) => setFormData(prev => ({ ...prev, webhookUrl: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>类型</Label>
                            <Select
                                value={formData.webhookType}
                                onValueChange={(v) => setFormData(prev => ({ ...prev, webhookType: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="generic">Generic (JSON)</SelectItem>
                                    <SelectItem value="discord">Discord</SelectItem>
                                    <SelectItem value="telegram">Telegram (URL Format)</SelectItem>
                                    <SelectItem value="wechat">企业微信 (WeChat Work)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3">
                            <Label>触发事件</Label>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">播放开始</span>
                                <Switch
                                    checked={formData.onPlaybackStart}
                                    onCheckedChange={(c) => setFormData(prev => ({ ...prev, onPlaybackStart: c }))}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">播放停止</span>
                                <Switch
                                    checked={formData.onPlaybackStop}
                                    onCheckedChange={(c) => setFormData(prev => ({ ...prev, onPlaybackStop: c }))}
                                />
                            </div>
                        </div>

                        <Button onClick={handleSave} disabled={mutation.isPending}>
                            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            保存配置
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
