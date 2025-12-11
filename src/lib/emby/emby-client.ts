import axios, { AxiosInstance, AxiosError } from 'axios'
import type {
    EmbyUser,
    EmbySession,
    EmbyItem,
    EmbyApiResponse,
    ItemQueryParams,
    EmbyItemType,
} from '@/types/emby'

interface EmbyClientConfig {
    baseUrl: string
    port: number
    apiKey: string
    timeout?: number
    maxRetries?: number
}

interface RetryConfig {
    maxRetries: number
    baseDelay: number
    maxDelay: number
}

export class EmbyClient {
    private client: AxiosInstance
    private retryConfig: RetryConfig
    private baseUrl: string

    constructor(config: EmbyClientConfig) {
        const { baseUrl, port, apiKey, timeout = 30000, maxRetries = 3 } = config

        // Normalize URL
        this.baseUrl = baseUrl.replace(/\/$/, '')
        if (port !== 80 && port !== 443) {
            this.baseUrl = `${this.baseUrl}:${port}`
        }

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout,
            headers: {
                'X-Emby-Token': apiKey,
                'Accept': 'application/json',
            },
        })

        this.retryConfig = {
            maxRetries,
            baseDelay: 1000,
            maxDelay: 10000,
        }
    }

    private async withRetry<T>(
        operation: () => Promise<T>,
        context: string
    ): Promise<T> {
        let lastError: Error | null = null

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation()
            } catch (error) {
                lastError = error as Error

                if (error instanceof AxiosError) {
                    // Don't retry on client errors (4xx) except 429 (rate limit)
                    if (error.response?.status &&
                        error.response.status >= 400 &&
                        error.response.status < 500 &&
                        error.response.status !== 429) {
                        throw error
                    }
                }

                if (attempt < this.retryConfig.maxRetries) {
                    const delay = Math.min(
                        this.retryConfig.baseDelay * Math.pow(2, attempt),
                        this.retryConfig.maxDelay
                    )
                    console.log(`[EmbyClient] Retry ${attempt + 1}/${this.retryConfig.maxRetries} for ${context} after ${delay}ms`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                }
            }
        }

        throw lastError
    }

    /**
     * Test connection to the Emby server
     */
    async testConnection(): Promise<{ success: boolean; serverName?: string; version?: string; error?: string }> {
        try {
            const response = await this.withRetry(
                () => this.client.get('/System/Info/Public'),
                'testConnection'
            )

            return {
                success: true,
                serverName: response.data.ServerName,
                version: response.data.Version,
            }
        } catch (error) {
            const message = error instanceof AxiosError
                ? error.response?.data?.Message || error.message
                : 'Unknown error'

            return {
                success: false,
                error: message,
            }
        }
    }

    /**
     * Get all users on the server
     */
    async getUsers(): Promise<EmbyUser[]> {
        const response = await this.withRetry(
            () => this.client.get<EmbyUser[]>('/Users'),
            'getUsers'
        )
        return response.data
    }

    /**
     * Get a specific user by ID
     */
    async getUser(userId: string): Promise<EmbyUser> {
        const response = await this.withRetry(
            () => this.client.get<EmbyUser>(`/Users/${userId}`),
            `getUser:${userId}`
        )
        return response.data
    }

    /**
     * Get active sessions on the server
     */
    async getSessions(): Promise<EmbySession[]> {
        const response = await this.withRetry(
            () => this.client.get<EmbySession[]>('/Sessions'),
            'getSessions'
        )
        return response.data
    }

    /**
     * Get items for a user with pagination support
     */
    async getUserItems(
        userId: string,
        params: ItemQueryParams = {}
    ): Promise<EmbyApiResponse<EmbyItem>> {
        const {
            StartIndex = 0,
            Limit = 100,
            SortBy = 'DatePlayed',
            SortOrder = 'Descending',
            IncludeItemTypes,
            Fields = ['MediaSources', 'Genres', 'Overview', 'ProductionYear'],
            Filters,
            Recursive = true,
            IsPlayed,
        } = params

        const queryParams: Record<string, string> = {
            StartIndex: String(StartIndex),
            Limit: String(Limit),
            SortBy,
            SortOrder,
            Recursive: String(Recursive),
            Fields: Array.isArray(Fields) ? Fields.join(',') : Fields,
        }

        if (IncludeItemTypes) {
            queryParams.IncludeItemTypes = Array.isArray(IncludeItemTypes) ? IncludeItemTypes.join(',') : IncludeItemTypes
        }
        if (Filters) {
            queryParams.Filters = Array.isArray(Filters) ? Filters.join(',') : Filters
        }
        if (IsPlayed !== undefined) {
            queryParams.IsPlayed = String(IsPlayed)
        }

        const response = await this.withRetry(
            () => this.client.get<EmbyApiResponse<EmbyItem>>(`/Users/${userId}/Items`, { params: queryParams }),
            `getUserItems:${userId}`
        )

        return response.data
    }

    /**
     * Get all played items for a user (with pagination iterator)
     */
    async *getPlayedItemsIterator(
        userId: string,
        itemTypes: EmbyItemType[] = ['Movie', 'Episode'],
        batchSize: number = 100
    ): AsyncGenerator<EmbyItem[], void, unknown> {
        let startIndex = 0
        let hasMore = true

        while (hasMore) {
            const response = await this.getUserItems(userId, {
                StartIndex: startIndex,
                Limit: batchSize,
                IncludeItemTypes: itemTypes,
                Filters: ['IsPlayed'],
                SortBy: 'DatePlayed',
                SortOrder: 'Descending',
                Fields: ['MediaSources', 'Genres', 'Overview', 'ProductionYear', 'DateCreated'],
            })

            if (response.Items.length > 0) {
                yield response.Items
            }

            startIndex += batchSize
            hasMore = startIndex < response.TotalRecordCount
        }
    }

    /**
     * Get all resumable (in-progress) items for a user (with pagination iterator)
     * These are items that have been partially watched but not marked as played
     */
    async *getResumeItemsIterator(
        userId: string,
        itemTypes: EmbyItemType[] = ['Movie', 'Episode'],
        batchSize: number = 100
    ): AsyncGenerator<EmbyItem[], void, unknown> {
        let startIndex = 0
        let hasMore = true

        while (hasMore) {
            const response = await this.getUserItems(userId, {
                StartIndex: startIndex,
                Limit: batchSize,
                IncludeItemTypes: itemTypes,
                Filters: ['IsResumable'],
                SortBy: 'DatePlayed',
                SortOrder: 'Descending',
                Fields: ['MediaSources', 'Genres', 'Overview', 'ProductionYear', 'DateCreated'],
            })

            if (response.Items.length > 0) {
                yield response.Items
            }

            startIndex += batchSize
            hasMore = startIndex < response.TotalRecordCount
        }
    }

    /**
     * Get a specific item by ID
     */
    async getItem(itemId: string, userId?: string): Promise<EmbyItem> {
        const endpoint = userId
            ? `/Users/${userId}/Items/${itemId}`
            : `/Items/${itemId}`

        const response = await this.withRetry(
            () => this.client.get<EmbyItem>(endpoint),
            `getItem:${itemId}`
        )
        return response.data
    }

    /**
     * Get recently played items for a user
     */
    async getRecentlyPlayed(
        userId: string,
        limit: number = 50
    ): Promise<EmbyItem[]> {
        const response = await this.getUserItems(userId, {
            Limit: limit,
            Filters: ['IsPlayed'],
            SortBy: 'DatePlayed',
            SortOrder: 'Descending',
            IncludeItemTypes: ['Movie', 'Episode'],
            Fields: ['MediaSources', 'Genres', 'Overview', 'ProductionYear'],
        })

        return response.Items
    }

    /**
     * Get items that can be resumed (dedicated endpoint)
     * This is more reliable than using IsResumable filter
     */
    async getResumeItems(
        userId: string,
        limit: number = 50
    ): Promise<EmbyItem[]> {
        const response = await this.withRetry(
            () => this.client.get<EmbyApiResponse<EmbyItem>>(`/Users/${userId}/Items/Resume`, {
                params: {
                    Limit: String(limit),
                    Fields: 'MediaSources,Genres,Overview,ProductionYear,DateCreated',
                    MediaTypes: 'Video',
                }
            }),
            `getResumeItems:${userId}`
        )
        return response.data.Items
    }

    /**
     * Get user image URL
     */
    getUserImageUrl(userId: string, imageType: 'Primary' = 'Primary'): string {
        return `${this.baseUrl}/Users/${userId}/Images/${imageType}`
    }

    /**
     * Get item image URL
     */
    getItemImageUrl(
        itemId: string,
        imageType: 'Primary' | 'Backdrop' | 'Thumb' = 'Primary',
        options?: { maxWidth?: number; maxHeight?: number }
    ): string {
        let url = `${this.baseUrl}/Items/${itemId}/Images/${imageType}`

        if (options) {
            const params = new URLSearchParams()
            if (options.maxWidth) params.set('maxWidth', String(options.maxWidth))
            if (options.maxHeight) params.set('maxHeight', String(options.maxHeight))
            if (params.toString()) {
                url += `?${params.toString()}`
            }
        }

        return url
    }

    /**
     * Get system information including storage
     */
    async getSystemInfo(): Promise<{
        ServerName: string
        Version: string
        OperatingSystem: string
        TotalMemory?: number
        UsedMemory?: number
    }> {
        const response = await this.withRetry(
            () => this.client.get('/System/Info'),
            'getSystemInfo'
        )
        return response.data
    }

    /**
     * Get virtual folders (libraries)
     */
    async getLibraries(): Promise<Array<{
        Name: string
        ItemId: string
        CollectionType: string
        Locations: string[]
    }>> {
        const response = await this.withRetry(
            () => this.client.get('/Library/VirtualFolders'),
            'getLibraries'
        )
        return response.data
    }

    /**
     * Send a message to a session
     */
    async sendMessage(sessionId: string, message: string, title: string = '消息'): Promise<void> {
        await this.withRetry(
            () => this.client.post(`/Sessions/${sessionId}/Message`, {
                Header: title,
                Text: message,
                TimeoutMs: 10000,
            }),
            `sendMessage:${sessionId}`
        )
    }

    /**
     * Stop a session (kick user)
     */
    async stopSession(sessionId: string): Promise<void> {
        await this.withRetry(
            () => this.client.post(`/Sessions/${sessionId}/Playing/Stop`),
            `stopSession:${sessionId}`
        )
    }

    /**
     * Get item count for a specific parent folder (library)
     */
    async getLibraryItemCount(parentId: string): Promise<number> {
        try {
            const response = await this.withRetry(
                () => this.client.get('/Items/Counts', {
                    params: {
                        ParentId: parentId,
                    }
                }),
                `getLibraryItemCount:${parentId}`
            )
            // Sum up movie, episode, and other counts
            const data = response.data
            return (data.MovieCount || 0) + (data.EpisodeCount || 0) + (data.MusicVideoCount || 0) + (data.TrailerCount || 0)
        } catch {
            // Fallback: query items directly
            try {
                const response = await this.client.get('/Items', {
                    params: {
                        ParentId: parentId,
                        Recursive: 'true',
                        Limit: '0',
                        IncludeItemTypes: 'Movie,Episode,Audio',
                    }
                })
                return response.data.TotalRecordCount || 0
            } catch {
                return 0
            }
        }
    }

    // ==================== User Management ====================

    /**
     * Create a new user on the server
     */
    async createUser(name: string, password?: string): Promise<EmbyUser> {
        const response = await this.withRetry(
            () => this.client.post<EmbyUser>('/Users/New', {
                Name: name,
                Password: password || '',
            }),
            `createUser:${name}`
        )
        return response.data
    }

    /**
     * Delete a user from the server
     */
    async deleteUser(userId: string): Promise<void> {
        await this.withRetry(
            () => this.client.delete(`/Users/${userId}`),
            `deleteUser:${userId}`
        )
    }

    /**
     * Get user policy (permissions)
     */
    async getUserPolicy(userId: string): Promise<UserPolicy> {
        const user = await this.getUser(userId)
        return user.Policy || {}
    }

    /**
     * Update user policy (permissions)
     */
    async updateUserPolicy(userId: string, policy: Partial<UserPolicy>): Promise<void> {
        await this.withRetry(
            () => this.client.post(`/Users/${userId}/Policy`, policy),
            `updateUserPolicy:${userId}`
        )
    }

    /**
     * Update user password
     */
    async updateUserPassword(userId: string, newPassword: string, currentPassword?: string): Promise<void> {
        await this.withRetry(
            () => this.client.post(`/Users/${userId}/Password`, {
                CurrentPw: currentPassword || '',
                NewPw: newPassword,
            }),
            `updateUserPassword:${userId}`
        )
    }
}

// User policy interface
export interface UserPolicy {
    IsAdministrator?: boolean
    IsHidden?: boolean
    IsDisabled?: boolean
    EnableAllFolders?: boolean
    EnabledFolders?: string[]
    EnableLiveTvAccess?: boolean
    EnableLiveTvManagement?: boolean
    EnableContentDownloading?: boolean
    EnableContentDeletion?: boolean
    EnableContentDeletionFromFolders?: string[]
    EnableRemoteAccess?: boolean
    EnablePlaybackRemuxing?: boolean
    EnableMediaPlayback?: boolean
    EnableAudioPlaybackTranscoding?: boolean
    EnableVideoPlaybackTranscoding?: boolean
    EnableSubtitleManagement?: boolean
    EnableSyncTranscoding?: boolean
    MaxParentalRating?: number
    BlockedTags?: string[]
    RemoteClientBitrateLimit?: number
    SimultaneousStreamLimit?: number
}

// Factory function for creating clients
export function createEmbyClient(config: EmbyClientConfig): EmbyClient {
    return new EmbyClient(config)
}
