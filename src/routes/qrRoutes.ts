import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /qr/generate
 * Desktop: Generate QR code for login
 * Returns: { challengeId, qrPayload }
 */
router.get('/generate', authController.createQRChallenge);

/**
 * POST /qr/approve
 * Mobile: Approve QR code scan (authorize desktop session)
 * Requires: Authentication (JWT token from mobile)
 * Body: { token: string } (QR token from scanned code)
 */
router.post('/approve', authenticate, authController.scanQRCode);

/**
 * GET /qr/status?challengeId=...
 * Desktop: Check QR challenge status (for polling)
 * Returns: { status: 'pending' | 'authorized' | 'expired', user?: {...} }
 */
router.get('/status', authController.getQRStatus);

export default router;

