import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
    try {
        const { serverUserId } = await request.json()

        if (!serverUserId) {
            return NextResponse.json(
                { error: 'serverUserId is required' },
                { status: 400 }
            )
        }

        const user = await prisma.serverUser.update({
            where: { id: serverUserId },
            data: { globalUserId: null },
        })

        return NextResponse.json(user)
    } catch (error) {
        console.error('[API] Failed to unbind user:', error)
        return NextResponse.json(
            { error: 'Failed to unbind user' },
            { status: 500 }
        )
    }
}
