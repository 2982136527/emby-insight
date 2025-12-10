'use client'

import * as React from 'react'
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    LayoutDashboard,
    Server,
    History,
    Trophy,
    BarChart3,
    Moon,
    Sun,
    Monitor,
} from 'lucide-react'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useQuery } from '@tanstack/react-query'

export function CommandMenu() {
    const [open, setOpen] = React.useState(false)
    const router = useRouter()
    const { setTheme } = useTheme()

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false)
        command()
    }, [])

    // Query users for search
    const { data: users } = useQuery<{ id: string; username: string; serverName: string }[]>({
        queryKey: ['users-search'],
        queryFn: async () => {
            const res = await fetch('/api/users?limit=100') // Get reasonable amount
            if (!res.ok) return []
            const data = await res.json()
            return data.users || []
        },
        enabled: open, // Only fetch when open
    })

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="输入命令或搜索..." />
            <CommandList>
                <CommandEmpty>未找到结果</CommandEmpty>
                <CommandGroup heading="导航">
                    <CommandItem onSelect={() => runCommand(() => router.push('/'))}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>仪表盘</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/servers'))}>
                        <Server className="mr-2 h-4 w-4" />
                        <span>服务器</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/users'))}>
                        <User className="mr-2 h-4 w-4" />
                        <span>用户</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/sessions'))}>
                        <History className="mr-2 h-4 w-4" />
                        <span>会话日志</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/leaderboard'))}>
                        <Trophy className="mr-2 h-4 w-4" />
                        <span>排行榜</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>设置</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="统计分析">
                    <CommandItem onSelect={() => runCommand(() => router.push('/stats/time'))}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span>时间分析</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/stats/calendar'))}>
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>观看日历</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/stats/devices'))}>
                        <Monitor className="mr-2 h-4 w-4" />
                        <span>设备分析</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="用户">
                    {users?.slice(0, 5).map((user) => (
                        <CommandItem
                            key={user.id}
                            onSelect={() => runCommand(() => router.push(`/users/${user.id}`))}
                        >
                            <User className="mr-2 h-4 w-4" />
                            <span>{user.username}</span>
                            <span className="ml-2 text-xs text-muted-foreground">({user.serverName})</span>
                        </CommandItem>
                    ))}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="主题">
                    <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>浅色模式</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
                        <Moon className="mr-2 h-4 w-4" />
                        <span>深色模式</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}
