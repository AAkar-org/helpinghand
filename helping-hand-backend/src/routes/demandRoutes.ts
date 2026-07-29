import { Router } from 'express';
import { findNearbyWorkers } from '../controllers/demandController.js';

const router = Router();

router.get('/nearby-workers', findNearbyWorkers);

export default router;
