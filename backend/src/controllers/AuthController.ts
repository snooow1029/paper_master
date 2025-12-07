import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { generateToken } from '../utils/jwt';

export class AuthController {
  private authService: AuthService;
  private sessionService: SessionService;

  constructor() {
    this.authService = new AuthService();
    this.sessionService = new SessionService();
  }

  /**
   * Google OAuth callback handler
   * Generates JWT token and redirects to frontend with token
   */
  async googleCallback(req: Request, res: Response) {
    try {
      // User is attached to req.user by passport middleware
      const user = (req as any).user;
      
      if (!user) {
        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/login?error=authentication_failed`);
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
      });

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/login/success?token=${encodeURIComponent(token)}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error in Google OAuth callback:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/login?error=server_error`);
    }
  }

  /**
   * Get current user info (requires JWT authentication)
   */
  async getCurrentUser(req: Request, res: Response) {
    try {
      // User is attached by authenticateToken middleware
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
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

