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
      
      console.log('🔐 AuthController.googleCallback called');
      console.log('🔐 User:', user ? { id: user.id, email: user.email } : null);
      
      if (!user) {
        console.error('❌ No user found in request');
        // Ensure FRONTEND_URL has no trailing slash
        const baseUrl = (process.env.FRONTEND_URL || 'https://paper-master.vercel.app').replace(/\/$/, '');
        const redirectUrl = `${baseUrl}/?error=authentication_failed`;
        
        console.log('🚀 Redirecting to (no user):', redirectUrl);
        console.log('🚀 FRONTEND_URL from env:', process.env.FRONTEND_URL);
        
        if (!redirectUrl || redirectUrl.includes('undefined')) {
          console.error('❌ Redirect URL is invalid!');
          return res.status(500).send('Server Configuration Error: Invalid Redirect URL');
        }
        
        return res.redirect(redirectUrl);
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
      });

      console.log('🔐 Token generated:', token ? `${token.substring(0, 20)}...` : 'null');
      console.log('🔐 Token type:', typeof token);
      console.log('🔐 Token length:', token ? token.length : 0);

      // Ensure FRONTEND_URL has no trailing slash
      // Default to localhost for development
      const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
      
      // Redirect to frontend with token in query parameter
      const redirectUrl = `${baseUrl}/?token=${encodeURIComponent(token)}`;
      
      console.log('🚀 Attempting to redirect to:', redirectUrl);
      console.log('🚀 FRONTEND_URL from env:', process.env.FRONTEND_URL);
      console.log('🚀 Base URL (after cleanup):', baseUrl);
      console.log('🚀 Full redirect URL:', redirectUrl);
      
      // Validate redirect URL
      if (!redirectUrl || redirectUrl.includes('undefined')) {
        console.error('❌ Redirect URL is invalid!');
        console.error('❌ Redirect URL contains undefined');
        console.error('❌ FRONTEND_URL:', process.env.FRONTEND_URL);
        return res.status(500).send('Server Configuration Error: Invalid Redirect URL');
      }
      
      // Check for common issues
      if (redirectUrl.includes('[object Object]')) {
        console.error('❌ Token is an object instead of string!');
        return res.status(500).send('Server Error: Token generation failed');
      }
      
      if (redirectUrl.trim() !== redirectUrl) {
        console.warn('⚠️  Redirect URL has leading/trailing whitespace!');
        console.warn('⚠️  Original:', JSON.stringify(redirectUrl));
        console.warn('⚠️  Trimmed:', JSON.stringify(redirectUrl.trim()));
      }
      
      console.log('✅ Redirect URL is valid, redirecting...');
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('❌ Error in Google OAuth callback:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Ensure FRONTEND_URL has no trailing slash
      // Default to localhost for development
      const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
      const redirectUrl = `${baseUrl}/?error=server_error`;
      
      console.log('🚀 Redirecting to (error):', redirectUrl);
      console.log('🚀 FRONTEND_URL from env:', process.env.FRONTEND_URL);
      
      if (!redirectUrl || redirectUrl.includes('undefined')) {
        console.error('❌ Error redirect URL is invalid!');
        return res.status(500).send('Server Configuration Error: Invalid Redirect URL');
      }
      
      res.redirect(redirectUrl);
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

