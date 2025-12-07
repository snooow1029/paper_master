import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';
import { AuthService } from '../services/AuthService';

const authService = new AuthService();

/**
 * JWT authentication middleware
 * Verifies JWT token from Authorization header and attaches user to request
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
      return;
    }

    const payload = verifyToken(token);

    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Fetch user from database
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Attach user to request
    (req as any).user = user;
    (req as any).userId = user.id;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional auth middleware - doesn't fail if user is not authenticated
 * Attaches user to request if token is valid, but continues even if not
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const user = await authService.getUserById(payload.userId);
        if (user) {
          (req as any).user = user;
          (req as any).userId = user.id;
        }
      }
    }
  } catch (error) {
    // Silently fail for optional auth
    console.error('Optional auth error:', error);
  }

  next();
};

// Alias for backward compatibility
export const requireAuth = authenticateToken;

