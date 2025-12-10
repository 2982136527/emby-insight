'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    Server,
    Plus,
    RefreshCw,
    Trash2,
    Edit,
    CheckCircle,
    XCircle,
    Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface ServerData {
    id: string
    name: string
    url: string
    port: number
    apiKey: string
    isActive: boolean
    createdAt: string
    _count: {
        users: number
        playHistory: number
    }
}

export default function ServersPage() {
    const queryClient = useQueryClient()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingServer, setEditingServer] = useState<ServerData | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        port: '8096',
        apiKey: '',
    })

    // Fetch servers
    const { data: servers = [], isLoading } = useQuery<ServerData[]>({
        queryKey: ['servers'],
        queryFn: async () => {
            const res = await fetch('/api/servers')
            if (!res.ok) throw new Error('Failed to fetch servers')
            return res.json()
        },
    })

    // Create server mutation
    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const res = await fetch('/api/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    port: parseInt(data.port, 10),
                }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to create server')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['servers'] })
            setIsDialogOpen(false)
            resetForm()
            toast.success('服务器添加成功')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    // Delete server mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/servers/${id}`, {
                method: 'DELETE',
            })
            if (!res.ok) throw new Error('无法删除服务器')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['servers'] })
            toast.success('服务器已删除')
        },
        onError: () => {
            toast.error('删除服务器失败')
        },
    })

    // Sync mutation
    const syncMutation = useMutation({
        mutationFn: async (serverIds?: string[]) => {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverIds }),
            })
            if (!res.ok) throw new Error('同步失败')
            return res.json()
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['servers'] })
            const result = data.results[0]
            if (result.error) {
                toast.error(`同步失败: ${result.error}`)
            } else {
                toast.success(
                    `同步完成: ${result.usersSync.added} 新增用户, ${result.historySync.added} 新增记录`
                )
            }
        },
        onError: () => {
            toast.error('同步失败')
        },
    })

    const resetForm = () => {
        setFormData({ name: '', url: '', port: '8096', apiKey: '' })
        setEditingServer(null)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        createMutation.mutate(formData)
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">服务器列表</h1>
                    <p className="text-muted-foreground">
                        管理 Emby 服务器并同步数据
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => syncMutation.mutate(undefined)}
                        disabled={syncMutation.isPending || servers.length === 0}
                    >
                        {syncMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        同步所有
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={resetForm}>
                                <Plus className="mr-2 h-4 w-4" />
                                添加服务器
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <form onSubmit={handleSubmit}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingServer ? '编辑服务器' : '添加新服务器'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        请输入您的 Emby 服务器详情。保存前我们会测试连接。
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">服务器名称</Label>
                                        <Input
                                            id="name"
                                            placeholder="我的 Emby 服务器"
                                            value={formData.name}
                                            onChange={(e) =>
                                                setFormData({ ...formData, name: e.target.value })
                                            }
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2">
                                            <Label htmlFor="url">服务器地址</Label>
                                            <Input
                                                id="url"
                                                placeholder="http://192.168.1.100"
                                                value={formData.url}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, url: e.target.value })
                                                }
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="port">端口</Label>
                                            <Input
                                                id="port"
                                                type="number"
                                                placeholder="8096"
                                                value={formData.port}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, port: e.target.value })
                                                }
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="apiKey">API 密钥</Label>
                                        <Input
                                            id="apiKey"
                                            type="password"
                                            placeholder="您的 Emby API 密钥"
                                            value={formData.apiKey}
                                            onChange={(e) =>
                                                setFormData({ ...formData, apiKey: e.target.value })
                                            }
                                            required={!editingServer}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            在 Emby 控制台 → 高级 → API 密钥 中获取
                                        </p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsDialogOpen(false)}
                                    >
                                        取消
                                    </Button>
                                    <Button type="submit" disabled={createMutation.isPending}>
                                        {createMutation.isPending && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        {editingServer ? '保存修改' : '添加服务器'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Server List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : servers.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Server className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">暂无服务器配置</h3>
                        <p className="text-muted-foreground mb-4">
                            添加您的第一个 Emby 服务器以开始统计
                        </p>
                        <Button onClick={() => setIsDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            添加服务器
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {servers.map((server) => (
                        <Card key={server.id} className="relative overflow-hidden">
                            <div
                                className={`absolute top-0 left-0 right-0 h-1 ${server.isActive ? 'bg-green-500' : 'bg-muted'
                                    }`}
                            />
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <Server className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-lg">{server.name}</CardTitle>
                                    </div>
                                    <Badge variant={server.isActive ? 'default' : 'secondary'}>
                                        {server.isActive ? (
                                            <CheckCircle className="mr-1 h-3 w-3" />
                                        ) : (
                                            <XCircle className="mr-1 h-3 w-3" />
                                        )}
                                        {server.isActive ? '在线' : '离线'}
                                    </Badge>
                                </div>
                                <CardDescription className="font-mono text-xs">
                                    {server.url}:{server.port}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                    <div>
                                        <p className="text-muted-foreground">用户数</p>
                                        <p className="text-2xl font-bold">{server._count.users}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">播放记录</p>
                                        <p className="text-2xl font-bold">
                                            {server._count.playHistory.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => syncMutation.mutate([server.id])}
                                        disabled={syncMutation.isPending}
                                    >
                                        {syncMutation.isPending ? (
                                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        ) : (
                                            <RefreshCw className="mr-2 h-3 w-3" />
                                        )}
                                        同步
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setEditingServer(server)
                                            setFormData({
                                                name: server.name,
                                                url: server.url,
                                                port: String(server.port),
                                                apiKey: '',
                                            })
                                            setIsDialogOpen(true)
                                        }}
                                    >
                                        <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            if (confirm('确定要删除此服务器吗？此操作无法撤销。')) {
                                                deleteMutation.mutate(server.id)
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
