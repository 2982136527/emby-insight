import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmbyClient, UserPolicy } from '@/lib/emby/emby-client'

// GET /api/users/[id]/policy - Get user policy from server
// PUT /api/users/[id]/policy - Update user policy on server
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const serverId = searchParams.get('serverId')

        if (!serverId) {
            return NextResponse.json(
                { error: 'Missing serverId' },
                { status: 400 }
            )
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId },
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

        const policy = await client.getUserPolicy(id)

        return NextResponse.json(policy)
    } catch (error) {
        console.error('[API] Failed to get user policy:', error)
        return NextResponse.json(
            { error: 'Failed to get user policy' },
            { status: 500 }
        )
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { serverId, policy } = body as {
            serverId: string
            policy: Partial<UserPolicy>
        }

        if (!serverId || !policy) {
            return NextResponse.json(
                { error: 'Missing serverId or policy' },
                { status: 400 }
            )
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId },
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

        await client.updateUserPolicy(id, policy)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Failed to update user policy:', error)
        return NextResponse.json(
            { error: 'Failed to update user policy' },
            { status: 500 }
        )
    }
}
