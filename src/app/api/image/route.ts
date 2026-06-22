import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 允许的图片类型白名单
const ALLOWED_IMAGE_TYPES = new Set([
    'Primary', 'Backdrop', 'Thumb', 'Logo', 'Art', 'Banner', 'Disc', 'Box',
    'BoxRear', 'Screenshot', 'ClearLogo', 'ClearArt',
])

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const serverId = searchParams.get('serverId')
    const itemId = searchParams.get('itemId')
    const type = searchParams.get('type') || 'Primary'

    if (!serverId || !itemId) {
        return new NextResponse('Missing serverId or itemId', { status: 400 })
    }

    // 校验 type 参数
    if (!ALLOWED_IMAGE_TYPES.has(type)) {
        return new NextResponse('Invalid image type', { status: 400 })
    }

    // 校验 itemId 格式（只允许字母数字和连字符）
    if (!/^[a-zA-Z0-9\-]+$/.test(itemId)) {
        return new NextResponse('Invalid itemId', { status: 400 })
    }

    try {
        const server = await prisma.server.findUnique({
            where: { id: serverId },
        })

        if (!server) {
            return new NextResponse('Server not found', { status: 404 })
        }

        // 构建 URL 并校验格式
        let baseUrl = server.url.replace(/\/+$/, '')
        if (server.port !== 80 && server.port !== 443) {
            baseUrl = `${baseUrl}:${server.port}`
        }
        const imageUrl = `${baseUrl}/emby/Items/${encodeURIComponent(itemId)}/Images/${encodeURIComponent(type)}`

        const response = await fetch(imageUrl, {
            headers: {
                'X-Emby-Token': server.apiKey,
            },
        })

        if (!response.ok) {
            return new NextResponse('Failed to fetch image', { status: response.status })
        }

        const buffer = await response.arrayBuffer()

        // 只转发必要的响应头
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const headers = new Headers({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Content-Length': String(buffer.byteLength),
        })

        return new NextResponse(buffer, {
            headers,
            status: 200,
        })
    } catch (error) {
        console.error('[Image Proxy] Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
