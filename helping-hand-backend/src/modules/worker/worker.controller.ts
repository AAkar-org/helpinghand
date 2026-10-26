import { Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../../db/db.js';
import redisClient from '../../db/redisClient.js';
import { REDIS_WORKERS_GEO_KEY } from '../../utils/constants.js';
import { calculateHaversineDistance } from '../../utils/haversine.js';
import { scheduleAutomatedVerificationCall } from '../../services/callScheduler.js';
import { processIvrKeypress } from '../../services/ivrService.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';

// Utility helper to synchronize worker availability based on current shifts status
export const syncWorkerAvailability = async (workerId: string): Promise<boolean> => {
    try {
        const activeShiftsRes = await pool.query(
            `SELECT COUNT(*) FROM shifts 
             WHERE worker_id = $1 AND status IN ('ACCEPTED', 'ACTIVE')`,
            [workerId]
        );
        const hasActiveShift = parseInt(activeShiftsRes.rows[0].count) > 0;
        const isAvailable = !hasActiveShift;

        const workerRes = await pool.query(
            `UPDATE workers SET is_available = $1 WHERE worker_id = $2 RETURNING *`,
            [isAvailable, workerId]
        );

        if (workerRes.rows.length > 0) {
            const worker = workerRes.rows[0];
            if (isAvailable) {
                const lat = Number(worker.last_known_lat);
                const lng = Number(worker.last_known_lng);
                if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                    await redisClient.geoAdd(REDIS_WORKERS_GEO_KEY, {
                        longitude: lng,
                        latitude: lat,
                        member: workerId
                    });
                }
            } else {
                await redisClient.zRem(REDIS_WORKERS_GEO_KEY, workerId);
            }
        }
        return isAvailable;
    } catch (err) {
        console.error('Error in syncWorkerAvailability:', err);
        return false;
    }
};

// 1. Worker Registration (from authController.ts)
export const registerWorker = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumber, workerCategory, workerSubCategory } = req.body;
        if (!phoneNumber || !workerCategory) {
            res.status(400).json({
                success: false,
                error: 'phoneNumber and workerCategory are required'
            });
            return;
        }

        const cleanedPhone = phoneNumber.trim();

        const result = await pool.query(
            `INSERT INTO workers (phone_number, worker_category, worker_sub_category, is_available)
             VALUES ($1, $2, $3, false)
             ON CONFLICT (phone_number) DO UPDATE 
             SET worker_category = EXCLUDED.worker_category,
                 worker_sub_category = EXCLUDED.worker_sub_category
             RETURNING *`,
            [cleanedPhone, workerCategory.trim(), workerSubCategory ? workerSubCategory.trim() : null]
        );

        const user = result.rows[0];
        const token = signAccessToken({
            userId: user.worker_id,
            role: 'worker',
            phoneNumber: cleanedPhone,
            email: user.email
        });
        const refreshToken = signRefreshToken({
            userId: user.worker_id,
            role: 'worker',
            phoneNumber: cleanedPhone,
            email: user.email
        });

        res.status(201).json({
            success: true,
            role: 'worker',
            token,
            refreshToken,
            user
        });
    } catch (error: any) {
        console.error('Error in registerWorker:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. Supply Status / Availability (from supplyController.ts)
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

        let finalAvailability = isAvailable;
        let forcedOffline = false;

        if (isAvailable) {
            const activeShiftsRes = await pool.query(
                `SELECT COUNT(*) FROM shifts 
                 WHERE worker_id = $1 AND status IN ('ACCEPTED', 'ACTIVE')`,
                [workerId]
            );
            const hasActiveShift = parseInt(activeShiftsRes.rows[0].count) > 0;
            if (hasActiveShift) {
                finalAvailability = false;
                forcedOffline = true;
            }
        }

        let query = 'UPDATE workers SET is_available = $1';
        const params: any[] = [finalAvailability];

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

        if (finalAvailability) {
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
            message: forcedOffline ? 'Availability forced to offline due to active/accepted shifts' : undefined,
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
        const targetWorkerId = Array.isArray(workerId) ? workerId[0] : workerId;
        await syncWorkerAvailability(targetWorkerId);
        const result = await pool.query('SELECT * FROM workers WHERE worker_id = $1', [targetWorkerId]);

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

// 3. Worker Shift Management (from shiftController.ts)
export const acceptShift = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId } = req.params;
        const result = await pool.query(
            `UPDATE shifts SET status = 'ACCEPTED' WHERE shift_id = $1 RETURNING *`,
            [shiftId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Shift not found' });
            return;
        }

        const shift = result.rows[0];
        if (shift.worker_id) {
            await syncWorkerAvailability(shift.worker_id);
        }

        res.status(200).json({ success: true, shift });
    } catch (error: any) {
        console.error('Error in acceptShift:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const startShift = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId } = req.params;
        const result = await pool.query(
            `UPDATE shifts 
             SET status = 'ACTIVE', start_time = CURRENT_TIMESTAMP 
             WHERE shift_id = $1 
             RETURNING *`,
            [shiftId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Shift not found' });
            return;
        }

        const shift = result.rows[0];
        if (shift.worker_id) {
            await syncWorkerAvailability(shift.worker_id);
        }

        res.status(200).json({ success: true, shift });
    } catch (error: any) {
        console.error('Error in startShift:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const reconcileCash = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId } = req.params;
        const targetShiftId = Array.isArray(shiftId) ? shiftId[0] : shiftId;
        const { workerLat, workerLng, employerLat, employerLng, cashAmount, delayMinutes, isSyncTest } = req.body;

        if (
            workerLat === undefined || workerLng === undefined ||
            employerLat === undefined || employerLng === undefined
        ) {
            res.status(400).json({
                success: false,
                error: 'workerLat, workerLng, employerLat, and employerLng are required'
            });
            return;
        }

        const existingShiftRes = await pool.query('SELECT * FROM shifts WHERE shift_id = $1', [targetShiftId]);
        if (existingShiftRes.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Shift not found' });
            return;
        }

        const existingShift = existingShiftRes.rows[0];
        const effectiveCashPaid = cashAmount !== undefined ? Number(cashAmount) : Number(existingShift.adjusted_wage ?? existingShift.agreed_daily_wage);

        const distanceMeters = Math.round(
            calculateHaversineDistance(
                Number(workerLat),
                Number(workerLng),
                Number(employerLat),
                Number(employerLng)
            )
        );

        const MAX_VERIFICATION_DISTANCE_METERS = 50;

        if (distanceMeters > MAX_VERIFICATION_DISTANCE_METERS) {
            res.status(400).json({
                success: false,
                verified: false,
                distanceMeters,
                error: `GPS Proximity Verification Failed. Worker and Employer are ${distanceMeters}m apart (maximum allowed: ${MAX_VERIFICATION_DISTANCE_METERS}m).`
            });
            return;
        }

        const shiftResult = await pool.query(
            `UPDATE shifts 
             SET status = 'COMPLETED', actual_cash_paid = $1, end_time = COALESCE(end_time, CURRENT_TIMESTAMP) 
             WHERE shift_id = $2 
             RETURNING *`,
            [effectiveCashPaid, targetShiftId]
        );

        const completedShift = shiftResult.rows[0];

        if (completedShift.worker_id) {
            await syncWorkerAvailability(completedShift.worker_id);
        }

        const callDelay = delayMinutes !== undefined ? Number(delayMinutes) : 5;
        const callScheduleResult = await scheduleAutomatedVerificationCall(
            targetShiftId,
            callDelay,
            isSyncTest === true
        );

        res.status(200).json({
            success: true,
            verified: true,
            distanceMeters,
            message: 'Physical cash payment successfully verified and shift closed. Automated IVR call scheduled.',
            shift: completedShift,
            callScheduled: callScheduleResult
        });
    } catch (error: any) {
        console.error('Error in reconcileCash:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const handleIvrCallback = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId } = req.params;
        const { role, dtmfDigit } = req.body;

        if (!role || !dtmfDigit || (role !== 'worker' && role !== 'employer')) {
            res.status(400).json({
                success: false,
                error: 'Valid role ("worker" or "employer") and dtmfDigit are required'
            });
            return;
        }

        const targetShiftId = Array.isArray(shiftId) ? shiftId[0] : shiftId;
        const result = await processIvrKeypress(targetShiftId, role, String(dtmfDigit));
        res.status(200).json(result);
    } catch (error: any) {
        console.error('Error in handleIvrCallback:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getShiftById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId } = req.params;
        const result = await pool.query(
            `SELECT s.*, 
                    w.phone_number as worker_phone, w.worker_category, w.trust_score as worker_trust,
                    e.full_name as employer_name, e.phone_number as employer_phone
             FROM shifts s
             JOIN workers w ON s.worker_id = w.worker_id
             JOIN employers e ON s.employer_id = e.employer_id
             WHERE s.shift_id = $1`,
            [shiftId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Shift not found' });
            return;
        }

        res.status(200).json({ success: true, shift: result.rows[0] });
    } catch (error: any) {
        console.error('Error in getShiftById:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getWorkerShifts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT * FROM shifts WHERE worker_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.status(200).json({ success: true, count: result.rows.length, shifts: result.rows });
    } catch (error: any) {
        console.error('Error in getWorkerShifts:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. Ratings / Profile (from ratingController.ts)
export const getWorkerMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { workerId } = req.params;
        const targetWorkerId = Array.isArray(workerId) ? workerId[0] : workerId;

        await syncWorkerAvailability(targetWorkerId);

        const workerRes = await pool.query(
            `SELECT * FROM workers WHERE worker_id = $1`,
            [targetWorkerId]
        );

        if (workerRes.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Worker not found' });
            return;
        }

        const worker = workerRes.rows[0];

        const reviewsRes = await pool.query(
            `SELECT r.rating_stars, r.review_comment, r.created_at, e.full_name as reviewer_name
             FROM ratings r
             JOIN employers e ON r.reviewer_id = e.employer_id
             WHERE r.reviewee_id = $1 AND r.reviewer_role = 'employer'
             ORDER BY r.created_at DESC`,
            [targetWorkerId]
        );

        const shiftsRes = await pool.query(
            `SELECT s.shift_id, s.status, s.agreed_daily_wage, s.adjusted_wage, 
                    s.actual_cash_paid, s.worked_hours, s.end_time as completed_at,
                    e.full_name as employer_name
             FROM shifts s
             JOIN employers e ON s.employer_id = e.employer_id
             WHERE s.worker_id = $1 AND s.status = 'COMPLETED'
             ORDER BY s.end_time DESC`,
            [targetWorkerId]
        );

        res.status(200).json({
            success: true,
            workerProfile: {
                workerId: worker.worker_id,
                phoneNumber: worker.phone_number,
                workerCategory: worker.worker_category,
                workerSubCategory: worker.worker_sub_category,
                isAvailable: worker.is_available,
                trustScore: Number(worker.trust_score),
                averageRating: Number(worker.average_rating),
                totalCompletedShifts: Number(worker.total_completed_shifts),
                totalRatingsCount: Number(worker.total_ratings_count),
                isVerifiedId: worker.is_verified_id,
                reviewsList: reviewsRes.rows.map((r: any) => ({
                    stars: r.rating_stars,
                    comment: r.review_comment,
                    reviewerName: r.reviewer_name,
                    date: r.created_at
                })),
                completedShiftsHistory: shiftsRes.rows.map((s: any) => ({
                    shiftId: s.shift_id,
                    employerName: s.employer_name,
                    wage: Number(s.adjusted_wage ?? s.agreed_daily_wage),
                    actualCashPaid: Number(s.actual_cash_paid),
                    workedHours: s.worked_hours ? Number(s.worked_hours) : 8,
                    completedAt: s.completed_at
                }))
            }
        });
    } catch (error: any) {
        console.error('Error in getWorkerMyProfile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const submitWorkerRating = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId, reviewerId, revieweeId, reviewerRole, ratingStars, reviewComment } = req.body;

        if (!shiftId || !reviewerId || !revieweeId || !reviewerRole || ratingStars === undefined) {
            res.status(400).json({
                success: false,
                error: 'shiftId, reviewerId, revieweeId, reviewerRole ("worker"), and ratingStars (1-5) are required'
            });
            return;
        }

        if (reviewerRole !== 'worker') {
            res.status(400).json({ success: false, error: 'reviewerRole must be "worker" for this route' });
            return;
        }

        const stars = Math.min(5, Math.max(1, Number(ratingStars)));

        const insertResult = await pool.query(
            `INSERT INTO ratings (shift_id, reviewer_id, reviewee_id, reviewer_role, rating_stars, review_comment)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [shiftId, reviewerId, revieweeId, reviewerRole, stars, reviewComment ? reviewComment.trim() : null]
        );

        const rating = insertResult.rows[0];

        // Update Employer Rating
        const empAvgRes = await pool.query(
            `SELECT AVG(rating_stars) as avg_rating
             FROM ratings
             WHERE reviewee_id = $1 AND reviewer_role = 'worker'`,
            [revieweeId]
        );

        const newEmpRating = Math.round(Number(empAvgRes.rows[0].avg_rating || 5.0) * 100) / 100;
        await pool.query(
            `UPDATE employers SET trust_rating = $1 WHERE employer_id = $2`,
            [newEmpRating, revieweeId]
        );

        res.status(201).json({
            success: true,
            message: 'Rating and review submitted successfully.',
            rating
        });
    } catch (error: any) {
        console.error('Error in submitWorkerRating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 5. Worker Physical Cash Handshake Initiation
export const generateCashHandshakeCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId } = req.params;
        const { lat, lng } = req.body;

        const targetShiftId = Array.isArray(shiftId) ? shiftId[0] : shiftId;

        const shiftRes = await pool.query('SELECT * FROM shifts WHERE shift_id = $1', [targetShiftId]);
        if (shiftRes.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Shift not found' });
            return;
        }

        const shift = shiftRes.rows[0];

        // Generate 4-digit numeric handshake code
        const code = crypto.randomInt(1000, 9999).toString();

        const handshakeData = {
            code,
            shiftId: targetShiftId,
            workerId: shift.worker_id,
            workerLat: Number(lat),
            workerLng: Number(lng),
            createdAt: new Date().toISOString()
        };

        // Store handshake session in Redis (10 minutes validity)
        await redisClient.set(`shift_handshake:${targetShiftId}`, JSON.stringify(handshakeData), { EX: 600 });

        res.status(200).json({
            success: true,
            shiftId: targetShiftId,
            handshakeCode: code,
            expiresInSeconds: 600,
            message: '4-digit handshake code generated. Share this code with the employer upon physical cash payment.'
        });
    } catch (error: any) {
        console.error('Error in generateCashHandshakeCode:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

