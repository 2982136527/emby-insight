import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/settings/notifications
export async function GET() {
    try {
        const config = await prisma.notificationConfig.findFirst()
        return NextResponse.json(config || {
            enabled: false,
            webhookUrl: '',
            webhookType: 'generic',
            onPlaybackStart: true,
            onPlaybackStop: false,
        })
    } catch (error) {
        console.error('Failed to get notification config:', error)
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
    }
}

// POST /api/settings/notifications
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const count = await prisma.notificationConfig.count()

        let config
        if (count === 0) {
            config = await prisma.notificationConfig.create({
                data: body
            })
        } else {
            const first = await prisma.notificationConfig.findFirst()
            if (first) {
                config = await prisma.notificationConfig.update({
                    where: { id: first.id },
                    data: body
                })
            }
        }

        return NextResponse.json(config)
    } catch (error) {
        console.error('Failed to save notification config:', error)
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
    }
}
