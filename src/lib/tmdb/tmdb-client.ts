

// 图片数据结构
export interface TmdbImage {
    file_path: string
    iso_639_1?: string
    vote_average?: number
    vote_count?: number
    width?: number
    height?: number
}

export interface TmdbImages {
    backdrops?: TmdbImage[]
    posters?: TmdbImage[]
    logos?: TmdbImage[]
    profiles?: TmdbImage[]
}

// TMDB API 响应类型
export interface TmdbMovieDetail {
    id: number
    imdb_id?: string
    title: string
    original_title?: string
    overview?: string
    release_date?: string
    runtime?: number
    popularity?: number
    vote_average?: number
    vote_count?: number
    poster_path?: string
    backdrop_path?: string
    genre_ids?: number[]
    genres?: Array<{ id: number; name: string }>
    adult: boolean
    images?: TmdbImages
    credits?: {
        cast: Array<{
            id: number
            name: string
            original_name: string
            character: string
            profile_path: string | null
            order: number
        }>
        crew: Array<{
            id: number
            name: string
            original_name: string
            job: string
            department: string
            profile_path: string | null
        }>
    }
}

export interface TmdbTvDetail {
    id: number
    name: string
    original_name?: string
    overview?: string
    first_air_date?: string
    last_air_date?: string
    number_of_seasons?: number
    number_of_episodes?: number
    popularity?: number
    vote_average?: number
    vote_count?: number
    poster_path?: string
    backdrop_path?: string
    genre_ids?: number[]
    genres?: Array<{ id: number; name: string }>
    status?: string
    images?: TmdbImages
    credits?: {
        cast: Array<{
            id: number
            name: string
            original_name: string
            character: string
            profile_path: string | null
            order: number
        }>
        crew: Array<{
            id: number
            name: string
            original_name: string
            job: string
            department: string
            profile_path: string | null
        }>
    }
}

export interface TmdbPersonDetail {
    id: number
    name: string
    biography?: string
    birthday?: string
    deathday?: string
    place_of_birth?: string
    profile_path?: string
    popularity?: number
    known_for?: Array<{ id: number; title?: string; name?: string }>
    known_for_department?: string
    gender?: number
    adult?: boolean
    images?: TmdbImages
}

export interface TmdbTranslation {
    iso_3166_1: string
    iso_639_1: string
    name: string
    english_name: string
    data: {
        title?: string
        name?: string
        overview?: string
        biography?: string
    }
}

export interface TmdbSearchResult<T> {
    page: number
    results: T[]
    total_pages: number
    total_results: number
}

// 每日导出文件中的项目格式
interface DailyExportItem {
    id: number
    adult?: boolean
    video?: boolean
    popularity?: number
    original_title?: string
}

export class TmdbClient {
    private apiKey: string
    private language: string
    private baseURL = 'https://api.themoviedb.org/3'

    static readonly IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
    static readonly EXPORT_BASE_URL = 'https://files.tmdb.org/p/exports'

    constructor(apiKey: string, language: string = 'zh-CN') {
        this.apiKey = apiKey
        this.language = language
    }

    private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`)

        // Add default parameters
        const allParams = { ...params }
        if (!allParams.api_key) allParams.api_key = this.apiKey
        if (!allParams.language && !endpoint.includes('daily_export_ids')) allParams.language = this.language

        Object.keys(allParams).forEach(key => {
            if (allParams[key] !== undefined && allParams[key] !== null) {
                url.searchParams.append(key, String(allParams[key]))
            }
        })

        const finalUrl = url.toString()

        const response = await fetch(finalUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            next: { revalidate: 0 } // No cache for API calls by default
        })

        if (!response.ok) {
            const txt = await response.text()
            throw new Error(`TMDB API Error: ${response.status} ${response.statusText} - ${txt}`)
        }

        return response.json()
    }

    // ====== 工具方法 ======

    /**
     * 构建完整图片 URL
     */
    static getImageUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
        if (!path) return null
        return `${TmdbClient.IMAGE_BASE_URL}/${size}${path}`
    }

    /**
     * 获取指定日期的导出文件 URL
     */
    static getDailyExportUrl(type: 'movie' | 'tv_series' | 'person', date: Date = new Date()): string {
        const month = String(date.getUTCMonth() + 1).padStart(2, '0')
        const day = String(date.getUTCDate()).padStart(2, '0')
        const year = date.getUTCFullYear()

        return `${TmdbClient.EXPORT_BASE_URL}/${type}_ids_${month}_${day}_${year}.json.gz`
    }

    // ====== 每日导出文件 ======

    /**
     * 下载并解析每日导出文件
     * 自动重试逻辑：如果今天的文件未生成(403/404)，尝试昨天的文件
     */
    async downloadDailyExport(type: 'movie' | 'tv_series' | 'person'): Promise<number[]> {
        // 先尝试今天
        const today = new Date()
        try {
            console.log(`[TMDB] Trying daily export for ${type} (Today: ${today.toISOString().split('T')[0]})...`)
            return await this.downloadExportByDate(type, today)
        } catch (error) {
            console.warn(`[TMDB] Failed to download today's export, trying yesterday...`)

            // 尝试昨天
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            try {
                return await this.downloadExportByDate(type, yesterday)
            } catch (retryError) {
                console.error(`[TMDB] Failed to download yesterday's export too:`, retryError)
                throw retryError
            }
        }
    }

    private async downloadExportByDate(type: 'movie' | 'tv_series' | 'person', date: Date): Promise<number[]> {
        const url = TmdbClient.getDailyExportUrl(type, date)

        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Failed to download export: ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()

        // 解压 gzip
        const zlib = await import('zlib')
        const decompressed = zlib.gunzipSync(Buffer.from(arrayBuffer))
        const content = decompressed.toString('utf-8')

        // 解析 JSON Lines (每行一个 JSON 对象)
        const ids: number[] = []
        const lines = content.trim().split('\n')

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const item: DailyExportItem = JSON.parse(line)
                    ids.push(item.id)
                } catch {
                    // 跳过无效行
                }
            }
        }

        return ids
    }

    // ====== Discover API (备选方案) ======

    /**
     * 获取热门电影列表 (当每日导出不可用时使用)
     */
    async discoverMovies(page: number = 1): Promise<{ ids: number[]; totalPages: number }> {
        const response = await this.request<{ results: { id: number }[], total_pages: number }>('/discover/movie', {
            sort_by: 'popularity.desc',
            page,
        })
        return {
            ids: response.results.map(m => m.id),
            totalPages: response.total_pages,
        }
    }

    /**
     * 获取热门电视剧列表
     */
    async discoverTvShows(page: number = 1): Promise<{ ids: number[]; totalPages: number }> {
        const response = await this.request<{ results: { id: number }[], total_pages: number }>('/discover/tv', {
            sort_by: 'popularity.desc',
            page,
        })
        return {
            ids: response.results.map(t => t.id),
            totalPages: response.total_pages,
        }
    }

    /**
     * 获取 ID 列表 (优先使用每日导出，失败时回退到 discover API)
     */
    async getIdList(type: 'movie' | 'tv', maxPages: number = 50): Promise<number[]> {
        const exportType = type === 'tv' ? 'tv_series' : type

        // 尝试每日导出
        try {
            console.log(`[TMDB] Trying daily export for ${type}...`)
            return await this.downloadDailyExport(exportType)
        } catch {
            console.log(`[TMDB] Daily export failed, falling back to discover API...`)
        }

        // 回退到 discover API
        const allIds: number[] = []
        const discoverFn = type === 'movie' ? this.discoverMovies.bind(this) : this.discoverTvShows.bind(this)

        for (let page = 1; page <= maxPages; page++) {
            try {
                const { ids, totalPages } = await discoverFn(page)
                allIds.push(...ids)
                console.log(`[TMDB] Discover page ${page}/${Math.min(totalPages, maxPages)}: got ${ids.length} IDs`)

                if (page >= totalPages) break

                // 小延迟
                await new Promise(r => setTimeout(r, 100))
            } catch (error) {
                console.error(`[TMDB] Discover page ${page} failed:`, error)
                break
            }
        }

        return allIds
    }

    // ====== 电影 API ======

    /**
     * 获取电影详情
     */
    async getMovie(movieId: number): Promise<TmdbMovieDetail> {
        return this.request<TmdbMovieDetail>(`/movie/${movieId}`, {
            append_to_response: 'images,credits',
            include_image_language: 'cn,zh,en,null',
        })
    }

    /**
     * 获取电影翻译
     */
    async getMovieTranslations(movieId: number): Promise<TmdbTranslation[]> {
        const response = await this.request<{ translations: TmdbTranslation[] }>(`/movie/${movieId}/translations`)
        return response.translations || []
    }

    /**
     * 搜索电影
     */
    async searchMovies(query: string, page: number = 1): Promise<TmdbSearchResult<TmdbMovieDetail>> {
        return this.request<TmdbSearchResult<TmdbMovieDetail>>('/search/movie', {
            query,
            page,
        })
    }

    // ====== 电视剧 API ======

    /**
     * 获取电视剧详情
     */
    async getTvShow(id: number): Promise<TmdbTvDetail> {
        return this.request<TmdbTvDetail>(`/tv/${id}`, {
            append_to_response: 'images',
            include_image_language: 'cn,zh,en,null',
        })
    }

    /**
     * 获取电视剧翻译
     */
    async getTvTranslations(tvId: number): Promise<TmdbTranslation[]> {
        const response = await this.request<{ translations: TmdbTranslation[] }>(`/tv/${tvId}/translations`)
        return response.translations || []
    }

    /**
     * 搜索电视剧
     */
    async searchTvShows(query: string, page: number = 1): Promise<TmdbSearchResult<TmdbTvDetail>> {
        return this.request<TmdbSearchResult<TmdbTvDetail>>('/search/tv', {
            query,
            page,
        })
    }

    // ====== 人物 API ======

    /**
     * 获取人物详情
     */
    async getPerson(personId: number): Promise<TmdbPersonDetail> {
        return this.request<TmdbPersonDetail>(`/person/${personId}`, {
            append_to_response: 'images',
        })
    }

    /**
     * 获取人物翻译
     */
    async getPersonTranslations(personId: number): Promise<TmdbTranslation[]> {
        const response = await this.request<{ translations: TmdbTranslation[] }>(`/person/${personId}/translations`)
        return response.translations || []
    }

    // ====== 批量操作 ======

    /**
     * 批量获取电影详情（带速率控制）
     */
    async * batchGetMovies(
        ids: number[],
        batchSize: number = 20,
        delayMs: number = 100
    ): AsyncGenerator<TmdbMovieDetail[], void, unknown> {
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize)
            const results: TmdbMovieDetail[] = []

            for (const id of batch) {
                try {
                    const movie = await this.getMovie(id)
                    results.push(movie)

                    // 小延迟防止过快请求
                    if (delayMs > 0) {
                        await new Promise(r => setTimeout(r, delayMs))
                    }
                } catch (error) {
                    console.error(`[TMDB] Failed to get movie ${id}:`, error)
                }
            }

            yield results
        }
    }

    /**
     * 批量获取电视剧详情
     */
    async * batchGetTvShows(
        ids: number[],
        batchSize: number = 20,
        delayMs: number = 100
    ): AsyncGenerator<TmdbTvDetail[], void, unknown> {
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize)
            const results: TmdbTvDetail[] = []

            for (const id of batch) {
                try {
                    const tv = await this.getTvShow(id)
                    results.push(tv)

                    if (delayMs > 0) {
                        await new Promise(r => setTimeout(r, delayMs))
                    }
                } catch (error) {
                    console.error(`[TMDB] Failed to get TV show ${id}:`, error)
                }
            }

            yield results
        }
    }

    /**
     * 验证 API Key 是否有效
     */
    async validateApiKey(): Promise<boolean> {
        try {
            await this.request('/configuration', { api_key: this.apiKey })
            return true
        } catch {
            return false
        }
    }

    /**
     * 批量获取人物详情
     */
    async * batchGetPersons(
        ids: number[],
        batchSize: number = 20,
        delayMs: number = 100
    ): AsyncGenerator<TmdbPersonDetail[], void, unknown> {
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize)
            const results: TmdbPersonDetail[] = []

            for (const id of batch) {
                try {
                    const person = await this.getPerson(id)
                    results.push(person)

                    if (delayMs > 0) {
                        await new Promise(r => setTimeout(r, delayMs))
                    }
                } catch (error) {
                    console.error(`[TMDB] Failed to get person ${id}:`, error)
                }
            }

            yield results
        }
    }
}

/**
 * 从中文翻译中提取数据
 */
export function extractChineseTranslation(translations: TmdbTranslation[]): {
    title?: string
    name?: string
    overview?: string
    biography?: string
} | null {
    // 优先简体中文，其次繁体中文
    const zhCn = translations.find(t => t.iso_3166_1 === 'CN' && t.iso_639_1 === 'zh')
    const zhTw = translations.find(t => t.iso_3166_1 === 'TW' && t.iso_639_1 === 'zh')
    const zhHk = translations.find(t => t.iso_3166_1 === 'HK' && t.iso_639_1 === 'zh')

    const best = zhCn || zhTw || zhHk

    if (!best) return null

    return {
        title: best.data.title,
        name: best.data.name,
        overview: best.data.overview,
        biography: best.data.biography,
    }
}
