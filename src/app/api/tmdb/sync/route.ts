import { NextRequest, NextResponse } from 'next/server'
import { prisma, tmdbPrisma } from '@/lib/prisma'
import { TmdbClient, extractChineseTranslation } from '@/lib/tmdb'

// 同步任务状态 (内存中跟踪，避免并发)
// 同步任务状态 (内存中跟踪，避免并发)
let isSyncing = false
let shouldStop = false

// GET /api/tmdb/sync - 获取同步状态
export async function GET() {
    try {
        let statuses = await tmdbPrisma.tmdbSyncStatus.findMany()
        const config = await prisma.tmdbConfig.findFirst()

        // 自动修复：如果数据库显示 running 但实际没有同步任务在运行（重启后），重置状态
        for (const status of statuses) {
            if (status.status === 'running' && !isSyncing) {
                await tmdbPrisma.tmdbSyncStatus.update({
                    where: { type: status.type },
                    data: {
                        status: 'idle',
                        message: '同步任务已重置（服务重启）'
                    }
                })
            }
        }

        // 重新获取更新后的状态
        if (statuses.some(s => s.status === 'running' && !isSyncing)) {
            statuses = await tmdbPrisma.tmdbSyncStatus.findMany()
        }

        // 统计缓存数量
        const [movieCount, tvCount, personCount] = await Promise.all([
            tmdbPrisma.tmdbMovie.count(),
            tmdbPrisma.tmdbTvShow.count(),
            tmdbPrisma.tmdbPerson.count(),
        ])

        return NextResponse.json({
            hasApiKey: !!config?.apiKey,
            isSyncing,
            statuses: statuses.map(s => ({
                type: s.type,
                status: s.status,
                progress: s.progress,
                totalItems: s.totalItems,
                syncedItems: s.syncedItems,
                lastSyncDate: s.lastSyncDate,
                message: s.message,
            })),
            cache: {
                movies: movieCount,
                tvShows: tvCount,
                persons: personCount,
            },
        })
    } catch (error) {
        console.error('[TMDB] Failed to get sync status:', error)
        return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 })
    }
}

// POST /api/tmdb/sync - 启动同步任务
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { type = 'movie', limit, force = false } = body as { type?: 'movie' | 'tv' | 'person'; limit?: number; force?: boolean }

        // 检查 API Key
        const config = await prisma.tmdbConfig.findFirst()
        if (!config?.apiKey) {
            return NextResponse.json(
                { error: '请先配置 TMDB API Key' },
                { status: 400 }
            )
        }

        // 防止并发同步
        if (isSyncing) {
            return NextResponse.json(
                { error: '已有同步任务正在进行中' },
                { status: 409 }
            )
        }

        isSyncing = true
        shouldStop = false // 重置停止标志

        // 异步执行同步任务
        syncTask(config.apiKey, type, limit, force).finally(() => {
            isSyncing = false
            shouldStop = false
        })

        return NextResponse.json({
            message: `已启动 ${type} 同步任务`,
            type,
        })
    } catch (error) {
        console.error('[TMDB] Sync request failed:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    if (!isSyncing) {
        return NextResponse.json({ message: '当前没有运行中的同步任务' })
    }

    shouldStop = true
    return NextResponse.json({ message: '正在停止同步任务...' })
}

// 同步任务实现
async function syncTask(apiKey: string, type: 'movie' | 'tv' | 'person', limit?: number, force: boolean = false) {
    const client = new TmdbClient(apiKey, 'zh-CN')

    const exportType = type === 'tv' ? 'tv_series' : type

    // 更新状态为运行中
    await tmdbPrisma.tmdbSyncStatus.upsert({
        where: { type },
        update: { status: 'running', progress: 0, message: '正在下载每日导出文件...' },
        create: { type, status: 'running', progress: 0, message: '正在下载每日导出文件...' },
    })

    try {
        // 获取所有项目 ID
        let allIds: number[] = []
        try {
            if (type === 'person') {
                allIds = await client.downloadDailyExport('person')
            } else {
                allIds = await client.getIdList(type as 'movie' | 'tv')
            }
            // limit logic if needed? original code had limit param but unused?
            if (limit && limit > 0) {
                allIds = allIds.slice(0, limit)
            }
        } catch (error) {
            console.error('[TMDB] Failed to get ID list:', error)
            throw error
        }

        let newIds = allIds

        if (!force) {
            let existingIds: number[] = []
            if (type === 'movie') {
                // Movie: ID 存在且 isFullySynced=true 则跳过
                existingIds = (await tmdbPrisma.tmdbMovie.findMany({
                    where: {
                        id: { in: allIds },
                        isFullySynced: true
                    },
                    select: { id: true },
                })).map(m => m.id)
            } else if (type === 'tv') {
                // TV: ID 存在且 isFullySynced=true 且状态为 Ended/Canceled 则跳过
                // 状态不是已完结的，即使存在也要更新
                existingIds = (await tmdbPrisma.tmdbTvShow.findMany({
                    where: {
                        id: { in: allIds },
                        isFullySynced: true,
                        status: { in: ['Ended', 'Canceled', 'Ended Series'] }
                    },
                    select: { id: true },
                })).map(t => t.id)
            } else {
                // Person: ID 存在则跳过 (暂不校验完整性，假设存在即完整)
                // 也可以加上 isFullySynced 判断
                existingIds = (await tmdbPrisma.tmdbPerson.findMany({
                    where: { id: { in: allIds } },
                    select: { id: true },
                })).map(p => p.id)
            }

            const existingSet = new Set(existingIds)
            newIds = allIds.filter(id => !existingSet.has(id))
            console.log(`[TMDB] ${existingIds.length} already fully synced/ended, ${newIds.length} items to update/add`)
        } else {
            console.log(`[TMDB] Force sync enabled: Syncing all ${newIds.length} items (overwriting existing)`)
        }

        if (shouldStop) {
            throw new Error('用户已暂停同步')
        }


        await tmdbPrisma.tmdbSyncStatus.update({
            where: { type },
            data: {
                totalItems: newIds.length,
                syncedItems: 0,
                message: `待同步 ${newIds.length} 个项目`,
            },
        })

        let syncedCount = 0

        if (newIds.length > 0) {
            // 根据类型选择批量获取方法
            // 由于 generator 类型难以统一，这里分别处理或使用 any
            // 为了类型安全，我们分开写或者 cast

            if (type === 'movie') {
                for await (const batch of client.batchGetMovies(newIds)) {
                    if (shouldStop) break

                    for (const movie of batch) {
                        try {
                            const translations = await client.getMovieTranslations(movie.id)
                            const cn = extractChineseTranslation(translations)

                            const data = {
                                id: movie.id,
                                imdbId: movie.imdb_id,
                                title: movie.title,
                                originalTitle: movie.original_title,
                                titleCn: cn?.title || cn?.name,
                                overview: movie.overview,
                                overviewCn: cn?.overview,
                                releaseDate: movie.release_date,
                                runtime: movie.runtime,
                                popularity: movie.popularity,
                                voteAverage: movie.vote_average,
                                voteCount: movie.vote_count,
                                posterPath: movie.poster_path,
                                backdropPath: movie.backdrop_path,
                                genreIds: movie.genres ? JSON.stringify(movie.genres.map(g => g.id)) : null,
                                isAdult: movie.adult,
                                images: movie.images ? JSON.stringify(movie.images) : null,
                                credits: movie.credits ? JSON.stringify(movie.credits) : null,
                                isFullySynced: true,
                            }

                            await tmdbPrisma.tmdbMovie.upsert({
                                where: { id: movie.id },
                                update: data,
                                create: data,
                            })
                            syncedCount++
                        } catch (e) {
                            console.warn(`[TMDB] Failed to process movie ${movie.id}`, e)
                        }
                    }

                    // 更新进度
                    await tmdbPrisma.tmdbSyncStatus.update({
                        where: { type },
                        data: {
                            syncedItems: syncedCount,
                            progress: Math.floor((syncedCount / newIds.length) * 100),
                        }
                    })
                }
            } else if (type === 'tv') {
                for await (const batch of client.batchGetTvShows(newIds)) {
                    if (shouldStop) break

                    for (const tv of batch) {
                        try {
                            const translations = await client.getTvTranslations(tv.id)
                            const cn = extractChineseTranslation(translations)

                            const data = {
                                id: tv.id,
                                name: tv.name,
                                originalName: tv.original_name,
                                nameCn: cn?.name || cn?.title,
                                overview: tv.overview,
                                overviewCn: cn?.overview,
                                firstAirDate: tv.first_air_date,
                                lastAirDate: tv.last_air_date,
                                numberOfSeasons: tv.number_of_seasons,
                                numberOfEpisodes: tv.number_of_episodes,
                                popularity: tv.popularity,
                                voteAverage: tv.vote_average,
                                voteCount: tv.vote_count,
                                posterPath: tv.poster_path,
                                backdropPath: tv.backdrop_path,
                                genreIds: tv.genres ? JSON.stringify(tv.genres.map(g => g.id)) : null,
                                status: tv.status,
                                images: tv.images ? JSON.stringify(tv.images) : null,
                                credits: tv.credits ? JSON.stringify(tv.credits) : null,
                                isFullySynced: true,
                            }

                            await tmdbPrisma.tmdbTvShow.upsert({
                                where: { id: tv.id },
                                update: data,
                                create: data,
                            })
                            syncedCount++
                        } catch (e) {
                            console.warn(`[TMDB] Failed to process TV ${tv.id}`, e)
                        }
                    }

                    await tmdbPrisma.tmdbSyncStatus.update({
                        where: { type },
                        data: {
                            syncedItems: syncedCount,
                            progress: Math.floor((syncedCount / newIds.length) * 100),
                        }
                    })
                }
            } else if (type === 'person') {
                for await (const batch of client.batchGetPersons(newIds)) {
                    if (shouldStop) break

                    for (const person of batch) {
                        try {
                            const translations = await client.getPersonTranslations(person.id)
                            const cn = extractChineseTranslation(translations)

                            const data = {
                                id: person.id,
                                name: person.name,
                                originalName: person.name, // Person typically has one name, original name not distinct in processed data
                                nameCn: cn?.name,
                                biography: person.biography,
                                biographyCn: cn?.biography,
                                placeOfBirth: person.place_of_birth,
                                profilePath: person.profile_path,
                                knownForDepartment: person.known_for_department,
                                popularity: person.popularity,
                                gender: person.gender,
                                adult: person.adult,
                                images: person.images ? JSON.stringify(person.images) : null,
                            }

                            await tmdbPrisma.tmdbPerson.upsert({
                                where: { id: person.id },
                                update: data,
                                create: data,
                            })
                            syncedCount++
                        } catch (e) {
                            console.warn(`[TMDB] Failed to process person ${person.id}`, e)
                        }
                    }

                    await tmdbPrisma.tmdbSyncStatus.update({
                        where: { type },
                        data: {
                            syncedItems: syncedCount,
                            progress: Math.floor((syncedCount / newIds.length) * 100),
                        }
                    })
                }
            }
        } // end if newIds > 0

        // Final update
        if (shouldStop) {
            throw new Error('用户已暂停同步')
        }

        await tmdbPrisma.tmdbSyncStatus.update({
            where: { type },
            data: {
                status: 'completed',
                progress: 100,
                syncedItems: syncedCount,
                lastSyncDate: new Date(),
                message: `同步完成，共 ${syncedCount} 条`,
            },
        })

        console.log(`[TMDB] Sync completed: ${syncedCount} ${type} items`)

    } catch (error) { // Close outer try
        console.error(`[TMDB] Sync failed:`, error)

        await tmdbPrisma.tmdbSyncStatus.update({
            where: { type },
            data: {
                status: error instanceof Error && error.message.includes('暂停') ? 'paused' : 'failed',
                message: error instanceof Error ? error.message : '同步失败',
            },
        })
    }
}
