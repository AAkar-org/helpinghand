import { Request, Response } from 'express';
import pool from '../db/db.js';
import redisClient from '../db/redisClient.js';
import { REDIS_WORKERS_GEO_KEY } from './supplyController.js';
import { calculateHaversineDistance } from '../utils/haversine.js';
import { scheduleAutomatedVerificationCall } from '../services/callScheduler.js';
import { processIvrKeypress } from '../services/ivrService.js';

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

        res.status(200).json({ success: true, shift: result.rows[0] });
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

        res.status(200).json({ success: true, shift: result.rows[0] });
    } catch (error: any) {
        console.error('Error in startShift:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const reconcileCash = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId } = req.params;
        const { workerLat, workerLng, employerLat, employerLng, cashAmount, delayMinutes, isSyncTest } = req.body;

        if (
            workerLat === undefined || workerLng === undefined ||
            employerLat === undefined || employerLng === undefined ||
            cashAmount === undefined
        ) {
            res.status(400).json({
                success: false,
                error: 'workerLat, workerLng, employerLat, employerLng, and cashAmount are required'
            });
            return;
        }

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
             SET status = 'COMPLETED', actual_cash_paid = $1, end_time = CURRENT_TIMESTAMP 
             WHERE shift_id = $2 
             RETURNING *`,
            [Number(cashAmount), shiftId]
        );

        if (shiftResult.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Shift not found' });
            return;
        }

        const completedShift = shiftResult.rows[0];

        await pool.query(
            'UPDATE workers SET is_available = false WHERE worker_id = $1',
            [completedShift.worker_id]
        );
        await redisClient.zRem(REDIS_WORKERS_GEO_KEY, completedShift.worker_id);

        const callDelay = delayMinutes !== undefined ? Number(delayMinutes) : 5;
        const targetShiftId = Array.isArray(shiftId) ? shiftId[0] : shiftId;
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

export const getShiftsByUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { role } = req.query;

        let query = 'SELECT * FROM shifts WHERE ';
        if (role === 'worker') {
            query += 'worker_id = $1';
        } else {
            query += 'employer_id = $1';
        }
        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, [userId]);
        res.status(200).json({ success: true, count: result.rows.length, shifts: result.rows });
    } catch (error: any) {
        console.error('Error in getShiftsByUser:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
