'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Link from 'next/link'
import { Users, Link as LinkIcon, Loader2, UserCog, ArrowUpDown, ArrowUp, ArrowDown, Settings, Shield, X } from 'lucide-react'
import { UserManagement } from '@/components/user-management'
import { UserPermissionDialog } from '@/components/user-permission-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDuration } from '@/types/emby'
import { useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ServerUser {
    id: string
    embyUserId: string
    username: string
    serverId: string
    globalUserId: string | null
    server: {
        id: string
        name: string
        url: string
    }
    globalUser: {
        id: string
        name: string
        isHidden: boolean
    } | null
    _count: {
        playHistory: number
    }
}

interface GlobalUser {
    id: string
    name: string
    isHidden: boolean
    totalPlayDuration: number
    totalPlayCount: number
    serverUsers: {
        id: string
        username: string
        serverName: string
    }[]
}

export default function UsersPage() {
    const queryClient = useQueryClient()
    const [selectedUsers, setSelectedUsers] = useState<string[]>([])
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
    const [newGlobalUserName, setNewGlobalUserName] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new')
    const [selectedGlobalUser, setSelectedGlobalUser] = useState<string | undefined>(undefined)
    const [sortField, setSortField] = useState<'username' | 'server' | 'playCount'>('playCount')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    // Fetch server users
    const { data: serverUsers = [], isLoading: usersLoading } = useQuery<ServerUser[]>({
        queryKey: ['serverUsers'],
        queryFn: async () => {
            const res = await fetch('/api/users')
            if (!res.ok) throw new Error('Failed to fetch users')
            return res.json()
        },
    })

    // Fetch global users
    const { data: globalUsers = [], isLoading: globalLoading } = useQuery<GlobalUser[]>({
        queryKey: ['globalUsers'],
        queryFn: async () => {
            const res = await fetch('/api/users/global')
            if (!res.ok) throw new Error('Failed to fetch global users')
            return res.json()
        },
    })

    // Create user mapping
    const linkMutation = useMutation({
        mutationFn: async () => {
            if (linkMode === 'new' && !newGlobalUserName.trim()) {
                throw new Error('Global user name cannot be empty.')
            }
            if (linkMode === 'existing' && !selectedGlobalUser) {
                throw new Error('Please select an existing global user.')
            }

            const payload = {
                serverUserIds: selectedUsers,
                globalUserName: linkMode === 'new' ? newGlobalUserName.trim() : undefined,
                globalUserId: linkMode === 'existing' ? selectedGlobalUser : undefined,
            }

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error('Failed to link users')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['serverUsers'] })
            queryClient.invalidateQueries({ queryKey: ['globalUsers'] })
            setIsLinkDialogOpen(false)
            setSelectedUsers([])
            setNewGlobalUserName('')
            setSelectedGlobalUser(undefined)
            setLinkMode('new')
            toast.success('用户关联成功')
        },
        onError: (error) => {
            toast.error(`关联用户失败: ${error.message}`)
        },
    })

    const filteredUsers = serverUsers
        .filter(
            (user) =>
                user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.server.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            let cmp = 0
            if (sortField === 'username') {
                cmp = a.username.localeCompare(b.username)
            } else if (sortField === 'server') {
                cmp = a.server.name.localeCompare(b.server.name)
            } else if (sortField === 'playCount') {
                cmp = a._count.playHistory - b._count.playHistory
            }
            return sortDir === 'asc' ? cmp : -cmp
        })

    const handleSort = (field: 'username' | 'server' | 'playCount') => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('desc')
        }
    }

    const SortIcon = ({ field }: { field: 'username' | 'server' | 'playCount' }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
        return sortDir === 'asc'
            ? <ArrowUp className="h-3 w-3 ml-1" />
            : <ArrowDown className="h-3 w-3 ml-1" />
    }

    const isLoading = usersLoading || globalLoading

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
                    <p className="text-muted-foreground">
                        管理所有服务器的 Emby 用户及其全局关联
                    </p>
                </div>
                <UserManagement
                    trigger={
                        <Button>
                            <Settings className="h-4 w-4 mr-2" />
                            Emby 用户管理
                        </Button>
                    }
                />
            </div>

            <Tabs defaultValue="server-users" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="server-users" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        服务器用户
                    </TabsTrigger>
                    <TabsTrigger value="global-users" className="flex items-center gap-2">
                        <UserCog className="h-4 w-4" />
                        全局用户
                    </TabsTrigger>
                </TabsList>

                {/* Server Users Tab */}
                <TabsContent value="server-users" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>服务器用户列表</CardTitle>
                                    <CardDescription>
                                        来自所有服务器的 Emby 用户
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="搜索用户..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-[200px]"
                                    />
                                    <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button disabled={selectedUsers.length === 0}>
                                                <LinkIcon className="mr-2 h-4 w-4" />
                                                关联用户 ({selectedUsers.length})
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>关联到全局用户</DialogTitle>
                                                <DialogDescription>
                                                    将选中的用户关联到一个全局身份，以合并统计数据。
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>关联方式</Label>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant={linkMode === 'existing' ? 'default' : 'outline'}
                                                            onClick={() => setLinkMode('existing')}
                                                            className="flex-1"
                                                        >
                                                            现有用户
                                                        </Button>
                                                        <Button
                                                            variant={linkMode === 'new' ? 'default' : 'outline'}
                                                            onClick={() => setLinkMode('new')}
                                                            className="flex-1"
                                                        >
                                                            创建新用户
                                                        </Button>
                                                    </div>
                                                </div>

                                                {linkMode === 'existing' ? (
                                                    <div className="space-y-2">
                                                        <Label>选择全局用户</Label>
                                                        {globalUsers.length === 0 ? (
                                                            <p className="text-sm text-muted-foreground">
                                                                暂无全局用户，请先创建新用户
                                                            </p>
                                                        ) : (
                                                            <Select
                                                                value={selectedGlobalUser}
                                                                onValueChange={setSelectedGlobalUser}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="选择用户..." />
                                                                </SelectTrigger>
                                                                <SelectContent position="popper" sideOffset={4}>
                                                                    {globalUsers.map((user) => (
                                                                        <SelectItem key={user.id} value={user.id}>
                                                                            {user.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <Label>新用户名称</Label>
                                                        <Input
                                                            placeholder="输入名称"
                                                            value={newGlobalUserName}
                                                            onChange={(e) => setNewGlobalUserName(e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <DialogFooter>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setIsLinkDialogOpen(false)}
                                                >
                                                    取消
                                                </Button>
                                                <Button
                                                    onClick={() => linkMutation.mutate()}
                                                    disabled={
                                                        linkMutation.isPending ||
                                                        (linkMode === 'new' && !newGlobalUserName.trim()) ||
                                                        (linkMode === 'existing' && !selectedGlobalUser)
                                                    }
                                                >
                                                    {linkMutation.isPending && (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    )}
                                                    确认关联
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        filteredUsers.length > 0 &&
                                                        selectedUsers.length === filteredUsers.length
                                                    }
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedUsers(filteredUsers.map((u) => u.id))
                                                        } else {
                                                            setSelectedUsers([])
                                                        }
                                                    }}
                                                    className="translate-y-[2px]"
                                                />
                                            </TableHead>
                                            <TableHead>
                                                <button
                                                    onClick={() => handleSort('username')}
                                                    className="flex items-center hover:text-foreground transition-colors"
                                                >
                                                    用户
                                                    <SortIcon field="username" />
                                                </button>
                                            </TableHead>
                                            <TableHead>
                                                <button
                                                    onClick={() => handleSort('server')}
                                                    className="flex items-center hover:text-foreground transition-colors"
                                                >
                                                    服务器
                                                    <SortIcon field="server" />
                                                </button>
                                            </TableHead>
                                            <TableHead>全局关联</TableHead>
                                            <TableHead className="text-right">
                                                <button
                                                    onClick={() => handleSort('playCount')}
                                                    className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                                                >
                                                    播放记录数
                                                    <SortIcon field="playCount" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                    未找到用户。请先同步服务器。
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredUsers.map((user) => (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedUsers.includes(user.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedUsers([...selectedUsers, user.id])
                                                                } else {
                                                                    setSelectedUsers(
                                                                        selectedUsers.filter((id) => id !== user.id)
                                                                    )
                                                                }
                                                            }}
                                                            className="translate-y-[2px]"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        <Link
                                                            href={`/users/${user.id}`}
                                                            className="flex items-center gap-2 hover:underline cursor-pointer"
                                                        >
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage
                                                                    src={`/api/proxy/image?url=${encodeURIComponent(
                                                                        user.server.url
                                                                    )}/Users/${user.embyUserId}/Images/Primary`}
                                                                />
                                                                <AvatarFallback>
                                                                    {user.username.slice(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            {user.username}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{user.server.name}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {user.globalUser ? (
                                                            <Badge variant="secondary" className="gap-1">
                                                                <UserCog className="h-3 w-3" />
                                                                {user.globalUser.name}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">--</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {user._count.playHistory}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <UserPermissionDialog
                                                            serverId={user.serverId}
                                                            userId={user.embyUserId}
                                                            username={user.username}
                                                            trigger={
                                                                <Button variant="ghost" size="sm">
                                                                    <Shield className="h-4 w-4" />
                                                                </Button>
                                                            }
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Global Users Tab */}
                <TabsContent value="global-users">
                    <Card>
                        <CardHeader>
                            <CardTitle>全局用户</CardTitle>
                            <CardDescription>
                                跨服务器的合并用户身份
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {globalUsers.map((user) => (
                                    <div key={user.id} className="relative group">
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-base font-medium">
                                                    {user.name}
                                                </CardTitle>
                                                <div className="flex items-center gap-2">
                                                    <UserCog className="h-4 w-4 text-muted-foreground" />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-red-500 -mr-2"
                                                        onClick={async () => {
                                                            if (!confirm(`确定要删除全局用户 "${user.name}" 吗？\n这将解除所有已绑定用户的关联。`)) return

                                                            try {
                                                                const res = await fetch(`/api/users/global/${user.id}`, { method: 'DELETE' })
                                                                if (!res.ok) throw new Error('Failed')
                                                                toast.success('全局用户已删除')
                                                                queryClient.invalidateQueries({ queryKey: ['globalUsers'] })
                                                                queryClient.invalidateQueries({ queryKey: ['serverUsers'] })
                                                            } catch (e) {
                                                                toast.error('删除失败')
                                                            }
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="mt-2 space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">关联账号:</span>
                                                        <span className="font-medium">{user.serverUsers.length}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">总播放:</span>
                                                        <span className="font-medium">{user.totalPlayCount}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">总时长:</span>
                                                        <span className="font-medium">
                                                            {formatDuration(user.totalPlayDuration)}
                                                        </span>
                                                    </div>
                                                    <div className="pt-2">
                                                        <div className="flex flex-wrap gap-1">
                                                            {user.serverUsers.map((su) => (
                                                                <Badge
                                                                    key={su.id}
                                                                    variant="secondary"
                                                                    className="text-[10px] pr-1 gap-1 group/badge hover:bg-destructive/10 hover:text-destructive transition-colors cursor-default"
                                                                >
                                                                    {su.username} @ {su.serverName}
                                                                    <button
                                                                        className="rounded-full hover:bg-destructive/20 p-0.5 opacity-0 group-hover/badge:opacity-100 transition-opacity"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation()
                                                                            if (!confirm(`确定要解除用户 "${su.username}" 的关联吗？`)) return

                                                                            try {
                                                                                const res = await fetch('/api/users/unbind', {
                                                                                    method: 'POST',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ serverUserId: su.id }),
                                                                                })
                                                                                if (!res.ok) throw new Error('Failed')
                                                                                toast.success('已解除关联')
                                                                                queryClient.invalidateQueries({ queryKey: ['globalUsers'] })
                                                                                queryClient.invalidateQueries({ queryKey: ['serverUsers'] })
                                                                            } catch (e) {
                                                                                toast.error('操作失败')
                                                                            }
                                                                        }}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                                                        <span className="text-xs text-muted-foreground">隐私设置</span>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            公开
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                ))}
                                {globalUsers.length === 0 && (
                                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <UserCog className="h-12 w-12 mb-4" />
                                        <p>暂无全局用户</p>
                                        <p className="text-sm">在&quot;服务器用户&quot;标签页中关联用户以创建</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div >
    )
}
