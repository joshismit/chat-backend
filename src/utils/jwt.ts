import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m'; // Short-lived access token
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d'; // Long-lived refresh token
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10);

export interface JWTPayload {
  userId: string;
  email?: string;
  phone?: string;
  type?: 'access' | 'refresh'; // Token type
}

/**
 * Generate access token (short-lived, 15 minutes)
 */
export const signAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(
    { ...payload, type: 'access' },
    JWT_SECRET,
    {
      expiresIn: JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions
  );
};

/**
 * Generate refresh token (long-lived, 30 days)
 */
export const signRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions
  );
};

/**
 * Generate a secure random refresh token string (for database storage)
 */
export const generateRefreshTokenString = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Get refresh token expiration date
 */
export const getRefreshTokenExpirationDate = (): Date => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
  return expiresAt;
};

/**
 * Legacy function for backward compatibility
 * Now generates access token
 */
export const signToken = (payload: JWTPayload): string => {
  return signAccessToken(payload);
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
};

export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
};
