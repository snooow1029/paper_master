import { Router, Request, Response } from 'express';
import passport from '../config/passport';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Google OAuth routes
router.get(
  '/google',
  (req: Request, res: Response, next: any) => {
    // Manually build Google OAuth authorization URL with prompt=select_account
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    
    // Use the same callback URL logic as passport.ts
    // If GOOGLE_CALLBACK_URL is set, use it; otherwise construct from request
    let callbackURL = process.env.GOOGLE_CALLBACK_URL;
    if (!callbackURL) {
      // Construct full URL from request
      callbackURL = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    }
    
    console.log(`🔐 OAuth authorization redirect_uri: ${callbackURL}`);
    
    if (!googleClientId) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', callbackURL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'profile email');
    authUrl.searchParams.set('prompt', 'select_account'); // Force account selection screen every time
    authUrl.searchParams.set('access_type', 'offline');

    return res.redirect(authUrl.toString());
  }
);

router.get(
  '/google/callback',
  (req: Request, res: Response, next: any) => {
    console.log('🔐 OAuth callback received');
    console.log('🔐 Query params:', req.query);
    console.log('🔐 Callback URL from request:', req.url);
    
    // IMPORTANT: The callbackURL used here must match exactly with:
    // 1. The redirect_uri in the authorization URL (from /google route)
    // 2. The callbackURL in passport Strategy configuration
    // 3. The authorized redirect URIs in Google Cloud Console
    
    // If GOOGLE_CALLBACK_URL is not set, we need to ensure passport uses the same
    // full URL that was used in the authorization request
    // Since we can't modify passport strategy at runtime, we must ensure
    // GOOGLE_CALLBACK_URL environment variable is set in production
    
    const expectedCallbackURL = process.env.GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    console.log(`🔐 Expected callback URL: ${expectedCallbackURL}`);
    console.log(`🔐 Strategy callback URL: ${process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'}`);
    
    if (!process.env.GOOGLE_CALLBACK_URL) {
      console.warn('⚠️  WARNING: GOOGLE_CALLBACK_URL not set!');
      console.warn('⚠️  This may cause invalid_grant errors if Strategy uses relative path');
      console.warn('⚠️  Please set GOOGLE_CALLBACK_URL environment variable in Railway');
    }
    
    passport.authenticate('google', { session: false }, (err: any, user: any, info: any) => {
      console.log('🔐 Passport authenticate result:');
      console.log('  - Error:', err);
      if (err) {
        console.error('❌ OAuth authentication error details:', {
          code: err.code,
          message: err.message,
          status: err.status,
          name: err.name,
        });
      }
      console.log('  - User:', user ? { id: user.id, email: user.email } : null);
      console.log('  - Info:', info);
      
      if (err) {
        console.error('❌ OAuth authentication error:', err);
        const frontendUrl = process.env.FRONTEND_URL || 'https://paper-master.vercel.app';
        return res.redirect(`${frontendUrl}/?error=oauth_error&message=${encodeURIComponent(err.message || 'Authentication failed')}&code=${err.code || 'unknown'}`);
      }
      
      if (!user) {
        console.error('❌ OAuth authentication failed: No user');
        const frontendUrl = process.env.FRONTEND_URL || 'https://paper-master.vercel.app';
        return res.redirect(`${frontendUrl}/?error=oauth_error&message=Authentication failed`);
      }
      
      // Attach user to request and continue to callback handler
      (req as any).user = user;
      authController.googleCallback(req, res);
    })(req, res, next);
  }
);

// Get current user (requires JWT token)
router.get('/me', authenticateToken, authController.getCurrentUser.bind(authController));

// Logout (client-side should clear token)
router.post('/logout', authenticateToken, authController.logout.bind(authController));

export default router;

