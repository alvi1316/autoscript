import { Pool, type PoolConfig } from 'pg';

let pool: Pool | null = null
let dbConfig: PoolConfig | null = null

export function configureDB(config: PoolConfig): void {
    if (pool) {
        throw new Error("Cannot configure DB after the pool has been initialized.")
    }
    dbConfig = config
}

function createPool(): Pool {
    
    const config: PoolConfig = dbConfig || {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 5432
    }

    const newPool = new Pool(config)

    newPool.on('error', (err: Error) => {
        console.error('Unexpected error on idle pg pool client', err)
        process.exit(-1)
    });

    return newPool
}

export function getPool(): Pool {
    if (!pool) {
        pool = createPool()
    }
    return pool
}

async function endPool(): Promise<void> {
    if (pool) {
        await pool.end()
        pool = null
        console.log('PostgreSQL pool has ended.')
    }
}

const handleShutdown = async (signal: string) => {
    console.log(`Received ${signal}. Ending PostgreSQL pool...`)
    await endPool()
    process.exit(0)
}

process.on('SIGINT', () => handleShutdown('SIGINT'))
process.on('SIGTERM', () => handleShutdown('SIGTERM'))