import { randomUUID } from 'crypto';

/**
 * Generate temporary QR token (UUID)
 * Used for QR code device linking
 * Expires in 2-5 minutes
 */
export const generateQRToken = (): string => {
  return randomUUID();
};

