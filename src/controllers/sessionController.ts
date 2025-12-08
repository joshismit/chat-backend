import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { RefreshToken } from '../models/RefreshToken';
import mongoose from 'mongoose';

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

      const userIdObj = new mongoose.Types.ObjectId(userId);

      // Get current session token from request (if available)
      const authHeader = req.headers.authorization;
      let currentTokenId: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const { RefreshToken: RefreshTokenModel } = await import('../models/RefreshToken');
          // Try to find session by matching access token or refresh token
          // Note: In a real implementation, you'd decode JWT to get session ID
          // For now, we'll mark sessions based on lastUsedAt (most recent = current)
        } catch (error) {
          // Ignore token parsing errors
        }
      }

      // Get all active sessions (not expired)
      const sessions = await RefreshToken.find({
        userId: userIdObj,
        expiresAt: { $gt: new Date() },
      })
        .select('_id deviceType deviceId userAgent ipAddress lastUsedAt createdAt')
        .sort({ lastUsedAt: -1 })
        .lean();

      // Format sessions
      // Mark most recently used session as current (if multiple sessions exist)
      const formattedSessions = sessions.map((session, index) => ({
        id: session._id.toString(),
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

      const userIdObj = new mongoose.Types.ObjectId(userId);
      const sessionIdObj = new mongoose.Types.ObjectId(sessionId);

      // Find and verify session belongs to user
      const session = await RefreshToken.findOne({
        _id: sessionIdObj,
        userId: userIdObj,
      });

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Delete session
      await RefreshToken.deleteOne({ _id: sessionIdObj });

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

