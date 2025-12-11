'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Star, Calendar, Clock, MapPin } from 'lucide-react'
import Image from 'next/image'

interface TmdbDetailDialogProps {
    id: number | null
    type: 'movie' | 'tv'
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface DetailData {
    id: number
    title: string
    originalTitle: string
    overview: string
    posterUrl: string | null
    backdropUrl: string | null
    voteAverage: number
    releaseDate?: string // movie
    firstAirDate?: string // tv
    runtime?: number
    numberOfSeasons?: number
    numberOfEpisodes?: number
    genres: Array<{ id: number; name: string }>
    credits?: {
        cast: Array<{
            id: number
            name: string
            character: string
            profile_path: string | null
        }>
        crew: Array<{
            id: number
            name: string
            job: string
            profile_path: string | null
        }>
    }
    images?: {
        backdrops?: Array<{ file_path: string }>
        posters?: Array<{ file_path: string }>
    }
}

export function TmdbDetailDialog({ id, type, open, onOpenChange }: TmdbDetailDialogProps) {
    const [data, setData] = useState<DetailData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open && id) {
            setLoading(true)
            setError(null)
            fetch(`/api/tmdb/${type}/${id}`)
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch details')
                    return res.json()
                })
                .then(json => {
                    if (json.error) throw new Error(json.error)
                    setData(json.data)
                })
                .catch(err => setError(err.message))
                .finally(() => setLoading(false))
        } else {
            setData(null)
        }
    }, [open, id, type])

    if (!open) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden flex flex-col gap-0 bg-background/95 backdrop-blur-xl">
                <DialogTitle className="sr-only">
                    {data?.title || 'TMDB 详情'}
                </DialogTitle>
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-destructive">
                        {error}
                    </div>
                ) : data ? (
                    <>
                        <div className="relative h-64 md:h-80 w-full shrink-0">
                            {data.backdropUrl ? (
                                <Image
                                    src={data.backdropUrl}
                                    alt={data.title}
                                    fill
                                    className="object-cover opacity-40 mask-image-gradient-b"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-full h-full bg-muted" />
                            )}
                            <div className="absolute bottom-0 left-0 p-6 w-full bg-gradient-to-t from-background to-transparent pt-20">
                                <div className="flex items-end gap-6">
                                    {data.posterUrl && (
                                        <div className="hidden md:block relative w-32 aspect-[2/3] rounded-lg overflow-hidden shadow-xl ring-2 ring-background">
                                            <Image
                                                src={data.posterUrl}
                                                alt={data.title}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-2">
                                        <h2 className="text-3xl font-bold leading-none tracking-tight">
                                            {data.title}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                            {data.originalTitle && <span>{data.originalTitle}</span>}
                                            {data.releaseDate && (
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {data.releaseDate.split('-')[0]}
                                                </div>
                                            )}
                                            {data.firstAirDate && (
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {data.firstAirDate.split('-')[0]}
                                                </div>
                                            )}
                                            {data.voteAverage && (
                                                <div className="flex items-center gap-1 text-yellow-500">
                                                    <Star className="w-3 h-3 fill-current" />
                                                    {data.voteAverage.toFixed(1)}
                                                </div>
                                            )}
                                        </div>
                                        {data.genres?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {data.genres.map(g => (
                                                    <Badge key={g.id} variant="secondary" className="text-xs">
                                                        {g.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid gap-6">
                                <section>
                                    <h3 className="text-lg font-semibold mb-2">简介</h3>
                                    <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                                        {data.overview || '暂无简介'}
                                    </p>
                                </section>

                                <Tabs defaultValue="cast" className="w-full">
                                    <TabsList>
                                        <TabsTrigger value="cast">演员表 ({data.credits?.cast?.length || 0})</TabsTrigger>
                                        <TabsTrigger value="crew">制作人员 ({data.credits?.crew?.length || 0})</TabsTrigger>
                                        <TabsTrigger value="images">剧照 ({data.images?.backdrops?.length || 0})</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="cast" className="mt-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {data.credits?.cast?.map(person => (
                                                <div key={person.id} className="flex flex-col gap-2">
                                                    <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-muted">
                                                        {person.profile_path ? (
                                                            <Image
                                                                src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                                                                alt={person.name}
                                                                fill
                                                                className="object-cover"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">暂无图片</div>
                                                        )}
                                                    </div>
                                                    <div className="text-sm">
                                                        <div className="font-medium truncate" title={person.name}>{person.name}</div>
                                                        <div className="text-muted-foreground text-xs truncate" title={person.character}>{person.character}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="crew" className="mt-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {data.credits?.crew?.map(person => (
                                                <div key={`${person.id}-${person.job}`} className="flex flex-col gap-2">
                                                    <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-muted">
                                                        {person.profile_path ? (
                                                            <Image
                                                                src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                                                                alt={person.name}
                                                                fill
                                                                className="object-cover"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">暂无图片</div>
                                                        )}
                                                    </div>
                                                    <div className="text-sm">
                                                        <div className="font-medium truncate" title={person.name}>{person.name}</div>
                                                        <div className="text-muted-foreground text-xs truncate" title={person.job}>{person.job}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="images" className="mt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {data.images?.backdrops?.map((img, i) => (
                                                <div key={i} className="relative aspect-video rounded-md overflow-hidden bg-muted">
                                                    <Image
                                                        src={`https://image.tmdb.org/t/p/w780${img.file_path}`}
                                                        alt="Backdrop"
                                                        fill
                                                        className="object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
