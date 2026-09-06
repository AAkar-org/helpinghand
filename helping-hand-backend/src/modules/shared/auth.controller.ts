import { Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../../db/db.js';
import redisClient from '../../db/redisClient.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { verifyGoogleIdToken, getGoogleAuthUrl, exchangeCodeForProfile } from '../../services/googleAuth.service.js';

// 1. Send OTP (with Rate Limiting & Crypto Random Generation)
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            res.status(400).json({ success: false, error: 'Valid phone number is required' });
            return;
        }

        const cleanedPhone = phoneNumber.trim();

        // Check Cooldown (60 seconds)
        const cooldown = await redisClient.get(`otp_cooldown:${cleanedPhone}`);
        if (cooldown) {
            res.status(429).json({
                success: false,
                error: 'Please wait at least 60 seconds before requesting another OTP'
            });
            return;
        }

        // Check Hourly Limit (Max 5 requests per hour)
        const hourlyAttempts = await redisClient.get(`otp_hourly:${cleanedPhone}`);
        if (hourlyAttempts && parseInt(hourlyAttempts) >= 5) {
            res.status(429).json({
                success: false,
                error: 'Too many OTP requests for this phone number. Please try again in an hour.'
            });
            return;
        }

        // Generate cryptographically secure 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();

        // Store OTP in Redis (5 minute validity)
        await redisClient.set(`otp:${cleanedPhone}`, otp, { EX: 300 });

        // Set 60s cooldown in Redis
        await redisClient.set(`otp_cooldown:${cleanedPhone}`, '1', { EX: 60 });

        // Increment hourly attempt counter
        await redisClient.incr(`otp_hourly:${cleanedPhone}`);
        await redisClient.expire(`otp_hourly:${cleanedPhone}`, 3600);

        // Reset failed verification count
        await redisClient.del(`otp_failed:${cleanedPhone}`);

        console.log(`📱 [SMS Gateway] OTP generated for ${cleanedPhone}: ${otp}`);

        const responsePayload: any = {
            success: true,
            message: 'OTP generated and sent successfully',
            phoneNumber: cleanedPhone
        };

        // Only include plain OTP in response in non-production environments
        if (process.env.NODE_ENV !== 'production') {
            responsePayload.otp = otp;
        }

        res.status(200).json(responsePayload);
    } catch (error: any) {
        console.error('Error in sendOtp:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. Verify OTP (with Brute-force Shield & JWT Issuance)
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumber, otp } = req.body;
        if (!phoneNumber || !otp) {
            res.status(400).json({ success: false, error: 'Phone number and OTP are required' });
            return;
        }

        const cleanedPhone = phoneNumber.trim();

        // Check failed attempts (lock after 5 failed attempts)
        const failedCount = await redisClient.get(`otp_failed:${cleanedPhone}`);
        if (failedCount && parseInt(failedCount) >= 5) {
            res.status(429).json({
                success: false,
                error: 'Too many incorrect attempts. This OTP is locked. Please request a new OTP.'
            });
            return;
        }

        const cachedOtp = await redisClient.get(`otp:${cleanedPhone}`);

        // Check dev bypass (only in non-production)
        const isDevBypass = process.env.NODE_ENV !== 'production' && otp === '123456';

        if (!cachedOtp && !isDevBypass) {
            res.status(400).json({ success: false, error: 'OTP has expired or was not requested' });
            return;
        }

        if (cachedOtp !== otp && !isDevBypass) {
            await redisClient.incr(`otp_failed:${cleanedPhone}`);
            await redisClient.expire(`otp_failed:${cleanedPhone}`, 300);
            res.status(400).json({ success: false, error: 'Invalid OTP code' });
            return;
        }

        // Successfully verified: clear OTP keys
        await redisClient.del(`otp:${cleanedPhone}`);
        await redisClient.del(`otp_failed:${cleanedPhone}`);

        // Check if user is a Worker
        const workerRes = await pool.query(
            'SELECT * FROM workers WHERE phone_number = $1',
            [cleanedPhone]
        );

        if (workerRes.rows.length > 0) {
            const worker = workerRes.rows[0];
            const token = signAccessToken({
                userId: worker.worker_id,
                role: 'worker',
                phoneNumber: worker.phone_number
            });
            const refreshToken = signRefreshToken({
                userId: worker.worker_id,
                role: 'worker'
            });

            res.status(200).json({
                success: true,
                isNewUser: false,
                role: 'worker',
                user: worker,
                token,
                refreshToken
            });
            return;
        }

        // Check if user is an Employer
        const employerRes = await pool.query(
            'SELECT * FROM employers WHERE phone_number = $1',
            [cleanedPhone]
        );

        if (employerRes.rows.length > 0) {
            const employer = employerRes.rows[0];
            const token = signAccessToken({
                userId: employer.employer_id,
                role: 'employer',
                phoneNumber: employer.phone_number
            });
            const refreshToken = signRefreshToken({
                userId: employer.employer_id,
                role: 'employer'
            });

            res.status(200).json({
                success: true,
                isNewUser: false,
                role: 'employer',
                user: employer,
                token,
                refreshToken
            });
            return;
        }

        // New user
        res.status(200).json({
            success: true,
            isNewUser: true,
            phoneNumber: cleanedPhone,
            message: 'Phone number verified. User registration required.'
        });
    } catch (error: any) {
        console.error('Error in verifyOtp:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. Google OAuth Authentication (Mobile & Web ID Token Verification)
export const googleAuth = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idToken, role = 'employer' } = req.body;
        if (!idToken) {
            res.status(400).json({ success: false, error: 'Google ID Token is required' });
            return;
        }

        const selectedRole = role === 'worker' ? 'worker' : 'employer';
        const googleProfile = await verifyGoogleIdToken(idToken);

        const { googleId, email, fullName, avatarUrl } = googleProfile;

        if (selectedRole === 'employer') {
            // Find or create employer
            let empRes = await pool.query(
                'SELECT * FROM employers WHERE google_id = $1 OR email = $2',
                [googleId, email]
            );

            let employer;
            let isNewUser = false;

            if (empRes.rows.length > 0) {
                employer = empRes.rows[0];
                // Update Google info if needed
                if (!employer.google_id || !employer.avatar_url) {
                    const updateRes = await pool.query(
                        `UPDATE employers 
                         SET google_id = COALESCE(google_id, $1), 
                             avatar_url = COALESCE(avatar_url, $2),
                             full_name = COALESCE(full_name, $3)
                         WHERE employer_id = $4 RETURNING *`,
                        [googleId, avatarUrl, fullName, employer.employer_id]
                    );
                    employer = updateRes.rows[0];
                }
            } else {
                isNewUser = true;
                const insertRes = await pool.query(
                    `INSERT INTO employers (google_id, email, full_name, avatar_url)
                     VALUES ($1, $2, $3, $4)
                     RETURNING *`,
                    [googleId, email, fullName || 'Employer', avatarUrl]
                );
                employer = insertRes.rows[0];
            }

            const token = signAccessToken({
                userId: employer.employer_id,
                role: 'employer',
                email: employer.email
            });
            const refreshToken = signRefreshToken({
                userId: employer.employer_id,
                role: 'employer'
            });

            res.status(200).json({
                success: true,
                isNewUser,
                role: 'employer',
                user: employer,
                token,
                refreshToken
            });
            return;
        } else {
            // Worker role
            let wrkRes = await pool.query(
                'SELECT * FROM workers WHERE google_id = $1 OR email = $2',
                [googleId, email]
            );

            let worker;
            let isNewUser = false;

            if (wrkRes.rows.length > 0) {
                worker = wrkRes.rows[0];
                if (!worker.google_id || !worker.avatar_url) {
                    const updateRes = await pool.query(
                        `UPDATE workers 
                         SET google_id = COALESCE(google_id, $1), 
                             avatar_url = COALESCE(avatar_url, $2)
                         WHERE worker_id = $3 RETURNING *`,
                        [googleId, avatarUrl, worker.worker_id]
                    );
                    worker = updateRes.rows[0];
                }
            } else {
                isNewUser = true;
                const insertRes = await pool.query(
                    `INSERT INTO workers (google_id, email, avatar_url, worker_category)
                     VALUES ($1, $2, $3, 'GENERAL_LABOR')
                     RETURNING *`,
                    [googleId, email, avatarUrl]
                );
                worker = insertRes.rows[0];
            }

            const token = signAccessToken({
                userId: worker.worker_id,
                role: 'worker',
                email: worker.email
            });
            const refreshToken = signRefreshToken({
                userId: worker.worker_id,
                role: 'worker'
            });

            res.status(200).json({
                success: true,
                isNewUser,
                role: 'worker',
                user: worker,
                token,
                refreshToken
            });
            return;
        }
    } catch (error: any) {
        console.error('Error in googleAuth:', error);
        res.status(401).json({ success: false, error: `Google authentication failed: ${error.message}` });
    }
};

// 4. Get Google OAuth Web Consent URL
export const getGoogleUrl = (req: Request, res: Response): void => {
    try {
        const { role = 'employer' } = req.query;
        const url = getGoogleAuthUrl(String(role));
        res.status(200).json({ success: true, url });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 5. Google Web Redirect Callback
export const handleGoogleWebCallback = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, state: role = 'employer' } = req.query;
        if (!code || typeof code !== 'string') {
            res.status(400).json({ success: false, error: 'Authorization code is required' });
            return;
        }

        const profile = await exchangeCodeForProfile(code);
        // Delegate to internal helper with verified profile
        req.body = {
            idToken: `mock-google-token:${profile.email}:${profile.fullName}:${profile.googleId}`,
            role
        };
        return googleAuth(req, res);
    } catch (error: any) {
        console.error('Error in handleGoogleWebCallback:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 6. Refresh Access Token
export const refreshUserToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(400).json({ success: false, error: 'Refresh token is required' });
            return;
        }

        const decoded = verifyRefreshToken(refreshToken);
        const newToken = signAccessToken({
            userId: decoded.userId,
            role: decoded.role
        });

        res.status(200).json({
            success: true,
            token: newToken
        });
    } catch (error: any) {
        res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }
};
