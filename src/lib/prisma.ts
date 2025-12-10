import { PrismaClient } from '@prisma/client'

  // Handle BigInt serialization for JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ; (BigInt.prototype as any).toJSON = function () {
    return Number(this)
  }

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
