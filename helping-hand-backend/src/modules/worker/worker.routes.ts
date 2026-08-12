import { Router } from 'express';
import {
    registerWorker,
    toggleAvailability,
    updateLocation,
    getWorkerStatus,
    acceptShift,
    startShift,
    reconcileCash,
    handleIvrCallback,
    getShiftById,
    getWorkerShifts,
    getWorkerMyProfile,
    submitWorkerRating
} from './worker.controller.js';

const router = Router();

router.post('/register', registerWorker);
router.post('/toggle-availability', toggleAvailability);
router.post('/location', updateLocation);
router.get('/status/:workerId', getWorkerStatus);
router.get('/shifts/user/:userId', getWorkerShifts); // Matches original pattern /shifts/user/:userId
router.get('/shifts/:shiftId', getShiftById);
router.patch('/shifts/:shiftId/accept', acceptShift);
router.patch('/shifts/:shiftId/start', startShift);
router.post('/shifts/:shiftId/reconcile-cash', reconcileCash);
router.post('/shifts/:shiftId/ivr-callback', handleIvrCallback);
router.get('/profile/:workerId', getWorkerMyProfile);
router.post('/ratings/submit', submitWorkerRating);

export default router;
