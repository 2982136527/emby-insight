'use client'

import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { Settings, Moon, Sun, Monitor, Database, Trash2, Loader2, Download, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { NotificationSettings } from '@/components/settings/notification-settings'

export default function SettingsPage() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [isClearing, setIsClearing] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleClearData = async () => {
        if (!confirm('确定要清除所有数据吗？此操作无法撤销。')) {
            return
        }

        setIsClearing(true)
        try {
            // Clear localStorage
            localStorage.clear()
            toast.success('本地数据已清除，正在刷新...')
            setTimeout(() => window.location.reload(), 1000)
        } catch {
            toast.error('清除数据失败')
        } finally {
            setIsClearing(false)
        }
    }

    if (!mounted) {
        return null
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Settings className="h-8 w-8" />
                    设置
                </h1>
                <p className="text-muted-foreground">
                    配置您的 EmbyInsight 偏好设置
                </p>
            </div>

            {/* Appearance */}
            <Card>
                <CardHeader>
                    <CardTitle>外观</CardTitle>
                    <CardDescription>自定义 EmbyInsight 外观</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>主题</Label>
                            <p className="text-sm text-muted-foreground">
                                选择您喜欢的主题模式
                            </p>
                        </div>
                        <Select value={theme} onValueChange={setTheme}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="选择主题" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="light">
                                    <div className="flex items-center gap-2">
                                        <Sun className="h-4 w-4" />
                                        浅色
                                    </div>
                                </SelectItem>
                                <SelectItem value="dark">
                                    <div className="flex items-center gap-2">
                                        <Moon className="h-4 w-4" />
                                        深色
                                    </div>
                                </SelectItem>
                                <SelectItem value="system">
                                    <div className="flex items-center gap-2">
                                        <Monitor className="h-4 w-4" />
                                        跟随系统
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Notifications */}
            <NotificationSettings />

            {/* Privacy */}
            <Card>
                <CardHeader>
                    <CardTitle>隐私</CardTitle>
                    <CardDescription>控制数据显示</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>隐藏具体标题</Label>
                            <p className="text-sm text-muted-foreground">
                                仅显示时长，不显示具体影片标题
                            </p>
                        </div>
                        <Switch />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>匿名模式</Label>
                            <p className="text-sm text-muted-foreground">
                                在统计中隐藏所有用户名
                            </p>
                        </div>
                        <Switch />
                    </div>
                </CardContent>
            </Card>

            {/* Data Management */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        数据管理
                    </CardTitle>
                    <CardDescription>导出或清除本地数据</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>导出数据</Label>
                            <p className="text-sm text-muted-foreground">
                                导出观看历史、用户统计等数据
                            </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/stats/export">
                                <Download className="mr-2 h-4 w-4" />
                                前往导出
                            </Link>
                        </Button>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>清除所有数据</Label>
                            <p className="text-sm text-muted-foreground">
                                移除所有服务器、用户和播放记录
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleClearData}
                            disabled={isClearing}
                        >
                            {isClearing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            清除数据
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* About */}
            <Card>
                <CardHeader>
                    <CardTitle>关于</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">版本</span>
                            <span>1.0.0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">框架</span>
                            <span>Next.js 14</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">数据库</span>
                            <span>SQLite + Prisma</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
