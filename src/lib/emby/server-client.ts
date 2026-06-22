/**
 * Emby 服务器客户端工厂
 * 消除各路由中重复的 "查服务器 → 构造客户端" 模式
 */

import { prisma } from '@/lib/prisma'
import { createEmbyClient, EmbyClient } from './emby-client'

/**
 * 根据服务器 ID 获取 Emby 客户端
 * @returns { client, server } 或 null（服务器不存在时）
 */
export async function getEmbyClientForServer(serverId: string): Promise<{
    client: EmbyClient
    server: { id: string; url: string; port: number; apiKey: string }
} | null> {
    const server = await prisma.server.findUnique({
        where: { id: serverId },
    })

    if (!server) return null

    const client = createEmbyClient({
        baseUrl: server.url,
        port: server.port,
        apiKey: server.apiKey,
    })

    return { client, server }
}

/**
 * 根据服务器 ID 获取 Emby 客户端，不存在时抛出 404 响应
 */
export async function requireEmbyClient(serverId: string) {
    const result = await getEmbyClientForServer(serverId)
    if (!result) {
        return null
    }
    return result
}
