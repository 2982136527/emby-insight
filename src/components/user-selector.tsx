'use client'

import { useQuery } from '@tanstack/react-query'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Users, UserCog, User } from 'lucide-react'

interface UserSelectorProps {
    value?: string
    onChange: (value: string | undefined) => void
    className?: string
}

interface GlobalUser {
    id: string
    name: string
    avatar: string | null
    serverUsers: Array<{ id: string; username: string }>
}

interface ServerUser {
    id: string
    username: string
    globalUser: { id: string; name: string } | null
    server: { name: string }
}

interface AllUsersResponse {
    globalUsers: GlobalUser[]
    serverUsers: ServerUser[]
}

export function UserSelector({ value, onChange, className }: UserSelectorProps) {
    const { data, isLoading } = useQuery<AllUsersResponse>({
        queryKey: ['all-users-for-selector'],
        queryFn: async () => {
            // Fetch global users
            const globalRes = await fetch('/api/users/global')
            if (!globalRes.ok) throw new Error('Failed to fetch global users')
            const globalUsers = await globalRes.json()

            // Fetch all server users
            const serverRes = await fetch('/api/users')
            if (!serverRes.ok) throw new Error('Failed to fetch server users')
            const serverUsers: ServerUser[] = await serverRes.json()

            return { globalUsers, serverUsers }
        },
    })

    if (isLoading) {
        return (
            <div className={cn("h-10 w-[200px] bg-muted/50 rounded-md animate-pulse", className)} />
        )
    }

    const globalUsers = data?.globalUsers || []
    const serverUsers = data?.serverUsers || []

    return (
        <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? undefined : v)}>
            <SelectTrigger className={cn("w-[200px]", className)}>
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="所有用户" />
                </div>
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">
                    <span className="font-medium">所有用户</span>
                </SelectItem>

                {/* Global Users Section */}
                {globalUsers.length > 0 && (
                    <>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            全局用户（聚合）
                        </div>
                        {globalUsers.map((user) => (
                            <SelectItem key={`global-${user.id}`} value={`global:${user.id}`}>
                                <div className="flex items-center gap-2">
                                    <UserCog className="h-4 w-4 text-violet-500" />
                                    <span>{user.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        ({user.serverUsers?.length || 0}个账号)
                                    </span>
                                </div>
                            </SelectItem>
                        ))}
                    </>
                )}

                {/* All Server Users Section */}
                {serverUsers.length > 0 && (
                    <>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-1">
                            服务器用户（单独）
                        </div>
                        {serverUsers.map((user) => (
                            <SelectItem key={`server-${user.id}`} value={`server:${user.id}`}>
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-cyan-500" />
                                    <span>{user.username}</span>
                                    <span className="text-xs text-muted-foreground">
                                        @{user.server.name}
                                    </span>
                                </div>
                            </SelectItem>
                        ))}
                    </>
                )}
            </SelectContent>
        </Select>
    )
}
