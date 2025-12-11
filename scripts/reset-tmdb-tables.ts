import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Resetting TMDB tables...')

    try {
        // Drop tables in correct order to respect constraints if any (SQLite usually lax but good practice)
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS TmdbMovie;`)
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS TmdbTvShow;`)
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS TmdbPerson;`)
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS TmdbSyncStatus;`)
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS TmdbConfig;`)

        console.log('All TMDB tables dropped successfully.')
        console.log('Please run "npx prisma db push" now to recreate them.')
    } catch (error) {
        console.error('Error dropping tables:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
