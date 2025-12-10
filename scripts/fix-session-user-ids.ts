// Script to backfill serverUserId for existing session logs
// Run with: npx ts-node scripts/fix-session-user-ids.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting serverUserId backfill for session logs...')

    // Get all session logs without serverUserId
    const sessionsWithoutUser = await prisma.sessionLog.findMany({
        where: { serverUserId: null },
        select: {
            id: true,
            serverId: true,
            userId: true, // This is the Emby user ID
        },
    })

    console.log(`Found ${sessionsWithoutUser.length} session logs without serverUserId`)

    let updated = 0
    let skipped = 0

    for (const session of sessionsWithoutUser) {
        // Find the corresponding ServerUser
        const serverUser = await prisma.serverUser.findFirst({
            where: {
                serverId: session.serverId,
                embyUserId: session.userId,
            },
            select: { id: true },
        })

        if (serverUser) {
            await prisma.sessionLog.update({
                where: { id: session.id },
                data: { serverUserId: serverUser.id },
            })
            updated++
        } else {
            skipped++
        }
    }

    console.log(`Updated ${updated} session logs`)
    console.log(`Skipped ${skipped} session logs (no matching ServerUser)`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
