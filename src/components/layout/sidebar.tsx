'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/server-store'
import {
    LayoutDashboard,
    Server,
    Users,
    Clock,
    Film,
    TrendingUp,
    Trophy,
    Settings,
    Menu,
    X,
    Moon,
    Sun,
    Ban,
    HardDrive,
    ChevronDown,
    Monitor,
    History,
    CalendarDays,
    Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { AutoSync } from '@/components/auto-sync'

const navItems = [
    {
        title: '仪表盘',
        href: '/',
        icon: LayoutDashboard,
    },
    {
        title: '实时监控',
        href: '/live',
        icon: Monitor,
    },
    {
        title: '服务器',
        href: '/servers',
        icon: Server,
    },
    {
        title: '用户',
        href: '/users',
        icon: Users,
    },
    {
        title: '统计',
        href: '#',
        icon: TrendingUp,
        children: [
            { title: '时间分析', href: '/stats/time', icon: Clock },
            { title: '内容分析', href: '/stats/content', icon: Film },
            { title: '观看日历', href: '/stats/calendar', icon: CalendarDays },
            { title: '马拉松检测', href: '/stats/marathon', icon: TrendingUp },
            { title: '弃剧分析', href: '/stats/abandoned', icon: Ban },
            { title: '观看预测', href: '/stats/prediction', icon: Clock },
            { title: '存储分析', href: '/stats/storage', icon: HardDrive },
            { title: '设备分析', href: '/stats/devices', icon: Monitor },
            { title: '数据导出', href: '/stats/export', icon: Download },
        ],
    },
    {
        title: '会话日志',
        href: '/sessions',
        icon: History,
    },
    {
        title: '排行榜',
        href: '/leaderboard',
        icon: Trophy,
    },
    {
        title: '设置',
        href: '/settings',
        icon: Settings,
    },
]

export function Sidebar() {
    const pathname = usePathname()
    const { sidebarOpen, setSidebarOpen } = useUIStore()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [statsExpanded, setStatsExpanded] = useState(true)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true)
    }, [])

    return (
        <>
            {/* 移动端遮罩 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* 移动端切换按钮 */}
            <Button
                variant="ghost"
                size="icon"
                className="fixed top-4 left-4 z-50 lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* 侧边栏 */}
            <aside
                className={cn(
                    'fixed z-50 flex w-64 flex-col bg-card/95 backdrop-blur-sm border border-border transition-transform duration-300',
                    'inset-y-0 left-0 rounded-none',
                    'lg:top-4 lg:bottom-4 lg:left-4 lg:rounded-xl lg:shadow-lg',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                {/* 标志 */}
                <div className="flex h-16 items-center gap-3 border-b border-border/50 px-6">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-5 w-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            {/* Play button triangle */}
                            <path d="M6 4l12 8-12 8V4z" fill="currentColor" opacity="0.3" />
                            {/* Chart bars */}
                            <rect x="2" y="14" width="3" height="6" rx="0.5" fill="currentColor" />
                            <rect x="7" y="10" width="3" height="10" rx="0.5" fill="currentColor" />
                            <rect x="12" y="6" width="3" height="14" rx="0.5" fill="currentColor" />
                            <rect x="17" y="2" width="3" height="18" rx="0.5" fill="currentColor" />
                        </svg>
                    </div>
                    <span className="text-lg font-semibold text-foreground">EmbyInsight</span>
                </div>

                {/* 导航 */}
                <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-none">
                    {navItems.map((item) => (
                        <div key={item.title}>
                            {item.children ? (
                                <div className="space-y-1">
                                    <button
                                        onClick={() => setStatsExpanded(!statsExpanded)}
                                        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="h-4 w-4" />
                                            {item.title}
                                        </div>
                                        <ChevronDown
                                            className={cn(
                                                "h-4 w-4 transition-transform duration-200",
                                                statsExpanded ? "rotate-0" : "-rotate-90"
                                            )}
                                        />
                                    </button>
                                    <div className={cn(
                                        "ml-4 space-y-0.5 overflow-hidden transition-all duration-200",
                                        statsExpanded ? "max-h-[40rem] opacity-100" : "max-h-0 opacity-0"
                                    )}>
                                        {item.children.map((child) => (
                                            <Link
                                                key={child.href}
                                                href={child.href}
                                                className={cn(
                                                    'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors',
                                                    pathname === child.href
                                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                                )}
                                                onClick={() => setSidebarOpen(false)}
                                            >
                                                <child.icon className="h-4 w-4" />
                                                {child.title}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <Link
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                        pathname === item.href
                                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                    )}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.title}
                                </Link>
                            )}
                        </div>
                    ))}
                </nav>

                {/* 自动同步 & 主题切换 */}
                <div className="border-t border-sidebar-border p-4 space-y-2">
                    <AutoSync />
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                        {mounted && (
                            <>
                                {theme === 'dark' ? (
                                    <Sun className="h-4 w-4" />
                                ) : (
                                    <Moon className="h-4 w-4" />
                                )}
                                <span className="text-sm">
                                    {theme === 'dark' ? '浅色模式' : '深色模式'}
                                </span>
                            </>
                        )}
                    </Button>
                </div>
            </aside>
        </>
    )
}
