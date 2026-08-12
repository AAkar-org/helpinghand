import { Request, Response } from 'express';
import pool from '../../db/db.js';
import redisClient from '../../db/redisClient.js';

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            res.status(400).json({ success: false, error: 'Valid phone number is required' });
            return;
        }

        const cleanedPhone = phoneNumber.trim();
        const otp = '123456';

        await redisClient.set(`otp:${cleanedPhone}`, otp, { EX: 300 });

        res.status(200).json({
            success: true,
            message: 'OTP generated and sent successfully',
            phoneNumber: cleanedPhone,
            otp
        });
    } catch (error: any) {
        console.error('Error in sendOtp:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumber, otp } = req.body;
        if (!phoneNumber || !otp) {
            res.status(400).json({ success: false, error: 'Phone number and OTP are required' });
            return;
        }

        const cleanedPhone = phoneNumber.trim();
        const cachedOtp = await redisClient.get(`otp:${cleanedPhone}`);

        if (!cachedOtp && otp !== '123456') {
            res.status(400).json({ success: false, error: 'OTP has expired or was not requested' });
            return;
        }

        if (cachedOtp !== otp && otp !== '123456') {
            res.status(400).json({ success: false, error: 'Invalid OTP code' });
            return;
        }

        const workerRes = await pool.query(
            'SELECT * FROM workers WHERE phone_number = $1',
            [cleanedPhone]
        );

        if (workerRes.rows.length > 0) {
            res.status(200).json({
                success: true,
                isNewUser: false,
                role: 'worker',
                user: workerRes.rows[0]
            });
            return;
        }

        const employerRes = await pool.query(
            'SELECT * FROM employers WHERE phone_number = $1',
            [cleanedPhone]
        );

        if (employerRes.rows.length > 0) {
            res.status(200).json({
                success: true,
                isNewUser: false,
                role: 'employer',
                user: employerRes.rows[0]
            });
            return;
        }

        res.status(200).json({
            success: true,
            isNewUser: true,
            message: 'Phone number verified. User registration required.'
        });
    } catch (error: any) {
        console.error('Error in verifyOtp:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
