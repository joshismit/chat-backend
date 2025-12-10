import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * POST /auth/register
 * Register/Signup a new user
 * Creates user with unique token and stores in database
 */
router.post('/register', authController.register);

/**
 * POST /auth/signup
 * Alias for /auth/register (for compatibility)
 */
router.post('/signup', authController.register);

/**
 * POST /auth/send-otp
 * Send OTP to phone number
 */
router.post('/send-otp', authController.sendOTP);

/**
 * POST /auth/verify-otp
 * Verify OTP and login (Mobile only - Master device)
 * Returns access token and refresh token
 */
router.post('/verify-otp', authController.verifyOTP);

/**
 * POST /auth/login
 * Alias for /auth/verify-otp (for compatibility)
 * Verify OTP and login (Mobile only - Master device)
 * Returns access token and refresh token
 */
router.post('/login', authController.verifyOTP);

/**
 * POST /auth/refresh-token
 * Refresh access token using refresh token
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * POST /auth/refresh
 * Alias for /auth/refresh-token (for compatibility)
 * Refresh access token using refresh token
 */
router.post('/refresh', authController.refreshToken);

/**
 * POST /auth/logout
 * Revoke refresh token (logout)
 */
router.post('/logout', authController.logout);

/**
 * GET /auth/sync-messages
 * Get recent messages for desktop initial sync
 * Requires authentication
 */
router.get('/sync-messages', authenticate, authController.syncMessages);

/**
 * GET /auth/qr-challenge
 * Create a new QR challenge token
 */
router.get('/qr-challenge', authController.createQRChallenge);

/**
 * POST /auth/qr-scan
 * Mobile app scans QR code and authorizes with user ID
 * Requires authentication (JWT token)
 */
router.post('/qr-scan', authenticate, authController.scanQRCode);

/**
 * GET /auth/qr-status?challengeId=...
 * Check QR challenge status
 */
router.get('/qr-status', authController.getQRStatus);

/**
 * POST /auth/qr-confirm
 * Desktop confirms QR challenge and receives JWT token
 */
router.post('/qr-confirm', authController.confirmQRChallenge);

/**
 * GET /auth/users/search?phone=...
 * Search for users by phone number
 * Requires authentication
 */
router.get('/users/search', authenticate, authController.searchUsers);

export default router;
