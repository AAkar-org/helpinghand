import { Request, Response } from 'express';
import pool from '../db/db.js';
import redisClient from '../db/redisClient.js';
import { REDIS_WORKERS_GEO_KEY } from './supplyController.js';
import { calculateHaversineDistance } from '../utils/haversine.js';
import { MatchedWorker } from '../types/index.js';

export const findNearbyWorkers = async (req: Request, res: Response): Promise<void> => {
    try {
        const lat = req.query.lat ? Number(req.query.lat) : undefined;
        const lng = req.query.lng ? Number(req.query.lng) : undefined;
        const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 5;
        const category = req.query.category ? String(req.query.category).trim() : undefined;

        if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
            res.status(400).json({
                success: false,
                error: 'Valid lat and lng query parameters are required'
            });
            return;
        }

        let workerIds: string[] = [];

        try {
            const redisMembers = await redisClient.geoSearch(
                REDIS_WORKERS_GEO_KEY,
                { latitude: lat, longitude: lng },
                { radius: radiusKm, unit: 'km' }
            );
            workerIds = redisMembers as string[];
        } catch (redisErr) {
            console.warn('Redis GEOSEARCH failed or key empty, falling back to Postgres:', redisErr);
        }

        let query = `
            SELECT worker_id, phone_number, worker_category, worker_sub_category, trust_score, 
                   is_available, last_known_lat, last_known_lng
            FROM workers
            WHERE is_available = true
        `;
        const queryParams: any[] = [];

        if (workerIds.length > 0) {
            query += ` AND worker_id = ANY($1)`;
            queryParams.push(workerIds);
            if (category) {
                query += ` AND UPPER(worker_category) = UPPER($2)`;
                queryParams.push(category);
            }
        } else {
            if (category) {
                query += ` AND UPPER(worker_category) = UPPER($1)`;
                queryParams.push(category);
            }
        }

        const pgResult = await pool.query(query, queryParams);

        const matchedWorkers: MatchedWorker[] = [];

        for (const row of pgResult.rows) {
            const wLat = Number(row.last_known_lat);
            const wLng = Number(row.last_known_lng);
            if (isNaN(wLat) || isNaN(wLng)) continue;

            const distanceMeters = Math.round(calculateHaversineDistance(lat, lng, wLat, wLng));
            if (distanceMeters > radiusKm * 1000) continue;

            matchedWorkers.push({
                workerId: row.worker_id,
                phoneNumber: row.phone_number,
                workerCategory: row.worker_category,
                workerSubCategory: row.worker_sub_category || undefined,
                trustScore: Number(row.trust_score),
                lat: wLat,
                lng: wLng,
                distanceMeters
            });
        }

        matchedWorkers.sort((a, b) => a.distanceMeters - b.distanceMeters);

        res.status(200).json({
            success: true,
            employerLocation: { lat, lng },
            searchRadiusKm: radiusKm,
            count: matchedWorkers.length,
            workers: matchedWorkers
        });
    } catch (error: any) {
        console.error('Error in findNearbyWorkers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
