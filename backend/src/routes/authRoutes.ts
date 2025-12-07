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
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.googleCallback.bind(authController)
);

// Get current user (requires JWT token)
router.get('/me', authenticateToken, authController.getCurrentUser.bind(authController));

// Logout (client-side should clear token)
router.post('/logout', authenticateToken, authController.logout.bind(authController));

export default router;

