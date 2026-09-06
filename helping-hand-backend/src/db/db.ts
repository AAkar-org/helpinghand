import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('⚠️ [Database Error] Unexpected error on idle client:', err.message);
});

pool.on('connect', () => {
    // Client connected successfully
});

export default pool;