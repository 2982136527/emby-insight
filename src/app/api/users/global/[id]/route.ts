import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params

        // 1. Unlink all server users first
        await prisma.serverUser.updateMany({
            where: { globalUserId: id },
            data: { globalUserId: null },
        })

        // 2. Delete the global user
        await prisma.globalUser.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Failed to delete global user:', error)
        return NextResponse.json(
            { error: 'Failed to delete global user' },
            { status: 500 }
        )
    }
}
