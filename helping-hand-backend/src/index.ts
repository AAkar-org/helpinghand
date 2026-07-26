import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import pool from './db/db.js';
import redisClient from './db/redisClient.js';

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.get('/health', async (req: Request, res: Response) => {
    try {
        const dbResult = await pool.query('SELECT NOW()');
        const ping = await redisClient.ping();
        res.status(200).json({
            status: 'healthy',
            database: dbResult.rows[0].now,
            redis: ping === 'PONG' ? 'connected' : 'error'
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Helping Hand Core API running on http://localhost:${port}`);
});