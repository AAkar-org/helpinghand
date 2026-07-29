import { Router } from 'express';
import { sendOtp, verifyOtp, registerWorker, registerEmployer } from '../controllers/authController.js';

const router = Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register-worker', registerWorker);
router.post('/register-employer', registerEmployer);

export default router;
