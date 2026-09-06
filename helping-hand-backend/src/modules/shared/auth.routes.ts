import { Router } from 'express';
import {
    sendOtp,
    verifyOtp,
    googleAuth,
    getGoogleUrl,
    handleGoogleWebCallback,
    refreshUserToken
} from './auth.controller.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
    sendOtpSchema,
    verifyOtpSchema,
    googleAuthSchema
} from '../../utils/validation.schemas.js';

const router = Router();

// Phone OTP Authentication
router.post('/send-otp', validateBody(sendOtpSchema), sendOtp);
router.post('/verify-otp', validateBody(verifyOtpSchema), verifyOtp);

// Google OAuth Authentication
router.post('/google', validateBody(googleAuthSchema), googleAuth);
router.get('/google/url', getGoogleUrl);
router.get('/google/callback', handleGoogleWebCallback);

// Token Refresh
router.post('/refresh-token', refreshUserToken);

export default router;
