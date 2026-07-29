import { Request, Response } from 'express';
import pool from '../db/db.js';
import redisClient from '../db/redisClient.js';

export const REDIS_WORKERS_GEO_KEY = 'workers_locations';

export const toggleAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
        const { workerId, isAvailable, lat, lng } = req.body;
        if (!workerId || typeof isAvailable !== 'boolean') {
            res.status(400).json({
                success: false,
                error: 'workerId and isAvailable (boolean) are required'
            });
            return;
        }

        let query = 'UPDATE workers SET is_available = $1';
        const params: any[] = [isAvailable];

        if (lat !== undefined && lng !== undefined) {
            query += ', last_known_lat = $2, last_known_lng = $3 WHERE worker_id = $4 RETURNING *';
            params.push(lat, lng, workerId);
        } else {
            query += ' WHERE worker_id = $2 RETURNING *';
            params.push(workerId);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Worker not found' });
            return;
        }

        const worker = result.rows[0];

        if (isAvailable) {
            const currentLat = lat ?? Number(worker.last_known_lat);
            const currentLng = lng ?? Number(worker.last_known_lng);

            if (currentLat && currentLng && !isNaN(currentLat) && !isNaN(currentLng)) {
                await redisClient.geoAdd(REDIS_WORKERS_GEO_KEY, {
                    longitude: Number(currentLng),
                    latitude: Number(currentLat),
                    member: workerId
                });
            }
        } else {
            await redisClient.zRem(REDIS_WORKERS_GEO_KEY, workerId);
        }

        res.status(200).json({
            success: true,
            isAvailable: worker.is_available,
            worker
        });
    } catch (error: any) {
        console.error('Error in toggleAvailability:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateLocation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { workerId, lat, lng } = req.body;
        if (!workerId || lat === undefined || lng === undefined) {
            res.status(400).json({
                success: false,
                error: 'workerId, lat, and lng are required'
            });
            return;
        }

        const numericLat = Number(lat);
        const numericLng = Number(lng);

        if (isNaN(numericLat) || isNaN(numericLng)) {
            res.status(400).json({ success: false, error: 'lat and lng must be valid numbers' });
            return;
        }

        const result = await pool.query(
            `UPDATE workers 
             SET last_known_lat = $1, last_known_lng = $2 
             WHERE worker_id = $3 
             RETURNING worker_id, is_available`,
            [numericLat, numericLng, workerId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Worker not found' });
            return;
        }

        const worker = result.rows[0];

        if (worker.is_available) {
            await redisClient.geoAdd(REDIS_WORKERS_GEO_KEY, {
                longitude: numericLng,
                latitude: numericLat,
                member: workerId
            });
        }

        res.status(200).json({
            success: true,
            message: 'Location updated successfully',
            workerId,
            lat: numericLat,
            lng: numericLng
        });
    } catch (error: any) {
        console.error('Error in updateLocation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getWorkerStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { workerId } = req.params;
        const result = await pool.query('SELECT * FROM workers WHERE worker_id = $1', [workerId]);

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Worker not found' });
            return;
        }

        res.status(200).json({ success: true, worker: result.rows[0] });
    } catch (error: any) {
        console.error('Error in getWorkerStatus:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
