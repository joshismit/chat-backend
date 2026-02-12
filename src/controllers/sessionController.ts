import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export class SessionController {
  /**
   * GET /sessions/list
   * List all active sessions for the authenticated user
   * Returns: Array of session objects with device info
   */
  listSessions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Get all active sessions (not expired)
      const sessions = await prisma.refreshToken.findMany({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          deviceType: true,
          deviceId: true,
          userAgent: true,
          ipAddress: true,
          lastUsedAt: true,
          createdAt: true,
        },
        orderBy: {
          lastUsedAt: 'desc',
        },
      });

      // Format sessions
      // Mark most recently used session as current (if multiple sessions exist)
      const formattedSessions = sessions.map((session, index) => ({
        id: session.id,
        deviceType: session.deviceType,
        deviceId: session.deviceId || 'Unknown',
        userAgent: session.userAgent || 'Unknown',
        ipAddress: session.ipAddress || 'Unknown',
        lastUsedAt: session.lastUsedAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        isCurrent: index === 0, // Most recently used session is considered current
      }));

      res.json({
        success: true,
        sessions: formattedSessions,
        count: formattedSessions.length,
      });
    } catch (error) {
      console.error('Error listing sessions:', error);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  };

  /**
   * DELETE /sessions/revoke/:id
   * Revoke a specific session by ID
   * Requires: Authentication
   */
  revokeSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const sessionId = req.params.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      // Find and verify session belongs to user
      const session = await prisma.refreshToken.findFirst({
        where: {
          id: sessionId,
          userId,
        },
      });

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Delete session
      await prisma.refreshToken.delete({
        where: { id: sessionId },
      });

      res.json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (error) {
      console.error('Error revoking session:', error);
      res.status(500).json({ error: 'Failed to revoke session' });
    }
  };
}

export const sessionController = new SessionController();
