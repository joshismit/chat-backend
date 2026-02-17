import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    phone?: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    // Also check for token in query params (useful for SSE connections on web)
    const queryToken = req.query.token as string;

    const token = extractTokenFromHeader(authHeader) || queryToken;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = verifyToken(token);
    req.user = {
      userId: payload.userId,
      phone: payload.phone,
    };

    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Invalid token' });
  }
};

