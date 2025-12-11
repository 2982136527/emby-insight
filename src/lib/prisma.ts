import { PrismaClient } from '@prisma/client'
import { PrismaClient as TmdbPrismaClient } from '@prisma/tmdb-client'

  // Handle BigInt serialization for JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ; (BigInt.prototype as any).toJSON = function () {
    return Number(this)
  }

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  tmdbPrisma: TmdbPrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  })

export const tmdbPrisma =
  globalForPrisma.tmdbPrisma ??
  new TmdbPrismaClient({
    log: ['error', 'warn'], // TMDB logs might be verbose, reduce level
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.tmdbPrisma = tmdbPrisma
}
