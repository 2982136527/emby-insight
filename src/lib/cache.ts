/**
 * 简单的内存缓存实现
 * 用于缓存 Dashboard 统计和服务器列表等不频繁变化的数据
 */

interface CacheEntry<T> {
    data: T
    expiresAt: number
}

class MemoryCache {
    private cache = new Map<string, CacheEntry<unknown>>()

    /**
     * 获取缓存数据
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined

        if (!entry) {
            return null
        }

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key)
            return null
        }

        return entry.data
    }

    /**
     * 设置缓存数据
     * @param key 缓存键
     * @param data 缓存数据
     * @param ttlSeconds 过期时间 (秒)
     */
    set<T>(key: string, data: T, ttlSeconds: number): void {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttlSeconds * 1000,
        })
    }

    /**
     * 删除缓存
     */
    delete(key: string): void {
        this.cache.delete(key)
    }

    /**
     * 清除所有缓存
     */
    clear(): void {
        this.cache.clear()
    }

    /**
     * 按前缀清除缓存
     */
    clearByPrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key)
            }
        }
    }

    /**
     * 获取缓存统计信息
     */
    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        }
    }
}

// 全局缓存实例
export const cache = new MemoryCache()

// 预定义缓存键
export const CacheKeys = {
    DASHBOARD_STATS: 'dashboard:stats',
    SERVER_LIST: 'servers:list',
    userStats: (userId: string) => `user:${userId}:stats`,
    calendarData: (month: string, userId?: string) =>
        `calendar:${month}:${userId || 'all'}`,
} as const

// 预定义 TTL (秒)
export const CacheTTL = {
    DASHBOARD: 60,      // 1 分钟
    SERVER_LIST: 300,   // 5 分钟
    USER_STATS: 120,    // 2 分钟
    CALENDAR: 180,      // 3 分钟
} as const
