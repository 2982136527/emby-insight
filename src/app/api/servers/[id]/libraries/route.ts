import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmbyClient } from '@/lib/emby'

// GET /api/servers/[id]/libraries - Get libraries from Emby server
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const server = await prisma.server.findUnique({
            where: { id },
        })

        if (!server) {
            return NextResponse.json(
                { error: 'Server not found' },
                { status: 404 }
            )
        }

        const client = createEmbyClient({
            baseUrl: server.url,
            port: server.port,
            apiKey: server.apiKey,
        })

        const libraries = await client.getLibraries()

        return NextResponse.json(libraries)
    } catch (error) {
        console.error('[API] Failed to get libraries:', error)
        return NextResponse.json(
            { error: 'Failed to fetch libraries' },
            { status: 500 }
        )
    }
}
