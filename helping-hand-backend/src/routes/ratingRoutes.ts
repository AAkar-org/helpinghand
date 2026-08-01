import { Router } from 'express';
import {
    submitRating,
    getWorkerMapSummary,
    getWorkerMyProfile
} from '../controllers/ratingController.js';

const router = Router();

router.post('/submit', submitRating);
router.get('/workers/:workerId/summary', getWorkerMapSummary);
router.get('/workers/:workerId/my-profile', getWorkerMyProfile);

export default router;
