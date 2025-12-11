/**
 * TMDB Matcher Utility
 * Matches Emby items to TMDB entries using title and year.
 */

/**
 * Normalize a title for comparison
 * - Lowercase
 * - Remove special characters
 * - Trim whitespace
 */
export function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '') // Keep letters, numbers, spaces (Unicode aware)
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                )
            }
        }
    }

    return matrix[b.length][a.length]
}

/**
 * Calculate similarity score (0-1) between two titles
 */
export function titleSimilarity(title1: string, title2: string): number {
    const norm1 = normalizeTitle(title1)
    const norm2 = normalizeTitle(title2)

    if (norm1 === norm2) return 1

    const maxLength = Math.max(norm1.length, norm2.length)
    if (maxLength === 0) return 1

    const distance = levenshteinDistance(norm1, norm2)
    return 1 - distance / maxLength
}

export interface MatchCandidate {
    id: number
    title: string
    titleCn: string | null
    originalTitle: string | null
    releaseDate: string | null // YYYY-MM-DD or YYYY
    similarity: number
    matchType: 'exact' | 'fuzzy' | 'year_mismatch'
}

export interface MatchResult {
    matched: boolean
    tmdbId?: number
    confidence: number // 0-1
    matchType?: 'exact' | 'fuzzy' | 'year_mismatch'
    candidates: MatchCandidate[]
}

/**
 * Match an Emby item to TMDB entries
 * @param itemName Emby item name
 * @param itemYear Emby item production year (optional)
 * @param tmdbItems Array of TMDB items to match against
 * @param fuzzyThreshold Minimum similarity for fuzzy match (default 0.8)
 */
export function matchItem(
    itemName: string,
    itemYear: number | null | undefined,
    tmdbItems: Array<{
        id: number
        title: string
        titleCn: string | null
        originalTitle: string | null
        releaseDate: string | null
    }>,
    fuzzyThreshold: number = 0.8
): MatchResult {
    const normalizedItemName = normalizeTitle(itemName)
    const candidates: MatchCandidate[] = []

    for (const tmdb of tmdbItems) {
        const titles = [
            tmdb.title,
            tmdb.titleCn,
            tmdb.originalTitle,
        ].filter(Boolean) as string[]

        let bestSimilarity = 0
        for (const title of titles) {
            const sim = titleSimilarity(itemName, title)
            if (sim > bestSimilarity) {
                bestSimilarity = sim
            }
        }

        // Extract year from releaseDate
        const tmdbYear = tmdb.releaseDate ? parseInt(tmdb.releaseDate.substring(0, 4)) : null

        // Determine match type
        let matchType: 'exact' | 'fuzzy' | 'year_mismatch' = 'fuzzy'
        if (bestSimilarity === 1) {
            matchType = 'exact'
        }
        if (itemYear && tmdbYear && itemYear !== tmdbYear) {
            matchType = 'year_mismatch'
        }

        if (bestSimilarity >= fuzzyThreshold || matchType === 'exact') {
            candidates.push({
                id: tmdb.id,
                title: tmdb.title,
                titleCn: tmdb.titleCn,
                originalTitle: tmdb.originalTitle,
                releaseDate: tmdb.releaseDate,
                similarity: bestSimilarity,
                matchType,
            })
        }
    }

    // Sort by similarity descending, prefer exact matches
    candidates.sort((a, b) => {
        if (a.matchType === 'exact' && b.matchType !== 'exact') return -1
        if (b.matchType === 'exact' && a.matchType !== 'exact') return 1
        if (a.matchType === 'year_mismatch' && b.matchType !== 'year_mismatch') return 1
        if (b.matchType === 'year_mismatch' && a.matchType !== 'year_mismatch') return -1
        return b.similarity - a.similarity
    })

    // Filter by year if provided (allow ±1 year tolerance)
    if (itemYear) {
        const yearMatches = candidates.filter(c => {
            const year = c.releaseDate ? parseInt(c.releaseDate.substring(0, 4)) : null
            return year !== null && Math.abs(year - itemYear) <= 1
        })
        if (yearMatches.length > 0) {
            // Prefer year-matched candidates
            const best = yearMatches[0]
            return {
                matched: true,
                tmdbId: best.id,
                confidence: best.similarity,
                matchType: best.matchType === 'year_mismatch' ? 'fuzzy' : best.matchType,
                candidates: yearMatches.slice(0, 5),
            }
        }
    }

    if (candidates.length > 0) {
        const best = candidates[0]
        // If no year provided and there's a good candidate, match it (without year verification)
        const shouldMatch = best.similarity >= 0.9 || best.matchType === 'exact'
        return {
            matched: shouldMatch,
            tmdbId: best.id,
            confidence: best.similarity,
            matchType: best.matchType,
            candidates: candidates.slice(0, 5),
        }
    }

    return {
        matched: false,
        confidence: 0,
        candidates: [],
    }
}
