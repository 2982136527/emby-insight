import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TmdbClient } from '@/lib/tmdb'

// GET /api/tmdb/config - 获取配置
export async function GET() {
    try {
        const config = await prisma.tmdbConfig.findFirst()

        return NextResponse.json({
            hasApiKey: !!config?.apiKey,
            apiKey: config?.apiKey || '',
            language: config?.language || 'zh-CN',
            includeAdult: config?.includeAdult || false,
            autoSync: config?.autoSync || false,
            syncInterval: config?.syncInterval || 24,
            enableFullSync: config?.enableFullSync || false,
        })
    } catch (error) {
        console.error('[TMDB] Failed to get config:', error)
        return NextResponse.json({ error: 'Failed to get config' }, { status: 500 })
    }
}

// POST /api/tmdb/config - 保存配置
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { apiKey, language, includeAdult, autoSync, syncInterval, enableFullSync } = body

        // 验证 API Key (如果提供)
        if (apiKey) {
            const client = new TmdbClient(apiKey)
            const isValid = await client.validateApiKey()

            if (!isValid) {
                return NextResponse.json(
                    { error: 'API Key 无效，请检查后重试' },
                    { status: 400 }
                )
            }
        }

        // 获取现有配置或创建新配置
        const existing = await prisma.tmdbConfig.findFirst()

        if (existing) {
            await prisma.tmdbConfig.update({
                where: { id: existing.id },
                data: {
                    apiKey: apiKey !== undefined ? apiKey : existing.apiKey,
                    language: language || existing.language,
                    includeAdult: includeAdult !== undefined ? includeAdult : existing.includeAdult,
                    autoSync: autoSync !== undefined ? autoSync : existing.autoSync,
                    syncInterval: syncInterval || existing.syncInterval,
                    enableFullSync: enableFullSync !== undefined ? enableFullSync : existing.enableFullSync,
                },
            })
        } else {
            await prisma.tmdbConfig.create({
                data: {
                    apiKey,
                    language: language || 'zh-CN',
                    includeAdult: includeAdult || false,
                    autoSync: autoSync || false,
                    syncInterval: syncInterval || 24,
                    enableFullSync: enableFullSync || false,
                },
            })
        }

        return NextResponse.json({ success: true, message: '配置已保存' })
    } catch (error) {
        console.error('[TMDB] Failed to save config:', error)
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
    }
}
