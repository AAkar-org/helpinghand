import pool from '../db/db.js';
import { dispatchIvrCalls } from './ivrService.js';

export const scheduleAutomatedVerificationCall = async (
    shiftId: string,
    delayMinutes: number = 5,
    isSyncTest: boolean = false
): Promise<{ scheduled: boolean; scheduledTime: Date }> => {
    const shiftRes = await pool.query(
        `SELECT s.*, w.phone_number as worker_phone, e.phone_number as employer_phone
         FROM shifts s
         JOIN workers w ON s.worker_id = w.worker_id
         JOIN employers e ON s.employer_id = e.employer_id
         WHERE s.shift_id = $1`,
        [shiftId]
    );

    if (shiftRes.rows.length === 0) {
        throw new Error(`Shift not found: ${shiftId}`);
    }

    const shift = shiftRes.rows[0];
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);

    await pool.query(
        `UPDATE shifts 
         SET verification_call_status = 'SCHEDULED', 
             verification_scheduled_at = $1 
         WHERE shift_id = $2`,
        [scheduledTime, shiftId]
    );

    console.log(`⏰ [Call Scheduler] Automated verification call scheduled for Shift ${shiftId} in ${delayMinutes} minute(s) (Target: ${scheduledTime.toISOString()})`);

    const triggerCall = async () => {
        try {
            await dispatchIvrCalls({
                shiftId,
                workerPhone: shift.worker_phone,
                employerPhone: shift.employer_phone,
                agreedWage: Number(shift.agreed_daily_wage)
            });
        } catch (err) {
            console.error(`❌ [Call Scheduler Error] Failed to trigger call for Shift ${shiftId}:`, err);
        }
    };

    if (isSyncTest || delayMinutes <= 0) {
        await triggerCall();
    } else {
        setTimeout(triggerCall, delayMinutes * 60 * 1000);
    }

    return {
        scheduled: true,
        scheduledTime
    };
};
