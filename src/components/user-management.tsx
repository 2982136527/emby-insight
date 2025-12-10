'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, UserPlus, Trash2, Settings, Shield, Plus, X } from 'lucide-react'

interface Server {
    id: string
    name: string
}

interface EmbyUser {
    Id: string
    Name: string
    Policy?: {
        IsAdministrator?: boolean
        IsDisabled?: boolean
        EnableAllFolders?: boolean
        EnabledFolders?: string[]
    }
}

interface Library {
    Name: string
    ItemId: string
    CollectionType: string
}

interface UserManagementProps {
    trigger?: React.ReactNode
}

export function UserManagement({ trigger }: UserManagementProps) {
    const [open, setOpen] = useState(false)
    const [selectedServerId, setSelectedServerId] = useState<string>('')
    const [newUsers, setNewUsers] = useState<Array<{ name: string; password: string }>>([{ name: '', password: '' }])
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
    const [editingUserId, setEditingUserId] = useState<string | null>(null)
    const queryClient = useQueryClient()

    // Fetch servers
    const { data: servers } = useQuery<Server[]>({
        queryKey: ['servers'],
        queryFn: async () => {
            const res = await fetch('/api/servers')
            if (!res.ok) throw new Error('Failed to fetch servers')
            return res.json()
        },
    })

    // Fetch server users directly from Emby
    const { data: serverUsers, isLoading: loadingUsers, refetch: refetchUsers } = useQuery<EmbyUser[]>({
        queryKey: ['emby-server-users', selectedServerId],
        queryFn: async () => {
            if (!selectedServerId) return []
            const res = await fetch(`/api/servers/${selectedServerId}/emby-users`)
            if (!res.ok) throw new Error('Failed to fetch users')
            return res.json()
        },
        enabled: !!selectedServerId,
    })

    // Fetch user policy
    const { data: userPolicy, isLoading: loadingPolicy } = useQuery({
        queryKey: ['user-policy', editingUserId, selectedServerId],
        queryFn: async () => {
            if (!editingUserId || !selectedServerId) return null
            const res = await fetch(`/api/users/${editingUserId}/policy?serverId=${selectedServerId}`)
            if (!res.ok) throw new Error('Failed to fetch policy')
            return res.json()
        },
        enabled: !!editingUserId && !!selectedServerId,
    })

    // Fetch libraries
    const { data: libraries } = useQuery<Library[]>({
        queryKey: ['server-libraries', selectedServerId],
        queryFn: async () => {
            if (!selectedServerId) return []
            const res = await fetch(`/api/servers/${selectedServerId}/libraries`)
            if (!res.ok) throw new Error('Failed to fetch libraries')
            return res.json()
        },
        enabled: !!selectedServerId,
    })

    // Create users mutation
    const createUsersMutation = useMutation({
        mutationFn: async (users: Array<{ name: string; password?: string }>) => {
            const res = await fetch('/api/users/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId: selectedServerId, users }),
            })
            if (!res.ok) throw new Error('Failed to create users')
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(`成功创建 ${data.successCount} 个用户${data.failCount > 0 ? `，${data.failCount} 个失败` : ''}`)
            setNewUsers([{ name: '', password: '' }])
            refetchUsers()
            queryClient.invalidateQueries({ queryKey: ['users'] })
        },
        onError: () => {
            toast.error('创建用户失败')
        },
    })

    // Delete users mutation
    const deleteUsersMutation = useMutation({
        mutationFn: async (userIds: string[]) => {
            const res = await fetch('/api/users/manage', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId: selectedServerId, userIds }),
            })
            if (!res.ok) throw new Error('Failed to delete users')
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(`成功删除 ${data.successCount} 个用户${data.failCount > 0 ? `，${data.failCount} 个失败` : ''}`)
            setSelectedUserIds([])
            refetchUsers()
            queryClient.invalidateQueries({ queryKey: ['users'] })
        },
        onError: () => {
            toast.error('删除用户失败')
        },
    })

    // Update policy mutation
    const updatePolicyMutation = useMutation({
        mutationFn: async ({ userId, policy }: { userId: string; policy: Record<string, unknown> }) => {
            const res = await fetch(`/api/users/${userId}/policy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId: selectedServerId, policy }),
            })
            if (!res.ok) throw new Error('Failed to update policy')
            return res.json()
        },
        onSuccess: () => {
            toast.success('权限更新成功')
            queryClient.invalidateQueries({ queryKey: ['user-policy', editingUserId] })
            refetchUsers()
        },
        onError: () => {
            toast.error('权限更新失败')
        },
    })

    const addNewUserRow = () => {
        setNewUsers([...newUsers, { name: '', password: '' }])
    }

    const removeNewUserRow = (index: number) => {
        setNewUsers(newUsers.filter((_, i) => i !== index))
    }

    const updateNewUser = (index: number, field: 'name' | 'password', value: string) => {
        const updated = [...newUsers]
        updated[index][field] = value
        setNewUsers(updated)
    }

    const handleCreateUsers = () => {
        const validUsers = newUsers.filter(u => u.name.trim())
        if (validUsers.length === 0) {
            toast.error('请输入至少一个用户名')
            return
        }
        createUsersMutation.mutate(validUsers)
    }

    const handleDeleteUsers = () => {
        if (selectedUserIds.length === 0) {
            toast.error('请选择要删除的用户')
            return
        }
        if (!confirm(`确定要删除选中的 ${selectedUserIds.length} 个用户吗？此操作不可撤销！`)) {
            return
        }
        deleteUsersMutation.mutate(selectedUserIds)
    }

    const toggleUserSelection = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    const togglePolicyField = (field: string, value: boolean) => {
        if (!editingUserId) return
        updatePolicyMutation.mutate({
            userId: editingUserId,
            policy: { [field]: value },
        })
    }

    const toggleLibraryAccess = (libraryId: string) => {
        if (!editingUserId || !userPolicy) return
        const currentFolders = userPolicy.EnabledFolders || []
        const newFolders = currentFolders.includes(libraryId)
            ? currentFolders.filter((id: string) => id !== libraryId)
            : [...currentFolders, libraryId]
        updatePolicyMutation.mutate({
            userId: editingUserId,
            policy: { EnabledFolders: newFolders },
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        用户管理
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Emby 用户管理
                    </DialogTitle>
                    <DialogDescription>
                        在 Emby 服务器上创建、删除用户和管理权限
                    </DialogDescription>
                </DialogHeader>

                <div className="mb-4">
                    <Label>选择服务器</Label>
                    <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder="选择一个服务器" />
                        </SelectTrigger>
                        <SelectContent>
                            {servers?.map((server) => (
                                <SelectItem key={server.id} value={server.id}>
                                    {server.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedServerId && (
                    <Tabs defaultValue="create" className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="create">
                                <UserPlus className="h-4 w-4 mr-2" />
                                创建用户
                            </TabsTrigger>
                            <TabsTrigger value="delete">
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除用户
                            </TabsTrigger>
                            <TabsTrigger value="permissions">
                                <Shield className="h-4 w-4 mr-2" />
                                权限管理
                            </TabsTrigger>
                        </TabsList>

                        {/* Create Users Tab */}
                        <TabsContent value="create" className="flex-1 min-h-0">
                            <ScrollArea className="h-[350px] pr-4">
                                <div className="space-y-3">
                                    {newUsers.map((user, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                placeholder="用户名"
                                                value={user.name}
                                                onChange={(e) => updateNewUser(index, 'name', e.target.value)}
                                                className="flex-1"
                                            />
                                            <Input
                                                type="password"
                                                placeholder="密码（可选）"
                                                value={user.password}
                                                onChange={(e) => updateNewUser(index, 'password', e.target.value)}
                                                className="flex-1"
                                            />
                                            {newUsers.length > 1 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeNewUserRow(index)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={addNewUserRow}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        添加更多
                                    </Button>
                                </div>
                            </ScrollArea>
                            <DialogFooter className="mt-4">
                                <Button
                                    onClick={handleCreateUsers}
                                    disabled={createUsersMutation.isPending}
                                >
                                    {createUsersMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <UserPlus className="h-4 w-4 mr-2" />
                                    )}
                                    创建用户
                                </Button>
                            </DialogFooter>
                        </TabsContent>

                        {/* Delete Users Tab */}
                        <TabsContent value="delete" className="flex-1 min-h-0">
                            <ScrollArea className="h-[350px] pr-4">
                                {loadingUsers ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                ) : serverUsers && serverUsers.length > 0 ? (
                                    <div className="space-y-2">
                                        {serverUsers.map((user) => (
                                            <div
                                                key={user.Id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedUserIds.includes(user.Id)
                                                    ? 'bg-destructive/10 border-destructive'
                                                    : 'hover:bg-muted'
                                                    }`}
                                                onClick={() => toggleUserSelection(user.Id)}
                                            >
                                                <Checkbox
                                                    checked={selectedUserIds.includes(user.Id)}
                                                    onCheckedChange={() => toggleUserSelection(user.Id)}
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium">{user.Name}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {user.Policy?.IsAdministrator && (
                                                            <Badge variant="default" className="text-[10px]">管理员</Badge>
                                                        )}
                                                        {user.Policy?.IsDisabled && (
                                                            <Badge variant="secondary" className="text-[10px]">已禁用</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        暂无用户
                                    </div>
                                )}
                            </ScrollArea>
                            <DialogFooter className="mt-4">
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-sm text-muted-foreground">
                                        已选择 {selectedUserIds.length} 个用户
                                    </span>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeleteUsers}
                                        disabled={selectedUserIds.length === 0 || deleteUsersMutation.isPending}
                                    >
                                        {deleteUsersMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4 mr-2" />
                                        )}
                                        删除选中用户
                                    </Button>
                                </div>
                            </DialogFooter>
                        </TabsContent>

                        {/* Permissions Tab */}
                        <TabsContent value="permissions" className="flex-1 min-h-0">
                            <div className="mb-4">
                                <Label>选择用户</Label>
                                <Select value={editingUserId || ''} onValueChange={setEditingUserId}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="选择要编辑权限的用户" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {serverUsers?.map((user) => (
                                            <SelectItem key={user.Id} value={user.Id}>
                                                {user.Name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {editingUserId && (
                                <ScrollArea className="h-[280px] pr-4">
                                    {loadingPolicy ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : userPolicy ? (
                                        <div className="space-y-4">
                                            <div className="grid gap-4">
                                                {[
                                                    { key: 'IsAdministrator', label: '管理员权限', desc: '完全访问服务器设置' },
                                                    { key: 'IsDisabled', label: '禁用账户', desc: '阻止用户登录' },
                                                    { key: 'EnableAllFolders', label: '访问所有媒体库', desc: '允许访问所有媒体库' },
                                                ].map(({ key, label, desc }) => (
                                                    <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                                                        <div>
                                                            <div className="font-medium text-sm">{label}</div>
                                                            <div className="text-xs text-muted-foreground">{desc}</div>
                                                        </div>
                                                        <Checkbox
                                                            checked={!!userPolicy[key]}
                                                            onCheckedChange={(checked) => togglePolicyField(key, !!checked)}
                                                            disabled={updatePolicyMutation.isPending}
                                                        />
                                                    </div>
                                                ))}

                                                {/* Library Selection - only show when EnableAllFolders is false */}
                                                {!userPolicy.EnableAllFolders && libraries && libraries.length > 0 && (
                                                    <div className="p-3 rounded-lg border bg-muted/30">
                                                        <div className="font-medium text-sm mb-2">允许访问的媒体库</div>
                                                        <div className="space-y-2">
                                                            {libraries.map((lib) => (
                                                                <div key={lib.ItemId} className="flex items-center justify-between p-2 rounded bg-background">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm">{lib.Name}</span>
                                                                        <Badge variant="outline" className="text-[10px]">{lib.CollectionType || '未分类'}</Badge>
                                                                    </div>
                                                                    <Checkbox
                                                                        checked={(userPolicy.EnabledFolders || []).includes(lib.ItemId)}
                                                                        onCheckedChange={() => toggleLibraryAccess(lib.ItemId)}
                                                                        disabled={updatePolicyMutation.isPending}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {[
                                                    { key: 'EnableRemoteAccess', label: '远程访问', desc: '允许从外部网络访问' },
                                                    { key: 'EnableMediaPlayback', label: '媒体播放', desc: '允许播放媒体' },
                                                    { key: 'EnableContentDownloading', label: '内容下载', desc: '允许下载媒体' },
                                                    { key: 'EnableContentDeletion', label: '内容删除', desc: '允许删除媒体文件' },
                                                    { key: 'EnableLiveTvAccess', label: '直播电视', desc: '访问直播电视功能' },
                                                    { key: 'EnablePlaybackRemuxing', label: '转封装播放', desc: '允许转封装播放' },
                                                    { key: 'EnableVideoPlaybackTranscoding', label: '视频转码', desc: '允许视频转码' },
                                                    { key: 'EnableAudioPlaybackTranscoding', label: '音频转码', desc: '允许音频转码' },
                                                ].map(({ key, label, desc }) => (
                                                    <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                                                        <div>
                                                            <div className="font-medium text-sm">{label}</div>
                                                            <div className="text-xs text-muted-foreground">{desc}</div>
                                                        </div>
                                                        <Checkbox
                                                            checked={!!userPolicy[key]}
                                                            onCheckedChange={(checked) => togglePolicyField(key, !!checked)}
                                                            disabled={updatePolicyMutation.isPending}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            无法加载用户权限
                                        </div>
                                    )}
                                </ScrollArea>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    )
}
