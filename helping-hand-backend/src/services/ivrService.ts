import pool from '../db/db.js';

export interface IvrDispatchParams {
    shiftId: string;
    workerPhone: string;
    employerPhone: string;
    agreedWage: number;
}

export const dispatchIvrCalls = async (params: IvrDispatchParams): Promise<{ success: boolean; message: string }> => {
    const { shiftId, workerPhone, employerPhone, agreedWage } = params;

    console.log(`\n📞 [IVR Telephony Engine] Initiating automated verification calls for Shift ID: ${shiftId}`);
    console.log(`   📱 Dialing Worker at ${workerPhone}... Prompt: "Did you receive ₹${agreedWage} cash payment? Press 1 for Yes, 2 for Dispute."`);
    console.log(`   📱 Dialing Employer at ${employerPhone}... Prompt: "Did you pay ₹${agreedWage} cash to worker? Press 1 for Yes, 2 for Dispute."`);

    await pool.query(
        `UPDATE shifts 
         SET verification_call_status = 'DISPATCHED'
         WHERE shift_id = $1`,
        [shiftId]
    );

    return {
        success: true,
        message: `Automated IVR call dispatched to Worker (${workerPhone}) and Employer (${employerPhone}).`
    };
};

export const processIvrKeypress = async (
    shiftId: string,
    role: 'worker' | 'employer',
    dtmfDigit: string
): Promise<{ success: boolean; shiftStatus: string; message: string }> => {
    const isConfirmed = dtmfDigit === '1';

    const currentShiftRes = await pool.query('SELECT * FROM shifts WHERE shift_id = $1', [shiftId]);
    if (currentShiftRes.rows.length === 0) {
        throw new Error(`Shift not found for ID: ${shiftId}`);
    }

    const shift = currentShiftRes.rows[0];

    let workerConfirmed = shift.worker_call_confirmed || false;
    let employerConfirmed = shift.employer_call_confirmed || false;

    if (role === 'worker') {
        workerConfirmed = isConfirmed;
    } else if (role === 'employer') {
        employerConfirmed = isConfirmed;
    }

    let newVerificationStatus = shift.verification_call_status;

    if (!isConfirmed) {
        newVerificationStatus = 'DISPUTED';
        console.log(`⚠️ [IVR Callback] Shift ${shiftId} marked DISPUTED by ${role} (pressed DTMF ${dtmfDigit})`);
    } else if (workerConfirmed && employerConfirmed) {
        newVerificationStatus = 'VERIFIED';
        console.log(`✅ [IVR Callback] Shift ${shiftId} FULLY VERIFIED by both Worker & Employer!`);
    } else {
        newVerificationStatus = 'DISPATCHED';
        console.log(`ℹ️ [IVR Callback] Shift ${shiftId} confirmed by ${role}. Waiting for other party.`);
    }

    const updatedRes = await pool.query(
        `UPDATE shifts 
         SET worker_call_confirmed = $1, 
             employer_call_confirmed = $2, 
             verification_call_status = $3
         WHERE shift_id = $4 
         RETURNING *`,
        [workerConfirmed, employerConfirmed, newVerificationStatus, shiftId]
    );

    return {
        success: true,
        shiftStatus: newVerificationStatus,
        message: `IVR Keypress ${dtmfDigit} processed for ${role}. Current call verification status: ${newVerificationStatus}`
    };
};
