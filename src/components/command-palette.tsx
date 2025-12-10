'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, User, Film, Tv, Loader2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface SearchResult {
    users: Array<{ id: string; name: string; serverName: string }>
    media: Array<{ itemId: string; itemName: string; itemType: string; seriesName?: string; serverId: string }>
}

export function CommandPalette() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult>({ users: [], media: [] })
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    // Cmd+K shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setOpen(true)
            }
            if (e.key === 'Escape') {
                setOpen(false)
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Search debounced
    useEffect(() => {
        if (!query || query.length < 2) {
            setResults({ users: [], media: [] })
            return
        }

        const timer = setTimeout(async () => {
            setIsLoading(true)
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
                if (res.ok) {
                    setResults(await res.json())
                }
            } catch {
                // Ignore errors
            }
            setIsLoading(false)
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    const handleSelect = useCallback((type: 'user' | 'media', id: string, serverId?: string) => {
        setOpen(false)
        setQuery('')
        if (type === 'user') {
            router.push(`/users/${id}`)
        } else {
            router.push(`/media/${id}?serverId=${serverId}`)
        }
    }, [router])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-lg p-0 gap-0">
                <div className="flex items-center border-b px-3">
                    <Search className="h-4 w-4 text-muted-foreground mr-2" />
                    <Input
                        placeholder="搜索用户或媒体..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="border-0 focus-visible:ring-0 text-base"
                        autoFocus
                    />
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                    {results.users.length > 0 && (
                        <div className="p-2">
                            <p className="text-xs font-medium text-muted-foreground px-2 mb-1">用户</p>
                            {results.users.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => handleSelect('user', user.id)}
                                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left"
                                >
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">{user.name}</span>
                                    <span className="text-xs text-muted-foreground">{user.serverName}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {results.media.length > 0 && (
                        <div className="p-2">
                            <p className="text-xs font-medium text-muted-foreground px-2 mb-1">媒体</p>
                            {results.media.map((item) => (
                                <button
                                    key={item.itemId}
                                    onClick={() => handleSelect('media', item.itemId, item.serverId)}
                                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left"
                                >
                                    {item.itemType === 'Movie' ? (
                                        <Film className="h-4 w-4 text-violet-500" />
                                    ) : (
                                        <Tv className="h-4 w-4 text-cyan-500" />
                                    )}
                                    <div>
                                        <span className="font-medium text-sm">{item.itemName}</span>
                                        {item.seriesName && (
                                            <span className="text-xs text-muted-foreground ml-1">({item.seriesName})</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {query.length >= 2 && !isLoading && results.users.length === 0 && results.media.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">未找到结果</p>
                    )}
                    {query.length < 2 && (
                        <p className="text-sm text-muted-foreground text-center py-8">输入至少2个字符开始搜索</p>
                    )}
                </div>
                <div className="border-t p-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span>↑↓ 导航</span>
                    <span>↵ 选择</span>
                    <span>ESC 关闭</span>
                </div>
            </DialogContent>
        </Dialog>
    )
}
