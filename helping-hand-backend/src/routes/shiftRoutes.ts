import { Router } from 'express';
import {
    createShift,
    acceptShift,
    startShift,
    reconcileCash,
    handleIvrCallback,
    getShiftById,
    getShiftsByUser
} from '../controllers/shiftController.js';

const router = Router();

router.post('/create', createShift);
router.patch('/:shiftId/accept', acceptShift);
router.patch('/:shiftId/start', startShift);
router.post('/:shiftId/reconcile-cash', reconcileCash);
router.post('/:shiftId/ivr-callback', handleIvrCallback);
router.get('/:shiftId', getShiftById);
router.get('/user/:userId', getShiftsByUser);

export default router;
