import { prisma } from './prisma'

/**
 * Get serverUserIds from a globalUserId
 * This is needed because playHistory and sessionLog tables don't have
 * direct serverUser relations, only serverUserId field
 */
export async function getServerUserIdsFromGlobalUserId(globalUserId: string): Promise<string[]> {
    const serverUsers = await prisma.serverUser.findMany({
        where: { globalUserId },
        select: { id: true },
    })
    return serverUsers.map(u => u.id)
}

/**
 * Build a where clause filter for serverUserId based on user ID
 * Supports formats: "global:id", "server:id", or legacy plain id
 * Returns null if no matching serverUsers found
 */
export async function buildServerUserIdFilter(userId: string): Promise<{ in: string[] } | string | null> {
    if (userId.startsWith('global:')) {
        // Global user - find all related serverUserIds
        const globalUserId = userId.replace('global:', '')
        const serverUserIds = await getServerUserIdsFromGlobalUserId(globalUserId)
        if (serverUserIds.length === 0) return null
        return { in: serverUserIds }
    } else if (userId.startsWith('server:')) {
        // Single server user - return the ID directly
        return userId.replace('server:', '')
    } else {
        // Legacy format - assume it's a globalUserId
        const serverUserIds = await getServerUserIdsFromGlobalUserId(userId)
        if (serverUserIds.length === 0) return null
        return { in: serverUserIds }
    }
}
