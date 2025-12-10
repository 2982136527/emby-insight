import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface TagWeight {
    tag: string
    weight: number  // Total play duration
    count: number   // Number of plays
}

// GET /api/stats/tags - Get tag/genre statistics for tag cloud
export async function GET() {
    try {
        // Get all play history with genres
        const history = await prisma.playHistory.findMany({
            select: {
                genres: true,
                playDuration: true,
            },
        })

        // Aggregate by tag
        const tagMap = new Map<string, { weight: number; count: number }>()

        for (const record of history) {
            try {
                const genres: string[] = JSON.parse(record.genres || '[]')
                const duration = Number(record.playDuration)

                for (const genre of genres) {
                    // Clean up the genre string
                    const cleanGenre = genre.trim()
                    if (!cleanGenre || cleanGenre.length > 20) continue // Skip empty or very long tags

                    // Skip system tags (片商, 发行, 系列 etc)
                    if (cleanGenre.includes(':') || cleanGenre.includes('：')) continue

                    const existing = tagMap.get(cleanGenre) || { weight: 0, count: 0 }
                    tagMap.set(cleanGenre, {
                        weight: existing.weight + duration,
                        count: existing.count + 1,
                    })
                }
            } catch {
                // Skip invalid JSON
            }
        }

        // Convert to array and sort by weight
        const tags: TagWeight[] = Array.from(tagMap.entries())
            .map(([tag, data]) => ({
                tag,
                weight: data.weight,
                count: data.count,
            }))
            .filter((t) => t.count >= 1) // At least 1 play
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 50) // Top 50 tags

        // Normalize weights for visualization (1-10 scale)
        const maxWeight = tags[0]?.weight || 1
        const normalizedTags = tags.map((t) => ({
            ...t,
            size: Math.ceil((t.weight / maxWeight) * 9) + 1, // 1-10
        }))

        return NextResponse.json({
            tags: normalizedTags,
            total: tagMap.size,
        })
    } catch (error) {
        console.error('[API] Failed to get tags:', error)
        return NextResponse.json({ error: 'Failed to get tags' }, { status: 500 })
    }
}
