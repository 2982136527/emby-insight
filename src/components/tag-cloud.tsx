'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tags, Loader2 } from 'lucide-react'

interface Tag {
    tag: string
    weight: number
    count: number
    size: number // 1-10 scale
}

interface TagData {
    tags: Tag[]
    total: number
}

const TAG_COLORS = [
    'bg-violet-500/30 text-violet-400 border-violet-500/50',
    'bg-cyan-500/30 text-cyan-400 border-cyan-500/50',
    'bg-emerald-500/30 text-emerald-400 border-emerald-500/50',
    'bg-amber-500/30 text-amber-400 border-amber-500/50',
    'bg-rose-500/30 text-rose-400 border-rose-500/50',
    'bg-blue-500/30 text-blue-400 border-blue-500/50',
    'bg-pink-500/30 text-pink-400 border-pink-500/50',
    'bg-orange-500/30 text-orange-400 border-orange-500/50',
]

interface TagCloudProps {
    compact?: boolean
}

export function TagCloud({ compact = false }: TagCloudProps) {
    const { data, isLoading } = useQuery<TagData>({
        queryKey: ['tags'],
        queryFn: async () => {
            const res = await fetch('/api/stats/tags')
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
    })

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Tags className="h-5 w-5" />
                        标签偏好
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-24">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (!data || data.tags.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Tags className="h-5 w-5" />
                        标签偏好
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                    暂无标签数据
                </CardContent>
            </Card>
        )
    }

    // Sort by weight - show limited tags in compact mode
    const allTags = [...data.tags].sort((a, b) => b.weight - a.weight)
    const topTags = compact ? allTags.slice(0, 30) : allTags

    return (
        <Card>
            <CardHeader className={compact ? "pb-2 pt-3" : "pb-3"}>
                <CardTitle className={`flex items-center gap-2 ${compact ? 'text-sm' : 'text-base'}`}>
                    <Tags className="h-4 w-4 text-primary" />
                    标签偏好
                    <Badge variant="outline" className="ml-auto text-[10px] font-normal">
                        {compact ? `${topTags.length}/${data.total}` : `${data.total} 个标签`}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className={compact ? "pt-0 pb-3" : "pt-0"}>
                <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
                    {topTags.map((tag, index) => {
                        const colorClass = TAG_COLORS[index % TAG_COLORS.length]
                        // Opacity based on rank
                        const opacity = 1 - (index / topTags.length) * 0.4

                        return (
                            <Badge
                                key={tag.tag}
                                variant="outline"
                                className={`text-xs font-normal px-2 py-0.5 transition-all hover:scale-105 cursor-default ${colorClass}`}
                                style={{ opacity }}
                                title={`播放 ${tag.count} 次`}
                            >
                                {tag.tag}
                            </Badge>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
