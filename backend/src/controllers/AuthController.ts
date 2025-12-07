import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';

export class AuthController {
  private authService: AuthService;
  private sessionService: SessionService;

  constructor() {
    this.authService = new AuthService();
    this.sessionService = new SessionService();
  }

  /**
   * Google OAuth callback handler
   */
  async googleCallback(req: Request, res: Response) {
    try {
      // This will be handled by passport middleware
      // The user will be attached to req.user by passport
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication failed' });
      }

      // Redirect to frontend with token or user info
      // For now, we'll return user info
      // In production, you should generate a JWT token here
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error('Error in Google OAuth callback:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await this.authService.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error('Error getting current user:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  }

  /**
   * Logout (client-side should clear token)
   */
  async logout(req: Request, res: Response) {
    try {
      // In a JWT-based system, logout is handled client-side
      // For session-based auth, you would destroy the session here
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      console.error('Error logging out:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }
}

