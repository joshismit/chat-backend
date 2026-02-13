import { prisma } from '../utils/prisma';
import { generateQRToken, generateUserToken } from '../utils/tokenGenerator';
import {
  signAccessToken,
  signRefreshToken,
  generateRefreshTokenString,
  getRefreshTokenExpirationDate,
} from '../utils/jwt';
import { User, QRChallenge, RefreshToken } from '@prisma/client';

// QR Token expiry: 2-5 minutes (configurable via env)
const QR_TOKEN_TTL_MINUTES = parseInt(process.env.QR_TOKEN_TTL_MINUTES || '3', 10);
const MIN_QR_TOKEN_TTL = 2; // Minimum 2 minutes
const MAX_QR_TOKEN_TTL = 5; // Maximum 5 minutes

// Ensure TTL is within valid range
const QR_TOKEN_EXPIRY_MINUTES = Math.max(
  MIN_QR_TOKEN_TTL,
  Math.min(MAX_QR_TOKEN_TTL, QR_TOKEN_TTL_MINUTES)
);

export interface QRChallengeResponse {
  challengeId: string;
  qrPayload: string;
}

export interface QRStatusResponse {
  status: 'pending' | 'authorized' | 'expired';
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export class AuthService {
  // Default OTP for all users (as per requirement)
  private readonly DEFAULT_OTP = 'test123';

  /**
   * Register/Signup a new user
   * Creates user with unique token and stores in database
   */
  async registerUser(
    phone: string,
    name: string,
    avatarUrl?: string
  ): Promise<{
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
  }> {
    try {
      const trimmedPhone = phone.trim();
      const trimmedName = name.trim();

      // Validate inputs
      if (!trimmedPhone || !trimmedName) {
        return { success: false, error: 'Phone number and name are required' };
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { phone: trimmedPhone },
      });
      if (existingUser) {
        return { success: false, error: 'User with this phone number already exists' };
      }

      // Generate unique token
      let userToken: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      // Ensure token is unique
      while (!isUnique && attempts < maxAttempts) {
        userToken = generateUserToken();
        const existingTokenUser = await prisma.user.findUnique({
          where: { token: userToken },
        });
        if (!existingTokenUser) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        console.error('Failed to generate unique token after', maxAttempts, 'attempts');
        return { success: false, error: 'Failed to generate user token. Please try again.' };
      }

      // Create new user with token
      const newUser = await prisma.user.create({
        data: {
          name: trimmedName,
          phone: trimmedPhone,
          token: userToken!,
          avatarUrl: avatarUrl || null,
          activeDevices: [],
          lastSeen: new Date(),
          createdAt: new Date(),
        },
      });

      console.log('User registered successfully:', {
        id: newUser.id,
        phone: newUser.phone,
        name: newUser.name,
        token: newUser.token,
      });

      return {
        success: true,
        user: newUser,
        token: newUser.token,
      };
    } catch (error: any) {
      console.error('User registration error:', error);

      // Handle duplicate key error (phone or token)
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'field';
        return {
          success: false,
          error: `${field === 'phone' ? 'Phone number' : 'Token'} already exists`,
        };
      }

      return { success: false, error: 'Failed to register user. Please try again.' };
    }
  }

  /**
   * Send OTP to phone number
   * Currently uses default OTP "test123" for all users
   */
  async sendOTP(phone: string): Promise<{ success: boolean; error?: string }> {
    try {
      const trimmedPhone = phone.trim();
      console.log('Send OTP request for phone:', trimmedPhone);

      // Find user by phone
      const user = await prisma.user.findUnique({
        where: { phone: trimmedPhone },
      });

      if (!user) {
        console.log('User not found for phone:', trimmedPhone);
        return { success: false, error: 'User not found. Please contact support.' };
      }

      console.log('OTP sent (using default OTP) for user:', { id: user.id, phone: user.phone, name: user.name });

      // In a real implementation, you would send OTP via SMS service
      // For now, we just return success as OTP is "test123" for all users
      return { success: true };
    } catch (error) {
      console.error('Send OTP error:', error);
      return { success: false, error: 'Failed to send OTP. Please try again.' };
    }
  }

  /**
   * Verify OTP and login (Mobile only - Master device)
   * Generates access token and refresh token
   */
  async verifyOTP(
    phone: string,
    otp: string,
    deviceId?: string
  ): Promise<{
    success: boolean;
    user?: User;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }> {
    try {
      const trimmedPhone = phone.trim();
      console.log('OTP verification attempt (Mobile):', { phone: trimmedPhone, otpLength: otp.length });

      // Find user by phone
      const user = await prisma.user.findUnique({
        where: { phone: trimmedPhone },
      });

      if (!user) {
        console.log('User not found for phone:', trimmedPhone);
        return { success: false, error: 'Invalid phone number or OTP' };
      }

      console.log('User found:', { id: user.id, phone: user.phone, name: user.name });

      // Verify OTP (using default OTP "test123")
      if (otp !== this.DEFAULT_OTP) {
        console.log('Invalid OTP provided');
        return { success: false, error: 'Invalid OTP' };
      }

      console.log('OTP verified successfully');

      // Generate or get user's dedicated token (if user doesn't have one)
      if (!user.token) {
        let userToken: string;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        // Ensure token is unique
        while (!isUnique && attempts < maxAttempts) {
          userToken = generateUserToken();
          const existingUser = await prisma.user.findUnique({
            where: { token: userToken },
          });
          if (!existingUser) {
            isUnique = true;
            // Update user with token
            await prisma.user.update({
              where: { id: user.id },
              data: { token: userToken },
            });
            user.token = userToken;
            console.log('Generated unique user token:', userToken);
          }
          attempts++;
        }

        if (!isUnique) {
          console.error('Failed to generate unique token after', maxAttempts, 'attempts');
          return { success: false, error: 'Failed to generate user token. Please try again.' };
        }
      }

      // Generate tokens
      const accessToken = signAccessToken({ userId: user.id, phone: user.phone });
      const refreshTokenString = generateRefreshTokenString();
      const refreshToken = signRefreshToken({ userId: user.id, phone: user.phone });

      // Store refresh token in database
      const expiresAt = getRefreshTokenExpirationDate();
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshTokenString,
          deviceId: deviceId,
          deviceType: 'MOBILE',
          expiresAt,
        },
      });

      console.log('Refresh token stored in database');

      // Return user and tokens
      return {
        success: true,
        user,
        accessToken,
        refreshToken: refreshTokenString, // Return the database token string, not JWT
      };
    } catch (error) {
      console.error('OTP verification error:', error);
      return { success: false, error: 'OTP verification failed. Please try again.' };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshTokenString: string
  ): Promise<{
    success: boolean;
    accessToken?: string;
    error?: string;
  }> {
    try {
      // Find refresh token in database
      const refreshTokenDoc = await prisma.refreshToken.findUnique({
        where: { token: refreshTokenString },
      });

      if (!refreshTokenDoc) {
        console.log('Refresh token not found in database');
        return { success: false, error: 'Invalid refresh token' };
      }

      // Check if expired
      if (new Date() > refreshTokenDoc.expiresAt) {
        console.log('Refresh token expired');
        // Delete expired token
        await prisma.refreshToken.delete({
          where: { id: refreshTokenDoc.id },
        });
        return { success: false, error: 'Refresh token expired' };
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: refreshTokenDoc.userId },
      });
      if (!user) {
        console.log('User not found for refresh token');
        return { success: false, error: 'User not found' };
      }

      // Generate new access token
      const accessToken = signAccessToken({
        userId: user.id,
        phone: user.phone,
      });

      console.log('Access token refreshed successfully');

      return {
        success: true,
        accessToken,
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      return { success: false, error: 'Failed to refresh token' };
    }
  }

  /**
   * Revoke refresh token (logout)
   */
  async revokeRefreshToken(refreshTokenString: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: { token: refreshTokenString },
      });
      if (result.count > 0) {
        console.log('Refresh token revoked');
        return { success: true };
      }
      return { success: false, error: 'Refresh token not found' };
    } catch (error) {
      console.error('Revoke token error:', error);
      return { success: false, error: 'Failed to revoke token' };
    }
  }

  /**
   * Create a new QR challenge (Desktop)
   * Generates temporary UUID token with 2-5 min expiry
   * Returns token for QR code display and challengeId for polling
   */
  async createQRChallenge(apiBaseUrl: string): Promise<QRChallengeResponse> {
    // Generate UUID token
    const token = generateQRToken();
    const expiresAt = new Date(Date.now() + QR_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    const challenge = await prisma.qRChallenge.create({
      data: {
        token,
        expiresAt,
      },
    });

    // QR code should display just the token (UUID)
    // Desktop will poll /auth/qr-status?challengeId=... to check approval
    const qrPayload = token; // Just the UUID token, not full URL

    console.log(`QR Challenge created: ${challenge.id}, token: ${token}, expires in ${QR_TOKEN_EXPIRY_MINUTES} minutes`);

    return {
      challengeId: challenge.id,
      qrPayload, // UUID token for QR code
    };
  }

  /**
   * Scan QR code and authorize with user ID
   */
  async scanQRCode(
    token: string,
    userId: string
  ): Promise<{ success: boolean; challengeId?: string; error?: string }> {
    const challenge = await prisma.qRChallenge.findUnique({
      where: { token },
    });

    if (!challenge) {
      return { success: false, error: 'Invalid token' };
    }

    // Check if expired
    if (new Date() > challenge.expiresAt) {
      return { success: false, error: 'Token expired' };
    }

    // Check if already authorized
    if (challenge.authorizedUserId) {
      return { success: false, error: 'Token already used' };
    }

    // Authorize the challenge
    const updatedChallenge = await prisma.qRChallenge.update({
      where: { id: challenge.id },
      data: { authorizedUserId: userId },
    });

    return {
      success: true,
      challengeId: updatedChallenge.id,
    };
  }

  /**
   * Get QR challenge status
   */
  async getQRStatus(challengeId: string): Promise<QRStatusResponse> {
    const challenge = await prisma.qRChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return { status: 'expired' };
    }

    // Check if expired
    if (new Date() > challenge.expiresAt) {
      return { status: 'expired' };
    }

    // Check if authorized
    if (challenge.authorizedUserId) {
      const user = await prisma.user.findUnique({
        where: { id: challenge.authorizedUserId },
      });
      if (user) {
        return {
          status: 'authorized',
          user: {
            id: user.id,
            name: user.name,
            avatar: user.avatarUrl || undefined,
          },
        };
      }
    }

    return { status: 'pending' };
  }

  /**
   * Confirm QR challenge and get session token
   */
  async confirmQRChallenge(
    challengeId: string
  ): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    user?: User;
    error?: string;
  }> {
    const challenge = await prisma.qRChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return { success: false, error: 'Invalid challenge' };
    }

    // Check if expired
    if (new Date() > challenge.expiresAt) {
      return { success: false, error: 'Challenge expired' };
    }

    // Check if authorized by mobile (master device)
    if (!challenge.authorizedUserId) {
      return { success: false, error: 'Challenge not authorized by mobile device' };
    }

    // Get user information
    const user = await prisma.user.findUnique({
      where: { id: challenge.authorizedUserId },
    });
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Generate tokens for desktop session
    const accessToken = signAccessToken({ userId: user.id, phone: user.phone });
    const refreshTokenString = generateRefreshTokenString();
    const refreshToken = signRefreshToken({ userId: user.id, phone: user.phone });

    // Store refresh token for desktop device
    const expiresAt = getRefreshTokenExpirationDate();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenString,
        deviceType: 'DESKTOP',
        expiresAt,
      },
    });

    // Delete challenge (one-time use)
    await prisma.qRChallenge.delete({
      where: { id: challengeId },
    });

    console.log('Desktop session created via QR code');

    return {
      success: true,
      accessToken,
      refreshToken: refreshTokenString, // Return database token string
      user,
    };
  }

  /**
   * Search for users by phone number
   */
  async searchUsersByPhone(phone: string, excludeUserId?: string): Promise<{ success: boolean; users?: Array<{ id: string; name: string; phone: string; avatarUrl?: string | null }>; error?: string }> {
    try {
      const trimmedPhone = phone.trim();

      if (!trimmedPhone || trimmedPhone.length < 3) {
        return { success: false, error: 'Please enter at least 3 characters' };
      }

      // Search for users by phone or name (partial match)
      const where: any = {
        OR: [
          {
            phone: {
              contains: trimmedPhone,
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: trimmedPhone,
              mode: 'insensitive',
            },
          },
        ],
      };

      // Exclude current user if provided
      if (excludeUserId) {
        where.AND = [{ id: { not: excludeUserId } }];
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          avatarUrl: true,
        },
        take: 10,
      });

      return {
        success: true,
        users: users.map(u => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          avatarUrl: u.avatarUrl,
        })),
      };
    } catch (error) {
      console.error('Error searching users:', error);
      return { success: false, error: 'Failed to search users' };
    }
  }
}

export const authService = new AuthService();
