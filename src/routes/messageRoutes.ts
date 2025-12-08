import { Router } from 'express';
import { messageController } from '../controllers/messageController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * POST /messages/send
 * Send a new message
 * Requires: JWT authentication
 * Body: { conversationId, clientId?, text?, attachments? }
 */
router.post('/send', authenticate, messageController.sendMessage);

/**
 * GET /messages
 * Get paginated messages for a conversation
 * Requires: JWT authentication
 * Query params: conversationId, before? (ISO timestamp), limit? (default: 20, max: 100)
 */
router.get('/', authenticate, messageController.getMessages);

/**
 * GET /messages/history
 * Alias for GET /messages (for compatibility)
 * Get paginated messages for a conversation
 * Requires: JWT authentication
 * Query params: conversationId, before? (ISO timestamp), limit? (default: 20, max: 100)
 */
router.get('/history', authenticate, messageController.getMessages);

/**
 * POST /messages/:id/delivered
 * Mark message as delivered
 * Requires: JWT authentication
 * Body: { toUserId? } (optional, defaults to authenticated user)
 */
router.post('/:id/delivered', authenticate, messageController.markDelivered);

/**
 * POST /messages/:id/read
 * Mark message as read
 * Requires: JWT authentication
 * Body: { userId? } (optional, defaults to authenticated user)
 */
router.post('/:id/read', authenticate, messageController.markRead);

export default router;

