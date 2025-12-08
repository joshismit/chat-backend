import { Router } from 'express';
import { attachmentController } from '../controllers/attachmentController';
import { authenticate } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';

const router = Router();

/**
 * POST /attachments
 * Upload a file attachment
 * Requires: JWT authentication
 * Content-Type: multipart/form-data
 * Field name: 'file'
 */
router.post('/', authenticate, uploadSingle, attachmentController.uploadAttachment);

export default router;

