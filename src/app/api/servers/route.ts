import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmbyClient } from '@/lib/emby'

// SSRF 防护：校验服务器 URL
function validateServerUrl(url: string): string | null {
    try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return '只支持 http/https 协议'
        }
        const hostname = parsed.hostname
        // 禁止访问元数据服务和本地回环
        const blockedPatterns = [
            /^169\.254\./,           // AWS/GCP metadata
            /^0\./,                  // 0.x.x.x
            /^\[::1\]$/,            // IPv6 loopback
            /^\[fd00:/,             // IPv6 private
        ]
        for (const pattern of blockedPatterns) {
            if (pattern.test(hostname)) {
                return '不允许访问该地址'
            }
        }
        return null
    } catch {
        return 'URL 格式无效'
    }
}

// 掩码 API key，短密钥不暴露
function maskApiKey(key: string): string {
    if (key.length <= 4) return '••••••••'
    return '••••••••' + key.slice(-4)
}

// GET /api/servers - Get all servers
export async function GET() {
    try {
        const servers = await prisma.server.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        users: true,
                        playHistory: true,
                    },
                },
            },
        })

        // Mask API keys in response
        const maskedServers = servers.map((server) => ({
            ...server,
            apiKey: maskApiKey(server.apiKey),
        }))

        return NextResponse.json(maskedServers)
    } catch (error) {
        console.error('[API] Failed to get servers:', error)
        return NextResponse.json(
            { error: 'Failed to fetch servers' },
            { status: 500 }
        )
    }
}

// POST /api/servers - Create a new server
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, url, port, apiKey } = body

        // Validate required fields
        if (!name || !url || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields: name, url, apiKey' },
                { status: 400 }
            )
        }

        // SSRF 防护
        const urlError = validateServerUrl(url)
        if (urlError) {
            return NextResponse.json(
                { error: urlError },
                { status: 400 }
            )
        }

        // Test connection before saving
        const client = createEmbyClient({
            baseUrl: url,
            port: port || 8096,
            apiKey,
        })

        const connectionTest = await client.testConnection()

        if (!connectionTest.success) {
            return NextResponse.json(
                { error: `Connection failed: ${connectionTest.error}` },
                { status: 400 }
            )
        }

        // Create server in database
        const server = await prisma.server.create({
            data: {
                name,
                url,
                port: port || 8096,
                apiKey,
                isActive: true,
            },
        })

        return NextResponse.json({
            ...server,
            apiKey: maskApiKey(server.apiKey),
            serverInfo: {
                name: connectionTest.serverName,
                version: connectionTest.version,
            },
        })
    } catch (error) {
        console.error('[API] Failed to create server:', error)
        return NextResponse.json(
            { error: 'Failed to create server' },
            { status: 500 }
        )
    }
}
