import * as fs from 'fs'
import * as path from 'path'

interface TmdbProxyConfig {
    tmdb: {
        apiKey: string
        language: string
        httpProxy: string
        authKey: string
        proxyImages: boolean
        resolveTmdbDns: boolean
    }
    logRetentionDays: number
}

const PLACEHOLDER_VALUES = ['YOUR_TMDB_API_KEY_HERE', '', 'your_key_here']

function getConfigPath(): string {
    return process.env.TMDB_PROXY_CONFIG_PATH || path.resolve(process.cwd(), 'tmdb-proxy-config.json')
}

function loadConfig(): TmdbProxyConfig {
    const configPath = getConfigPath()

    if (!fs.existsSync(configPath)) {
        const defaultConfig: TmdbProxyConfig = {
            tmdb: { apiKey: '', language: 'zh-CN', httpProxy: '', authKey: '', proxyImages: true, resolveTmdbDns: false },
            logRetentionDays: 30,
        }
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
        return defaultConfig
    }

    let raw: any
    try {
        raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    } catch {
        return loadConfig.defaults()
    }

    let apiKey = raw?.tmdb?.apiKey || ''
    if (!apiKey || PLACEHOLDER_VALUES.includes(apiKey)) {
        apiKey = ''
    }

    return {
        tmdb: {
            apiKey,
            language: raw.tmdb?.language || 'zh-CN',
            httpProxy: raw.tmdb?.httpProxy || '',
            authKey: raw.tmdb?.authKey || '',
            proxyImages: raw.tmdb?.proxyImages !== false,
            resolveTmdbDns: raw.tmdb?.resolveTmdbDns === true,
        },
        logRetentionDays: raw.logRetentionDays ?? 30,
    }
}

loadConfig.defaults = (): TmdbProxyConfig => ({
    tmdb: { apiKey: '', language: 'zh-CN', httpProxy: '', authKey: '', proxyImages: true, resolveTmdbDns: false },
    logRetentionDays: 30,
})

export const tmdbProxyConfig = loadConfig()

export function updateTmdbProxyConfig(partial: Partial<TmdbProxyConfig> & { tmdb?: Partial<TmdbProxyConfig['tmdb']> }) {
    if (partial.tmdb?.apiKey !== undefined) tmdbProxyConfig.tmdb.apiKey = partial.tmdb.apiKey
    if (partial.tmdb?.language !== undefined) tmdbProxyConfig.tmdb.language = partial.tmdb.language
    if (partial.tmdb?.httpProxy !== undefined) tmdbProxyConfig.tmdb.httpProxy = partial.tmdb.httpProxy
    if (partial.tmdb?.authKey !== undefined) tmdbProxyConfig.tmdb.authKey = partial.tmdb.authKey
    if (partial.tmdb?.proxyImages !== undefined) tmdbProxyConfig.tmdb.proxyImages = partial.tmdb.proxyImages
    if (partial.tmdb?.resolveTmdbDns !== undefined) tmdbProxyConfig.tmdb.resolveTmdbDns = partial.tmdb.resolveTmdbDns
    if (partial.logRetentionDays !== undefined) tmdbProxyConfig.logRetentionDays = partial.logRetentionDays

    // Persist to disk
    try {
        const configPath = getConfigPath()
        const tmpPath = configPath + '.tmp'
        fs.writeFileSync(tmpPath, JSON.stringify(tmdbProxyConfig, null, 2))
        fs.renameSync(tmpPath, configPath)
    } catch (e) {
        console.error('[TMDB-Proxy] Failed to save config:', e)
    }
}
