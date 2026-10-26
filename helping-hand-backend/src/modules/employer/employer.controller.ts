import { Request, Response } from 'express';
import pool from '../../db/db.js';
import redisClient from '../../db/redisClient.js';
import { REDIS_WORKERS_GEO_KEY } from '../../utils/constants.js';
import { calculateHaversineDistance } from '../../utils/haversine.js';
import { scheduleAutomatedVerificationCall } from '../../services/callScheduler.js';
import { processIvrKeypress } from '../../services/ivrService.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';
import { MatchedWorker } from '../../types/index.js';

// 1. Employer Registration (from authController.ts)
export const registerEmployer = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumber, fullName, upiId } = req.body;
        if (!phoneNumber || !fullName) {
            res.status(400).json({
                success: false,
                error: 'phoneNumber and fullName are required'
            });
            return;
        }

        const cleanedPhone = phoneNumber.trim();

        const result = await pool.query(
            `INSERT INTO employers (phone_number, full_name, upi_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (phone_number) DO UPDATE
             SET full_name = EXCLUDED.full_name,
                 upi_id = COALESCE(EXCLUDED.upi_id, employers.upi_id)
             RETURNING *`,
            [cleanedPhone, fullName.trim(), upiId ? upiId.trim() : null]
        );

        const user = result.rows[0];
        const token = signAccessToken({
            userId: user.employer_id,
            role: 'employer',
            phoneNumber: cleanedPhone,
            email: user.email
        });
        const refreshToken = signRefreshToken({
            userId: user.employer_id,
            role: 'employer',
            phoneNumber: cleanedPhone,
            email: user.email
        });

        res.status(201).json({
            success: true,
            role: 'employer',
            token,
            refreshToken,
            user
        });
    } catch (error: any) {
        console.error('Error in registerEmployer:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. Worker Discovery (from demandController.ts)
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

// 3. Shift Management (from shiftController.ts)
export const createShift = async (req: Request, res: Response): Promise<void> => {
    try {
        const { employerId, workerId, agreedDailyWage } = req.body;
        if (!employerId || !workerId || agreedDailyWage === undefined) {
            res.status(400).json({
                success: false,
                error: 'employerId, workerId, and agreedDailyWage are required'
            });
            return;
        }

        const empCheck = await pool.query('SELECT employer_id FROM employers WHERE employer_id = $1', [employerId]);
        if (empCheck.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Employer not found' });
            return;
        }

        const wrkCheck = await pool.query('SELECT worker_id FROM workers WHERE worker_id = $1', [workerId]);
        if (wrkCheck.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Worker not found' });
            return;
        }

        const result = await pool.query(
            `INSERT INTO shifts (employer_id, worker_id, agreed_daily_wage, status, platform_fee_paid)
             VALUES ($1, $2, $3, 'PENDING', true)
             RETURNING *`,
            [employerId, workerId, Number(agreedDailyWage)]
        );

        res.status(201).json({
            success: true,
            shift: result.rows[0]
        });
    } catch (error: any) {
        console.error('Error in createShift:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const adjustShiftTiming = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId } = req.params;
        const targetShiftId = Array.isArray(shiftId) ? shiftId[0] : shiftId;
        const { startTime, endTime, workedHours, customWage, reason, standardHoursPerDay } = req.body;

        const shiftCheck = await pool.query('SELECT * FROM shifts WHERE shift_id = $1', [targetShiftId]);
        if (shiftCheck.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Shift not found' });
            return;
        }

        const shift = shiftCheck.rows[0];
        const baseDailyWage = Number(shift.agreed_daily_wage);
        const standardHours = Number(standardHoursPerDay || 8);

        let calculatedHours = workedHours !== undefined ? Number(workedHours) : undefined;
        let startTs = startTime ? new Date(startTime) : (shift.start_time ? new Date(shift.start_time) : new Date());
        let endTs = endTime ? new Date(endTime) : (shift.end_time ? new Date(shift.end_time) : new Date());

        if (calculatedHours === undefined && startTime && endTime) {
            const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
            calculatedHours = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100);
        }

        if (calculatedHours === undefined) {
            calculatedHours = Number(shift.worked_hours || standardHours);
        }

        let finalAdjustedWage: number;

        if (customWage !== undefined) {
            finalAdjustedWage = Number(customWage);
        } else {
            finalAdjustedWage = Math.round(((calculatedHours / standardHours) * baseDailyWage) * 100) / 100;
        }

        const result = await pool.query(
            `UPDATE shifts 
             SET start_time = $1, 
                 end_time = $2, 
                 worked_hours = $3, 
                 adjusted_wage = $4, 
                 adjustment_reason = $5
             WHERE shift_id = $6 
             RETURNING *`,
            [startTs, endTs, calculatedHours, finalAdjustedWage, reason || 'Shift timing adjusted', targetShiftId]
        );

        res.status(200).json({
            success: true,
            message: `Shift timing & wage successfully updated. Adjusted wage: ₹${finalAdjustedWage} for ${calculatedHours} hour(s).`,
            shift: result.rows[0]
        });
    } catch (error: any) {
        console.error('Error in adjustShiftTiming:', error);
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

        await pool.query(
            'UPDATE workers SET is_available = false WHERE worker_id = $1',
            [completedShift.worker_id]
        );
        await redisClient.zRem(REDIS_WORKERS_GEO_KEY, completedShift.worker_id);

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
        const callerRole: 'employer' | 'worker' = (req.body.role || 'employer') as 'employer' | 'worker';
        const digit = String(req.body.Digits ?? req.body.dtmfDigit ?? '').trim();

        if (!digit || (digit !== '1' && digit !== '2')) {
            if (req.body.Digits !== undefined) {
                res.setHeader('Content-Type', 'text/xml');
                res.status(200).send('<Response><Say voice="Polly.Aditi" language="en-IN">Invalid keypress. Please press 1 to confirm, or 2 to dispute.</Say></Response>');
                return;
            }
            res.status(400).json({
                success: false,
                error: 'Valid dtmfDigit (1 for confirm, 2 for dispute) is required'
            });
            return;
        }

        const targetShiftId = Array.isArray(shiftId) ? shiftId[0] : shiftId;
        const result = await processIvrKeypress(targetShiftId, callerRole, digit);

        // If called by Twilio Voice webhook, respond with compliant TwiML
        if (req.body.Digits !== undefined || req.headers['x-twilio-signature']) {
            res.setHeader('Content-Type', 'text/xml');
            const replyPrompt = digit === '1'
                ? 'Thank you. Your confirmation has been recorded successfully. Goodbye.'
                : 'Thank you. A payment dispute has been registered for this shift. Goodbye.';
            res.status(200).send(`<Response><Say voice="Polly.Aditi" language="en-IN">${replyPrompt}</Say></Response>`);
            return;
        }

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

export const getEmployerShifts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT * FROM shifts WHERE employer_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.status(200).json({ success: true, count: result.rows.length, shifts: result.rows });
    } catch (error: any) {
        console.error('Error in getEmployerShifts:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. Worker Info & Rating (from ratingController.ts)
export const getWorkerMapSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const { workerId } = req.params;
        const targetWorkerId = Array.isArray(workerId) ? workerId[0] : workerId;

        const workerRes = await pool.query(
            `SELECT worker_id, phone_number, worker_category, worker_sub_category, 
                    is_available, trust_score, average_rating, total_completed_shifts, 
                    total_ratings_count, is_verified_id, last_known_lat, last_known_lng
             FROM workers
             WHERE worker_id = $1`,
            [targetWorkerId]
        );

        if (workerRes.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Worker not found' });
            return;
        }

        const worker = workerRes.rows[0];

        const reviewsRes = await pool.query(
            `SELECT rating_stars, review_comment, created_at
             FROM ratings
             WHERE reviewee_id = $1 AND reviewer_role = 'employer' AND review_comment IS NOT NULL
             ORDER BY created_at DESC
             LIMIT 2`,
            [targetWorkerId]
        );

        res.status(200).json({
            success: true,
            mapSummaryCard: {
                workerId: worker.worker_id,
                workerCategory: worker.worker_category,
                workerSubCategory: worker.worker_sub_category,
                trustScore: Number(worker.trust_score),
                averageRating: Number(worker.average_rating),
                totalCompletedShifts: Number(worker.total_completed_shifts),
                totalRatingsCount: Number(worker.total_ratings_count),
                isVerifiedId: worker.is_verified_id,
                recentReviews: reviewsRes.rows.map((r: any) => ({
                    stars: r.rating_stars,
                    comment: r.review_comment,
                    date: r.created_at
                }))
            }
        });
    } catch (error: any) {
        console.error('Error in getWorkerMapSummary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const submitEmployerRating = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId, reviewerId, revieweeId, reviewerRole, ratingStars, reviewComment } = req.body;

        if (!shiftId || !reviewerId || !revieweeId || !reviewerRole || ratingStars === undefined) {
            res.status(400).json({
                success: false,
                error: 'shiftId, reviewerId, revieweeId, reviewerRole ("employer"), and ratingStars (1-5) are required'
            });
            return;
        }

        if (reviewerRole !== 'employer') {
            res.status(400).json({ success: false, error: 'reviewerRole must be "employer" for this route' });
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

        // Update Worker Reputation & Total Completed Shifts Count
        const avgRes = await pool.query(
            `SELECT AVG(rating_stars) as avg_rating, COUNT(rating_id) as total_ratings
             FROM ratings
             WHERE reviewee_id = $1 AND reviewer_role = 'employer'`,
            [revieweeId]
        );

        const newAvgRating = Math.round(Number(avgRes.rows[0].avg_rating || 5.0) * 100) / 100;
        const totalRatings = Number(avgRes.rows[0].total_ratings || 0);

        const completedShiftsRes = await pool.query(
            `SELECT COUNT(shift_id) as completed_count
             FROM shifts
             WHERE worker_id = $1 AND status = 'COMPLETED'`,
            [revieweeId]
        );
        const totalCompleted = Number(completedShiftsRes.rows[0].completed_count || 0);

        await pool.query(
            `UPDATE workers 
             SET average_rating = $1, trust_score = $1, total_ratings_count = $2, total_completed_shifts = $3
             WHERE worker_id = $4`,
            [newAvgRating, totalRatings, totalCompleted, revieweeId]
        );

        res.status(201).json({
            success: true,
            message: 'Rating and review submitted successfully.',
            rating
        });
    } catch (error: any) {
        console.error('Error in submitEmployerRating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 5. Employer Physical Cash Handshake Confirmation (with GPS Verification)
export const confirmCashHandshake = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId } = req.params;
        const { handshakeCode, employerLat, employerLng, cashAmount } = req.body;

        const targetShiftId = Array.isArray(shiftId) ? shiftId[0] : shiftId;

        const cachedHandshake = await redisClient.get(`shift_handshake:${targetShiftId}`);
        if (!cachedHandshake) {
            res.status(400).json({
                success: false,
                verified: false,
                error: 'Handshake session expired or was not initiated by the worker. Ask worker to tap "Receive Cash".'
            });
            return;
        }

        const handshake = JSON.parse(cachedHandshake);

        if (handshake.code !== String(handshakeCode).trim()) {
            res.status(400).json({
                success: false,
                verified: false,
                error: 'Invalid handshake code. Please enter the 4-digit code shown on the worker screen.'
            });
            return;
        }

        // Verify GPS proximity between Worker and Employer
        const distanceMeters = Math.round(
            calculateHaversineDistance(
                handshake.workerLat,
                handshake.workerLng,
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

        const shiftCheck = await pool.query('SELECT * FROM shifts WHERE shift_id = $1', [targetShiftId]);
        if (shiftCheck.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Shift not found' });
            return;
        }

        const existingShift = shiftCheck.rows[0];
        const effectiveCash = cashAmount !== undefined ? Number(cashAmount) : Number(existingShift.adjusted_wage ?? existingShift.agreed_daily_wage);

        // Mark shift COMPLETED
        const shiftResult = await pool.query(
            `UPDATE shifts 
             SET status = 'COMPLETED', actual_cash_paid = $1, end_time = COALESCE(end_time, CURRENT_TIMESTAMP) 
             WHERE shift_id = $2 
             RETURNING *`,
            [effectiveCash, targetShiftId]
        );

        const completedShift = shiftResult.rows[0];

        // Worker availability update
        await pool.query('UPDATE workers SET is_available = false WHERE worker_id = $1', [completedShift.worker_id]);
        await redisClient.zRem(REDIS_WORKERS_GEO_KEY, completedShift.worker_id);

        // Clear handshake key
        await redisClient.del(`shift_handshake:${targetShiftId}`);

        // Schedule IVR Verification Call
        const callScheduleResult = await scheduleAutomatedVerificationCall(targetShiftId, 5, false);

        res.status(200).json({
            success: true,
            verified: true,
            distanceMeters,
            message: 'Physical cash handshake confirmed! Shift closed and automated verification scheduled.',
            shift: completedShift,
            callScheduled: callScheduleResult
        });
    } catch (error: any) {
        console.error('Error in confirmCashHandshake:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

