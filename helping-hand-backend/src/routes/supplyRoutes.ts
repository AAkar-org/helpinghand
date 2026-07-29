import { Router } from 'express';
import { toggleAvailability, updateLocation, getWorkerStatus } from '../controllers/supplyController.js';

const router = Router();

router.post('/toggle-availability', toggleAvailability);
router.post('/location', updateLocation);
router.get('/status/:workerId', getWorkerStatus);

export default router;
