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
        const blockedPatterns = [
            /^169\.254\./,
            /^0\./,
            /^\[::1\]$/,
            /^\[fd00:/,
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

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/servers/[id] - Get a specific server
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const server = await prisma.server.findUnique({
            where: { id },
            include: {
                users: {
                    include: {
                        globalUser: true,
                    },
                },
                _count: {
                    select: {
                        playHistory: true,
                    },
                },
            },
        })

        if (!server) {
            return NextResponse.json(
                { error: 'Server not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            ...server,
            apiKey: server.apiKey.length <= 4 ? '••••••••' : '••••••••' + server.apiKey.slice(-4),
        })
    } catch (error) {
        console.error('[API] Failed to get server:', error)
        return NextResponse.json(
            { error: 'Failed to fetch server' },
            { status: 500 }
        )
    }
}

// PUT /api/servers/[id] - Update a server
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const { name, url, port, apiKey, isActive } = body

        // Check if server exists
        const existingServer = await prisma.server.findUnique({
            where: { id },
        })

        if (!existingServer) {
            return NextResponse.json(
                { error: 'Server not found' },
                { status: 404 }
            )
        }

        // SSRF 防护：如果 URL 变更，校验新 URL
        if (url) {
            const urlError = validateServerUrl(url)
            if (urlError) {
                return NextResponse.json(
                    { error: urlError },
                    { status: 400 }
                )
            }
        }

        // If apiKey or url is being updated, test connection
        if (apiKey && apiKey !== existingServer.apiKey) {
            const client = createEmbyClient({
                baseUrl: url || existingServer.url,
                port: port || existingServer.port,
                apiKey,
            })

            const connectionTest = await client.testConnection()

            if (!connectionTest.success) {
                return NextResponse.json(
                    { error: `Connection failed: ${connectionTest.error}` },
                    { status: 400 }
                )
            }
        }

        const server = await prisma.server.update({
            where: { id },
            data: {
                ...(name !== undefined && name !== null && { name }),
                ...(url !== undefined && url !== null && { url }),
                ...(port !== undefined && port !== null && { port: Number(port) }),
                ...(apiKey !== undefined && apiKey !== null && apiKey !== '' && { apiKey }),
                ...(isActive !== undefined && { isActive }),
            },
        })

        return NextResponse.json({
            ...server,
            apiKey: server.apiKey.length <= 4 ? '••••••••' : '••••••••' + server.apiKey.slice(-4),
        })
    } catch (error) {
        console.error('[API] Failed to update server:', error)
        return NextResponse.json(
            { error: 'Failed to update server' },
            { status: 500 }
        )
    }
}

// DELETE /api/servers/[id] - Delete a server
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        await prisma.server.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Failed to delete server:', error)
        return NextResponse.json(
            { error: 'Failed to delete server' },
            { status: 500 }
        )
    }
}
