import { Request, Response, NextFunction } from 'express';

/**
 * Simple authentication middleware
 * In production, you should use JWT tokens or session-based auth
 * This is a placeholder that checks for user in request (set by passport)
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  next();
};

/**
 * Optional auth middleware - doesn't fail if user is not authenticated
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // User may or may not be authenticated
  next();
};

