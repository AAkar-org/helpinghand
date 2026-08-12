import { Router } from 'express';
import {
    registerEmployer,
    findNearbyWorkers,
    createShift,
    adjustShiftTiming,
    reconcileCash,
    handleIvrCallback,
    getShiftById,
    getEmployerShifts,
    getWorkerMapSummary,
    submitEmployerRating
} from './employer.controller.js';

const router = Router();

router.post('/register', registerEmployer);
router.get('/nearby-workers', findNearbyWorkers);
router.post('/shifts/create', createShift);
router.get('/shifts/user/:userId', getEmployerShifts); // Matches original pattern /shifts/user/:userId
router.get('/shifts/:shiftId', getShiftById);
router.patch('/shifts/:shiftId/adjust-timing', adjustShiftTiming);
router.post('/shifts/:shiftId/reconcile-cash', reconcileCash);
router.post('/shifts/:shiftId/ivr-callback', handleIvrCallback);
router.get('/workers/:workerId/summary', getWorkerMapSummary);
router.post('/ratings/submit', submitEmployerRating);

export default router;
