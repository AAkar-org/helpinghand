import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import pool from './db/db.js';
import redisClient from './db/redisClient.js';

import authRoutes from './routes/authRoutes.js';
import supplyRoutes from './routes/supplyRoutes.js';
import demandRoutes from './routes/demandRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';

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
            service: 'Helping Hand Core API',
            timestamp: dbResult.rows[0].now,
            redis: ping === 'PONG' ? 'connected' : 'error'
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/supply', supplyRoutes);
app.use('/api/demand', demandRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api', ratingRoutes);

app.use((req: Request, res: Response) => {
    res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

app.listen(port, () => {
    console.log(`🚀 Helping Hand Core API running on http://localhost:${port}`);
});