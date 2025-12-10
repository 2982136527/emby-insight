import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const serverId = searchParams.get('serverId')
    const itemId = searchParams.get('itemId')
    const type = searchParams.get('type') || 'Primary'

    if (!serverId || !itemId) {
        return new NextResponse('Missing serverId or itemId', { status: 400 })
    }

    try {
        const server = await prisma.server.findUnique({
            where: { id: serverId },
        })

        if (!server) {
            return new NextResponse('Server not found', { status: 404 })
        }

        const imageUrl = `${server.url}:${server.port}/emby/Items/${itemId}/Images/${type}`

        const response = await fetch(imageUrl, {
            headers: {
                'X-Emby-Token': server.apiKey,
            },
        })

        if (!response.ok) {
            return new NextResponse('Failed to fetch image', { status: response.status })
        }

        const buffer = await response.arrayBuffer()
        const headers = new Headers(response.headers)
        headers.set('Cache-Control', 'public, max-age=3600')

        return new NextResponse(buffer, {
            headers,
            status: 200,
        })
    } catch (error) {
        console.error('[Image Proxy] Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
