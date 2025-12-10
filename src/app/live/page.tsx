'use client'

import { ActiveSessions } from '@/components/active-sessions'

export default function LivePage() {
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in p-4 gap-4">
            <div className="flex-none">
                <h1 className="text-2xl font-bold tracking-tight">实时监控</h1>
                <p className="text-sm text-muted-foreground mt-1">当前正在进行的会话与播放状态</p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2">
                <ActiveSessions />
            </div>
        </div>
    )
}
