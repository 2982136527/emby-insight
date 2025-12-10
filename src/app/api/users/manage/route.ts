import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmbyClient } from '@/lib/emby'

// POST /api/users/manage - Create user(s) on a server
// DELETE /api/users/manage - Delete user(s) from a server
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { serverId, users } = body as {
            serverId: string
            users: Array<{ name: string; password?: string }>
        }

        if (!serverId || !users || users.length === 0) {
            return NextResponse.json(
                { error: 'Missing serverId or users' },
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

        const results: Array<{ name: string; success: boolean; userId?: string; error?: string }> = []

        for (const user of users) {
            try {
                const created = await client.createUser(user.name, user.password)
                results.push({
                    name: user.name,
                    success: true,
                    userId: created.Id,
                })
            } catch (error) {
                results.push({
                    name: user.name,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }
        }

        return NextResponse.json({
            results,
            successCount: results.filter(r => r.success).length,
            failCount: results.filter(r => !r.success).length,
        })
    } catch (error) {
        console.error('[API] Failed to create users:', error)
        return NextResponse.json(
            { error: 'Failed to create users' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json()
        const { serverId, userIds } = body as {
            serverId: string
            userIds: string[]
        }

        if (!serverId || !userIds || userIds.length === 0) {
            return NextResponse.json(
                { error: 'Missing serverId or userIds' },
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

        const results: Array<{ userId: string; success: boolean; error?: string }> = []

        for (const userId of userIds) {
            try {
                await client.deleteUser(userId)
                results.push({ userId, success: true })
            } catch (error) {
                results.push({
                    userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }
        }

        return NextResponse.json({
            results,
            successCount: results.filter(r => r.success).length,
            failCount: results.filter(r => !r.success).length,
        })
    } catch (error) {
        console.error('[API] Failed to delete users:', error)
        return NextResponse.json(
            { error: 'Failed to delete users' },
            { status: 500 }
        )
    }
}
