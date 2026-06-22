import * as fs from 'fs'
import * as path from 'path'
import { handleTmdbRequest } from './proxy'
import { tmdbProxyConfig } from './config'

interface WarmerState {
    currentYear: number
    lastCompletedPage: number
    lastCompletedTvPage?: number
    yearInProgress: boolean
    hotLoopTaskIndex?: number
    hotLoopPageIndex?: number
}

const CHECKPOINT_FILE = path.resolve(process.cwd(), 'warmer_checkpoint.json')

export class CacheWarmer {
    private isRunning = false
    private apiKey = ''

    public start() {
        const apiKey = tmdbProxyConfig.tmdb.apiKey
        if (this.isRunning || !apiKey) return
        this.apiKey = apiKey
        this.isRunning = true

        console.log('[WARMER] Cache Warmer started (Triple-Engine: Hot/Cold/Changes)')

        this.startHotLoop().catch(err => console.error(`[HOT-LOOP] Crash: ${err.message}`))
        this.startChangesLoop().catch(err => console.error(`[CHANGES-LOOP] Crash: ${err.message}`))
        this.startColdLoop().catch(err => console.error(`[COLD-LOOP] Crash: ${err.message}`))
    }

    public stop() {
        this.isRunning = false
    }

    public isWarmerRunning() {
        return this.isRunning
    }

    private async startHotLoop() {
        while (this.isRunning) {
            try {
                await this.runHotCrawl()
                await new Promise(r => setTimeout(r, 4 * 3600 * 1000))
            } catch (e: any) {
                console.error(`[HOT-LOOP] Error: ${e.message}`)
                await new Promise(r => setTimeout(r, 60 * 1000))
            }
        }
    }

    private async startColdLoop() {
        while (this.isRunning) {
            try {
                await this.runFullCrawl()
            } catch (e: any) {
                console.error(`[COLD-LOOP] Error: ${e.message}`)
                await new Promise(r => setTimeout(r, 60 * 1000))
            }
        }
    }

    private async startChangesLoop() {
        let lastSyncDate = ''
        while (this.isRunning) {
            try {
                const today = new Date().toISOString().split('T')[0]!
                if (today !== lastSyncDate) {
                    await this.runChangesSync()
                    lastSyncDate = today
                }
                await new Promise(r => setTimeout(r, 6 * 3600 * 1000))
            } catch (e: any) {
                console.error(`[CHANGES-LOOP] Error: ${e.message}`)
                await new Promise(r => setTimeout(r, 60 * 1000))
            }
        }
    }

    private async runChangesSync() {
        const endDate = new Date().toISOString().split('T')[0]!
        const startDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0]!

        const [movieIds, tvIds] = await Promise.all([
            this.fetchChangedIds('3/movie/changes', startDate, endDate),
            this.fetchChangedIds('3/tv/changes', startDate, endDate),
        ])

        let refreshed = 0
        for (const id of movieIds) {
            if (!this.isRunning) break
            try {
                await handleTmdbRequest(`3/movie/${id}?api_key=${this.apiKey}&language=${tmdbProxyConfig.tmdb.language}`, true)
                refreshed++
                await new Promise(r => setTimeout(r, 1000))
            } catch { /* skip */ }
        }
        for (const id of tvIds) {
            if (!this.isRunning) break
            try {
                await handleTmdbRequest(`3/tv/${id}?api_key=${this.apiKey}&language=${tmdbProxyConfig.tmdb.language}`, true)
                refreshed++
                await new Promise(r => setTimeout(r, 1000))
            } catch { /* skip */ }
        }
        console.log(`[CHANGES-LOOP] Refreshed ${refreshed}/${movieIds.length + tvIds.length} items.`)
    }

    private async fetchChangedIds(endpoint: string, startDate: string, endDate: string): Promise<number[]> {
        const ids: number[] = []
        let page = 1
        while (page <= 50) {
            if (!this.isRunning) break
            const url = `${endpoint}?api_key=${this.apiKey}&start_date=${startDate}&end_date=${endDate}&page=${page}`
            try {
                const data = await handleTmdbRequest(url, true)
                for (const item of (data?.results || [])) {
                    if (item.id && !item.adult) ids.push(item.id)
                }
                if (page >= (data?.total_pages || 1)) break
                page++
                await new Promise(r => setTimeout(r, 500))
            } catch { break }
        }
        return ids
    }

    private async runHotCrawl() {
        const tasks = [
            { path: '3/movie/popular', maxPages: 20 },
            { path: '3/movie/now_playing', maxPages: 10 },
            { path: '3/movie/top_rated', maxPages: 5 },
            { path: '3/movie/upcoming', maxPages: 5 },
            { path: '3/tv/popular', maxPages: 10 },
            { path: '3/tv/top_rated', maxPages: 5 },
            { path: '3/tv/on_the_air', maxPages: 5 },
            { path: '3/tv/airing_today', maxPages: 3 },
            { path: '3/trending/all/day', maxPages: 10 },
            { path: '3/trending/movie/week', maxPages: 5 },
            { path: '3/trending/tv/week', maxPages: 5 },
        ]

        const state = this.loadCheckpoint()
        const startTaskIdx = state?.hotLoopTaskIndex ?? 0
        const startPageIdx = state?.hotLoopPageIndex ?? 0

        for (let ti = startTaskIdx; ti < tasks.length; ti++) {
            const task = tasks[ti]!
            const startPage = (ti === startTaskIdx) ? startPageIdx + 1 : 1
            for (let page = startPage; page <= task.maxPages; page++) {
                if (!this.isRunning) break
                const url = `${task.path}?api_key=${this.apiKey}&language=${tmdbProxyConfig.tmdb.language}&page=${page}`
                try {
                    await handleTmdbRequest(url, true)
                    this.saveHotLoopCheckpoint(ti, page)
                    await new Promise(r => setTimeout(r, 1500))
                } catch { /* skip */ }
            }
        }
        this.clearHotLoopCheckpoint()
    }

    private async runFullCrawl() {
        const currentYear = new Date().getFullYear() + 1
        const state = this.loadCheckpoint()

        for (let year = currentYear; year >= 1880; year--) {
            if (!this.isRunning) break
            const startPage = (state && year === state.currentYear && state.yearInProgress) ? state.lastCompletedPage + 1 : 1
            await this.crawlDiscover('3/discover/movie', { primary_release_year: year.toString() }, startPage, year, false)
            const tvStartPage = (state && year === state.currentYear && state.yearInProgress) ? (state.lastCompletedTvPage || 1) : 1
            await this.crawlDiscover('3/discover/tv', { first_air_date_year: year.toString() }, tvStartPage, year, true)
        }
    }

    private async crawlDiscover(endpoint: string, params: Record<string, string>, startPage: number, year: number, isTv: boolean) {
        let consecutiveErrors = 0
        for (let page = startPage; page <= 500; page++) {
            if (!this.isRunning) break
            const urlParams = new URLSearchParams(params)
            urlParams.set('api_key', this.apiKey)
            urlParams.set('language', tmdbProxyConfig.tmdb.language)
            urlParams.set('sort_by', 'popularity.desc')
            urlParams.set('page', page.toString())
            const url = `${endpoint}?${urlParams.toString()}`

            try {
                const data = await handleTmdbRequest(url, true)
                consecutiveErrors = 0
                if (isTv) this.saveTvCheckpoint(year, page)
                else this.saveCheckpoint(year, page)
                if (data?.total_pages && page >= data.total_pages) break
                await new Promise(r => setTimeout(r, 1000))
            } catch (e: any) {
                consecutiveErrors++
                if (consecutiveErrors >= 5) break
                if (e.response?.status === 404 || e.response?.status === 422) break
            }
        }
    }

    // Checkpoint methods
    private saveCheckpoint(year: number, page: number) {
        const existing = this.loadCheckpoint()
        const state: WarmerState = { currentYear: year, lastCompletedPage: page, yearInProgress: true, ...(existing?.lastCompletedTvPage != null ? { lastCompletedTvPage: existing.lastCompletedTvPage } : {}) }
        this.writeCheckpoint(state)
    }

    private saveTvCheckpoint(year: number, page: number) {
        const existing = this.loadCheckpoint()
        const state: WarmerState = { currentYear: year, lastCompletedPage: existing?.lastCompletedPage ?? 0, yearInProgress: true, ...(page > 0 ? { lastCompletedTvPage: page } : {}) }
        this.writeCheckpoint(state)
    }

    private saveHotLoopCheckpoint(taskIndex: number, pageIndex: number) {
        const existing = this.loadCheckpoint()
        const state: WarmerState = { currentYear: existing?.currentYear ?? new Date().getFullYear() + 1, lastCompletedPage: existing?.lastCompletedPage ?? 0, yearInProgress: existing?.yearInProgress ?? false, hotLoopTaskIndex: taskIndex, hotLoopPageIndex: pageIndex }
        this.writeCheckpoint(state)
    }

    private clearHotLoopCheckpoint() {
        const existing = this.loadCheckpoint()
        if (!existing) return
        delete existing.hotLoopTaskIndex
        delete existing.hotLoopPageIndex
        this.writeCheckpoint(existing)
    }

    private writeCheckpoint(state: WarmerState) {
        try {
            fs.writeFileSync(CHECKPOINT_FILE + '.tmp', JSON.stringify(state))
            fs.renameSync(CHECKPOINT_FILE + '.tmp', CHECKPOINT_FILE)
        } catch { /* ignore */ }
    }

    private loadCheckpoint(): WarmerState | null {
        try {
            if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
        } catch { /* ignore */ }
        return null
    }
}
