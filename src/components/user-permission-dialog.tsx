'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Loader2, Shield, FolderOpen } from 'lucide-react'

interface Library {
    Name: string
    ItemId: string
    CollectionType: string
}

interface UserPermissionDialogProps {
    serverId: string
    userId: string
    username: string
    trigger?: React.ReactNode
}

export function UserPermissionDialog({ serverId, userId, username, trigger }: UserPermissionDialogProps) {
    const [open, setOpen] = useState(false)
    const queryClient = useQueryClient()

    // Fetch user policy
    const { data: userPolicy, isLoading: loadingPolicy } = useQuery({
        queryKey: ['user-policy', userId, serverId],
        queryFn: async () => {
            const res = await fetch(`/api/users/${userId}/policy?serverId=${serverId}`)
            if (!res.ok) throw new Error('Failed to fetch policy')
            return res.json()
        },
        enabled: open,
    })

    // Fetch libraries
    const { data: libraries } = useQuery<Library[]>({
        queryKey: ['server-libraries', serverId],
        queryFn: async () => {
            const res = await fetch(`/api/servers/${serverId}/libraries`)
            if (!res.ok) throw new Error('Failed to fetch libraries')
            return res.json()
        },
        enabled: open,
    })

    // Update policy mutation
    const updatePolicyMutation = useMutation({
        mutationFn: async (policy: Record<string, unknown>) => {
            const res = await fetch(`/api/users/${userId}/policy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId, policy }),
            })
            if (!res.ok) throw new Error('Failed to update policy')
            return res.json()
        },
        onSuccess: () => {
            toast.success('权限更新成功')
            queryClient.invalidateQueries({ queryKey: ['user-policy', userId] })
        },
        onError: () => {
            toast.error('权限更新失败')
        },
    })

    const togglePolicyField = (field: string, value: boolean) => {
        updatePolicyMutation.mutate({ [field]: value })
    }

    const toggleLibraryAccess = (libraryId: string) => {
        if (!userPolicy) return
        const currentFolders = userPolicy.EnabledFolders || []
        const newFolders = currentFolders.includes(libraryId)
            ? currentFolders.filter((id: string) => id !== libraryId)
            : [...currentFolders, libraryId]
        updatePolicyMutation.mutate({ EnabledFolders: newFolders })
    }

    const policyItems = [
        { key: 'IsAdministrator', label: '管理员权限', desc: '完全访问服务器设置' },
        { key: 'IsDisabled', label: '禁用账户', desc: '阻止用户登录' },
        { key: 'EnableAllFolders', label: '访问所有媒体库', desc: '允许访问所有媒体库' },
    ]

    const otherPolicyItems = [
        { key: 'EnableRemoteAccess', label: '远程访问', desc: '允许从外部网络访问' },
        { key: 'EnableMediaPlayback', label: '媒体播放', desc: '允许播放媒体' },
        { key: 'EnableContentDownloading', label: '内容下载', desc: '允许下载媒体' },
        { key: 'EnableContentDeletion', label: '内容删除', desc: '允许删除媒体文件' },
        { key: 'EnableLiveTvAccess', label: '直播电视', desc: '访问直播电视功能' },
        { key: 'EnablePlaybackRemuxing', label: '转封装播放', desc: '允许转封装播放' },
        { key: 'EnableVideoPlaybackTranscoding', label: '视频转码', desc: '允许视频转码' },
        { key: 'EnableAudioPlaybackTranscoding', label: '音频转码', desc: '允许音频转码' },
    ]

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm">
                        <Shield className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        {username} - 权限管理
                    </DialogTitle>
                    <DialogDescription>
                        编辑该用户在 Emby 服务器上的权限
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                    {loadingPolicy ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : userPolicy ? (
                        <div className="space-y-3">
                            {/* Main policy items */}
                            {policyItems.map(({ key, label, desc }) => (
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

                            {/* Library Selection */}
                            {!userPolicy.EnableAllFolders && libraries && libraries.length > 0 && (
                                <div className="p-3 rounded-lg border bg-muted/30">
                                    <div className="flex items-center gap-2 font-medium text-sm mb-2">
                                        <FolderOpen className="h-4 w-4" />
                                        允许访问的媒体库
                                    </div>
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

                            {/* Other policy items */}
                            {otherPolicyItems.map(({ key, label, desc }) => (
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
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            无法加载用户权限
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
