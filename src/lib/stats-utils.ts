/**
 * 统计相关的共享工具函数
 * 消除各统计路由中的重复代码
 */

/**
 * 计算真实观看时长
 * Emby 的 playCount 表示完整播放次数，duration 是内容总时长（ticks），
 * playbackPosition 是当前播放位置（ticks）
 */
export function calculateRealDuration(
    playCount: number | bigint,
    duration: number | bigint,
    playbackPosition: number | bigint
): number {
    const count = Number(playCount || 0)
    const dur = Number(duration || 0)
    const pos = Number(playbackPosition || 0)
    return (count > 0 ? count * dur : 0) + pos
}

/**
 * 从小时数据数组中找到峰值时段
 * @returns { hour: number, value: number }
 */
export function findPeakHour(hourlyData: number[]): { hour: number; value: number } {
    let peakHour = 0
    let peakValue = 0
    hourlyData.forEach((value, hour) => {
        if (value > peakValue) {
            peakValue = value
            peakHour = hour
        }
    })
    return { hour: peakHour, value: peakValue }
}

/**
 * 解析 genres JSON 字符串并返回清洗后的类型数组
 * 过滤掉无效值（含冒号的、超过20字符的）
 */
export function parseGenres(genresJson: string | null | undefined): string[] {
    try {
        const genres: string[] = JSON.parse(genresJson || '[]')
        return genres
            .map(g => g.trim())
            .filter(g => g && !g.includes(':') && g.length <= 20)
    } catch {
        return []
    }
}

/**
 * 将类型按观看时长聚合
 */
export function aggregateGenres(
    genresJson: string | null | undefined,
    duration: number,
    stats: Map<string, number>
): void {
    const genres = parseGenres(genresJson)
    for (const genre of genres) {
        stats.set(genre, (stats.get(genre) || 0) + duration)
    }
}

/**
 * ticks 转小时（保留一位小数）
 */
export function ticksToHours(ticks: number | bigint): number {
    return Math.round(Number(ticks) / 10000000 / 3600 * 10) / 10
}

/**
 * ticks 转分钟
 */
export function ticksToMinutes(ticks: number | bigint): number {
    return Number(ticks) / 10000000 / 60
}

/**
 * 将 Map 按值排序并取 top N
 */
export function topEntries<V>(map: Map<string, V>, n: number, toValue: (v: V) => number): Array<[string, V]> {
    return Array.from(map.entries())
        .sort((a, b) => toValue(b[1]) - toValue(a[1]))
        .slice(0, n)
}
