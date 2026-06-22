import dns, { Resolver } from 'dns'
import https from 'https'
import tls from 'tls'
import net from 'net'

const DNS_SERVERS = ['8.8.8.8', '1.1.1.1']
const TMDB_HOSTS = ['api.themoviedb.org', 'image.tmdb.org']
const CACHE_TTL_MS = 5 * 60 * 1000

interface DnsCacheEntry {
    ip: string
    expiresAt: number
}

const dnsCache = new Map<string, DnsCacheEntry>()

function createResolver(): Resolver {
    const resolver = new Resolver()
    resolver.setServers(DNS_SERVERS)
    return resolver
}

function resolveHost(hostname: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const cached = dnsCache.get(hostname)
        if (cached && cached.expiresAt > Date.now()) {
            return resolve(cached.ip)
        }

        const resolver = createResolver()
        resolver.resolve4(hostname, (err, addresses) => {
            if (err || !addresses.length) {
                return reject(err || new Error(`No addresses found for ${hostname}`))
            }
            const ip = addresses[0]!
            dnsCache.set(hostname, { ip, expiresAt: Date.now() + CACHE_TTL_MS })
            resolve(ip)
        })
    })
}

function createDnsAgent(): https.Agent {
    const agent = new https.Agent({ keepAlive: true }) as any
    agent.createConnection = (options: any, callback: any) => {
        const hostname = options.hostname || options.host
        if (!TMDB_HOSTS.includes(hostname)) {
            const socket = tls.connect(options, () => callback(null, socket))
            socket.on('error', (err: Error) => callback(err))
            return socket
        }

        resolveHost(hostname)
            .then(ip => {
                const connOptions = { ...options, host: ip, servername: hostname }
                const socket = tls.connect(connOptions, () => callback(null, socket))
                socket.on('error', (err: Error) => callback(err))
            })
            .catch(() => {
                const socket = tls.connect(options, () => callback(null, socket))
                socket.on('error', (err2: Error) => callback(err2))
            })
    }
    return agent
}

let cachedAgent: https.Agent | null = null

export function getDnsAgent(): https.Agent {
    if (!cachedAgent) cachedAgent = createDnsAgent()
    return cachedAgent
}

export async function testDnsConnectivity() {
    const result = {
        dnsReachable: false, dnsLatency: 0,
        resolveSuccess: false, resolveLatency: 0, resolvedIp: null as string | null,
        httpsSuccess: false, httpsLatency: 0, error: undefined as string | undefined,
    }

    const dnsStart = Date.now()
    try {
        const resolver = createResolver()
        await new Promise<void>((resolve, reject) => {
            resolver.resolve4('google.com', (err) => { if (err) reject(err); else resolve() })
        })
        result.dnsReachable = true
        result.dnsLatency = Date.now() - dnsStart
    } catch (e: any) {
        result.dnsLatency = Date.now() - dnsStart
        result.error = `DNS 服务器不可达: ${e.message}`
        return result
    }

    const resolveStart = Date.now()
    try {
        const ip = await resolveHost('api.themoviedb.org')
        result.resolveSuccess = true
        result.resolveLatency = Date.now() - resolveStart
        result.resolvedIp = ip
    } catch (e: any) {
        result.resolveLatency = Date.now() - resolveStart
        result.error = `DNS 解析失败: ${e.message}`
        return result
    }

    const httpsStart = Date.now()
    try {
        await new Promise<void>((resolve, reject) => {
            const socket = net.connect(443, result.resolvedIp!, () => {
                result.httpsSuccess = true
                result.httpsLatency = Date.now() - httpsStart
                socket.destroy()
                resolve()
            })
            socket.on('error', (err) => { result.httpsLatency = Date.now() - httpsStart; reject(err) })
            socket.setTimeout(5000, () => { result.httpsLatency = Date.now() - httpsStart; socket.destroy(); reject(new Error('timeout')) })
        })
    } catch (e: any) {
        result.httpsLatency = Date.now() - httpsStart
        result.error = `连接失败: ${e.message}`
    }

    return result
}
