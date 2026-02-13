import { Router } from 'express';
import { callController } from '../controllers/callController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * POST /calls/initiate
 * Initiate a new call
 */
router.post('/initiate', authenticate as any, callController.initiateCall);

/**
 * POST /calls/accept
 * Accept an incoming call
 */
router.post('/accept', authenticate as any, callController.acceptCall);

/**
 * POST /calls/end
 * Decline or end a call
 */
router.post('/end', authenticate as any, callController.endCall);

/**
 * POST /calls/ringing
 * Report that the receiver's device is ringing
 */
router.post('/ringing', authenticate as any, callController.reportRinging);

export default router;
