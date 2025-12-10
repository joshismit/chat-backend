import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { signToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';
import { messageSyncService } from '../services/messageSyncService';

export class AuthController {
  /**
   * POST /auth/register
   * Register/Signup a new user
   * Creates user with unique token and stores in database
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phone, name, avatarUrl } = req.body;

      if (!phone || !name) {
        res.status(400).json({ error: 'Phone number and name are required' });
        return;
      }

      const result = await authService.registerUser(phone, name, avatarUrl);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Return user info (without password) and token
      const userObj = result.user!.toObject();
      delete userObj.password;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: userObj._id.toString(),
          name: userObj.name,
          phone: userObj.phone,
          avatarUrl: userObj.avatarUrl || null,
          token: result.token,
        },
      });
    } catch (error) {
      console.error('Error during registration:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  };

  /**
   * POST /auth/send-otp
   * Send OTP to phone number
   */
  sendOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phone } = req.body;

      if (!phone) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
      }

      const result = await authService.sendOTP(phone);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'OTP sent successfully',
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  };

  /**
   * POST /auth/verify-otp
   * Verify OTP and login (Mobile only - Master device)
   * Returns access token and refresh token
   */
  verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phone, otp, deviceId } = req.body;

      if (!phone || !otp) {
        res.status(400).json({ error: 'Phone number and OTP are required' });
        return;
      }

      const result = await authService.verifyOTP(phone, otp, deviceId);

      if (!result.success) {
        res.status(401).json({ error: result.error });
        return;
      }

      // Return user info (without password)
      const userObj = result.user!.toObject();
      delete userObj.password;

      res.json({
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          id: userObj._id.toString(),
          name: userObj.name,
          phone: userObj.phone,
          avatarUrl: userObj.avatarUrl || null,
        },
      });
    } catch (error) {
      console.error('Error during OTP verification:', error);
      res.status(500).json({ error: 'Failed to verify OTP' });
    }
  };

  /**
   * POST /auth/refresh-token
   * Refresh access token using refresh token
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const result = await authService.refreshAccessToken(refreshToken);

      if (!result.success) {
        res.status(401).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        accessToken: result.accessToken,
      });
    } catch (error) {
      console.error('Error refreshing token:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  };

  /**
   * POST /auth/logout
   * Revoke refresh token (logout)
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const result = await authService.revokeRefreshToken(refreshToken);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({ error: 'Failed to logout' });
    }
  };

  /**
   * GET /auth/qr-challenge
   * Create a new QR challenge
   */
  createQRChallenge = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get API base URL from request or environment
      const protocol = req.protocol;
      const host = req.get('host') || 'localhost:3000';
      const apiBaseUrl = process.env.API_BASE_URL || `${protocol}://${host}`;

      const result = await authService.createQRChallenge(apiBaseUrl);

      res.json(result);
    } catch (error) {
      console.error('Error creating QR challenge:', error);
      res.status(500).json({ error: 'Failed to create QR challenge' });
    }
  };

  /**
   * POST /auth/qr-scan
   * Mobile app scans QR code and authorizes desktop session
   * 
   * Requirements:
   * - Mobile must be authenticated (JWT token in Authorization header)
   * - QR token (UUID) from scanned QR code
   * - Backend creates desktop session token (long-lived)
   */
  scanQRCode = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // QR token (UUID) from scanned QR code
      const token = req.body.token;

      if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'QR token is required' });
        return;
      }

      // Get userId from authenticated mobile user (set by authenticate middleware)
      // This ensures only authenticated mobile devices can authorize desktop sessions
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Mobile authentication required. Please login on mobile first.' });
        return;
      }

      console.log(`Mobile device (userId: ${userId}) authorizing QR token: ${token}`);

      const result = await authService.scanQRCode(token, userId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ 
        success: true, 
        challengeId: result.challengeId,
        message: 'Desktop session authorized successfully'
      });
    } catch (error) {
      console.error('Error scanning QR code:', error);
      res.status(500).json({ error: 'Failed to scan QR code' });
    }
  };

  /**
   * GET /auth/qr-status
   * Check QR challenge status
   */
  getQRStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { challengeId } = req.query;

      if (!challengeId || typeof challengeId !== 'string') {
        res.status(400).json({ error: 'challengeId is required' });
        return;
      }

      const status = await authService.getQRStatus(challengeId);

      res.json(status);
    } catch (error) {
      console.error('Error getting QR status:', error);
      res.status(500).json({ error: 'Failed to get QR status' });
    }
  };

  /**
   * POST /auth/qr-confirm
   * Desktop confirms QR challenge and gets access token and refresh token
   * Only works if mobile (master device) has authorized it
   */
  confirmQRChallenge = async (req: Request, res: Response): Promise<void> => {
    try {
      const { challengeId } = req.body;

      if (!challengeId || typeof challengeId !== 'string') {
        res.status(400).json({ error: 'challengeId is required' });
        return;
      }

      const result = await authService.confirmQRChallenge(challengeId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Return user info (without password)
      const userObj = result.user!.toObject();
      delete userObj.password;

      res.json({
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          id: userObj._id.toString(),
          name: userObj.name,
          phone: userObj.phone,
          avatarUrl: userObj.avatarUrl || null,
        },
      });
    } catch (error) {
      console.error('Error confirming QR challenge:', error);
      res.status(500).json({ error: 'Failed to confirm QR challenge' });
    }
  };

  /**
   * GET /auth/sync-messages
   * Get recent messages for desktop initial sync (WhatsApp-like)
   * Returns recent messages from all conversations
   */
  syncMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const limitPerConversation = parseInt(req.query.limit as string || '50', 10);
      const daysBack = parseInt(req.query.days as string || '7', 10);

      const conversationSyncs = await messageSyncService.getRecentMessagesForUser(
        userId,
        limitPerConversation,
        daysBack
      );

      res.json({
        success: true,
        conversations: conversationSyncs,
        count: conversationSyncs.length,
      });
    } catch (error) {
      console.error('Error syncing messages:', error);
      res.status(500).json({ error: 'Failed to sync messages' });
    }
  };

  /**
   * GET /auth/users/search?phone=...
   * Search for users by phone number
   * Requires authentication
   */
  searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { phone } = req.query;
      const userId = req.user?.userId;

      if (!phone || typeof phone !== 'string') {
        res.status(400).json({ error: 'Phone query parameter is required' });
        return;
      }

      const result = await authService.searchUsersByPhone(phone, userId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Format users (exclude password)
      const formattedUsers = result.users!.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl || null,
      }));

      res.json({
        success: true,
        users: formattedUsers,
      });
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  };
}

export const authController = new AuthController();
