import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmbyClient } from '@/lib/emby'

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
            apiKey: '••••••••' + server.apiKey.slice(-4),
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
            apiKey: '••••••••' + server.apiKey.slice(-4),
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
