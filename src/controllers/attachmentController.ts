import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { uploadFile } from '../utils/s3Helper';

export class AttachmentController {
  /**
   * POST /attachments
   * Upload a file attachment
   * Accepts: multipart/form-data with 'file' field
   */
  uploadAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded. Use multipart/form-data with "file" field.' });
        return;
      }

      // Upload file (S3 or local)
      const result = await uploadFile(file, 'attachments');

      res.json({
        success: true,
        url: result.url,
        mime: result.mime,
        size: result.size,
        name: result.name,
      });
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      res.status(500).json({
        error: 'Failed to upload attachment',
        details: error.message,
      });
    }
  };
}

export const attachmentController = new AttachmentController();

