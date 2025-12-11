'use client'

import { useState, useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Film, Tv } from 'lucide-react'
import Image from 'next/image'

interface TmdbItem {
    id: number
    title: string
    posterPath: string | null
    subtitle?: string
    rating?: number
}

interface PageData {
    items: TmdbItem[]
    total: number
    page: number
    totalPages: number
}

import { TmdbDetailDialog } from '@/components/tmdb/tmdb-detail-dialog'


import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { MOVIE_GENRES, TV_GENRES } from '@/lib/tmdb/genres'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TmdbPreviewPage() {
    const [activeTab, setActiveTab] = useState('movie')
    const [ref, inView] = useIntersectionObserver()
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)

    // 搜索和筛选状态
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selectedGenre, setSelectedGenre] = useState<string>('all')

    // 防抖处理
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // 切换标签页时重置筛选
    const handleTabChange = (value: string) => {
        setActiveTab(value)
        setSelectedGenre('all')
        setSearchTerm('')
        setDebouncedSearch('')
    }

    const clearFilters = () => {
        setSearchTerm('')
        setDebouncedSearch('')
        setSelectedGenre('all')
    }

    const handleItemClick = (id: number) => {
        setSelectedId(id)
        setDetailOpen(true)
    }

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteQuery({
        queryKey: ['tmdb-library', activeTab, debouncedSearch, selectedGenre],
        queryFn: async ({ pageParam = 1 }) => {
            const params = new URLSearchParams({
                type: activeTab,
                page: pageParam.toString(),
                limit: '50',
            })

            if (debouncedSearch) params.append('search', debouncedSearch)
            if (selectedGenre && selectedGenre !== 'all') params.append('genre', selectedGenre)

            const res = await fetch(`/api/tmdb/library?${params.toString()}`)
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json() as Promise<PageData>
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            if (lastPage.page < lastPage.totalPages) return lastPage.page + 1
            return undefined
        },
    })

    useEffect(() => {
        if (inView && hasNextPage) {
            fetchNextPage()
        }
    }, [inView, fetchNextPage, hasNextPage])

    const currentGenres = activeTab === 'movie' ? MOVIE_GENRES : TV_GENRES

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold tracking-tight">TMDB 预览</h1>
                    {!isLoading && data?.pages[0]?.total !== undefined && (
                        <Badge variant="secondary" className="text-sm font-normal">
                            共 {data.pages[0].total} 部
                        </Badge>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索名称..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                        <SelectTrigger className="w-full md:w-[140px]">
                            <SelectValue placeholder="全部分类" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部分类</SelectItem>
                            {currentGenres.map(g => (
                                <SelectItem key={g.id} value={g.id.toString()}>
                                    {g.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs defaultValue="movie" value={activeTab} className="w-full" onValueChange={handleTabChange}>
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="movie" className="flex items-center gap-2">
                        <Film className="h-4 w-4" />
                        电影
                    </TabsTrigger>
                    <TabsTrigger value="tv" className="flex items-center gap-2">
                        <Tv className="h-4 w-4" />
                        电视剧
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {data?.pages.map((page) =>
                                page.items.map((item) => (
                                    <Card
                                        key={`${activeTab}-${item.id}`}
                                        className="overflow-hidden border-0 bg-transparent shadow-none group cursor-pointer"
                                        onClick={() => handleItemClick(item.id)}
                                    >
                                        <CardContent className="p-0 relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                                            {item.posterPath ? (
                                                <Image
                                                    src={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
                                                    alt={item.title}
                                                    fill
                                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                                    无封面
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                                <p className="text-white font-medium line-clamp-2">{item.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {item.rating && (
                                                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30">
                                                            {item.rating.toFixed(1)}
                                                        </Badge>
                                                    )}
                                                    {item.subtitle && (
                                                        <span className="text-xs text-gray-300">{item.subtitle}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}

                    {/* Infinite scroll trigger */}
                    <div ref={ref} className="py-8 flex justify-center">
                        {isFetchingNextPage && (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        )}
                        {!hasNextPage && !isLoading && data?.pages[0]?.items.length !== 0 && (
                            <p className="text-sm text-muted-foreground">没有更多了</p>
                        )}
                        {!isLoading && data?.pages?.every(p => p.items.length === 0) && (
                            <div className="text-center py-20 text-muted-foreground space-y-2">
                                <p>未找到相关内容</p>
                                {(debouncedSearch || selectedGenre !== 'all') && (
                                    <Button variant="link" onClick={clearFilters}>清除筛选</Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Tabs>

            <TmdbDetailDialog
                id={selectedId}
                type={activeTab as 'movie' | 'tv'}
                open={detailOpen}
                onOpenChange={setDetailOpen}
            />
        </div>
    )
}
