import { Router } from 'express';
import { conversationController } from '../controllers/conversationController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /conversations
 * List conversations for authenticated user
 * Requires: JWT authentication
 */
router.get('/', authenticate, conversationController.getConversations);

/**
 * POST /conversations
 * Create new conversation (1:1 or group)
 * Requires: JWT authentication
 * Body: { type?, title?, memberIds: string[] }
 */
router.post('/', authenticate, conversationController.createConversation);

/**
 * PATCH /conversations/:id/archive
 * Archive or unarchive a conversation
 * Requires: JWT authentication
 * Body: { archived: boolean }
 */
router.patch('/:id/archive', authenticate, conversationController.archiveConversation);

/**
 * GET /conversations/:id
 * Get conversation details with last N messages
 * Requires: JWT authentication
 * Query params: limit? (default: 20, max: 50)
 */
router.get('/:id', authenticate, conversationController.getConversation);

export default router;

