import { getPool } from "./DB.js"

let query = async (query: string, params?: any[]) => {
    const pool = getPool()
    const client = await pool.connect()
    try {
        const res = await client.query(query, params)
        return res.rows
    } catch (err) {
        console.error('Unexpected error executing query', err)
        throw err
    } finally {
        client.release()
    }
}

export default query