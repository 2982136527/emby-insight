import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmbyClient } from '@/lib/emby'

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
            apiKey: '••••••••' + server.apiKey.slice(-4),
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

        // If apiKey is being updated, test connection
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
                ...(name && { name }),
                ...(url && { url }),
                ...(port && { port }),
                ...(apiKey && { apiKey }),
                ...(isActive !== undefined && { isActive }),
            },
        })

        return NextResponse.json({
            ...server,
            apiKey: '••••••••' + server.apiKey.slice(-4),
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
