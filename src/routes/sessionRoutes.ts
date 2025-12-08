import { Router } from 'express';
import { sessionController } from '../controllers/sessionController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /sessions/list
 * List all active sessions for authenticated user
 * Requires: Authentication
 */
router.get('/list', authenticate, sessionController.listSessions);

/**
 * DELETE /sessions/revoke/:id
 * Revoke a specific session by ID
 * Requires: Authentication
 */
router.delete('/revoke/:id', authenticate, sessionController.revokeSession);

export default router;

