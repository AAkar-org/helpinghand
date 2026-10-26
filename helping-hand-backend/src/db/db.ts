import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: isProduction && !process.env.DATABASE_URL?.includes('localhost') ? { rejectUnauthorized: false } : false
});

pool.on('error', (err: Error) => {
    console.error('⚠️ [Database Error] Unexpected error on idle client:', err.message);
});

pool.on('connect', () => {
    // Client connected successfully
});

export default pool;