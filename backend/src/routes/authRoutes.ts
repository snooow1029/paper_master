import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Simple in-memory cache to track processed OAuth codes
// This prevents duplicate callback requests from being processed
const processedCodes = new Set<string>();

// Clean up cache every 60 seconds to prevent memory leaks
setInterval(() => {
  const beforeSize = processedCodes.size;
  processedCodes.clear();
  if (beforeSize > 0) {
    console.log(`🧹 Cleaned up ${beforeSize} processed OAuth codes from cache`);
  }
}, 60000);

/**
 * Middleware to prevent duplicate OAuth callback requests
 * Google OAuth codes can only be used once, so if we receive the same code twice,
 * the second request should be blocked before it reaches passport authentication
 */
const preventDuplicateCallback = (req: Request, res: Response, next: NextFunction) => {
  const code = req.query.code as string;

  // If there's no code, let passport handle the error
  if (!code) {
    return next();
  }

  // Check if this code has already been processed
  if (processedCodes.has(code)) {
    console.warn(`🛑 Duplicate OAuth callback request blocked for code: ${code.substring(0, 10)}...`);
    console.warn(`🛑 This code was already processed. Returning 204 No Content to prevent duplicate processing.`);
    
    // Return 204 No Content - this tells the browser the request was successful but there's no content to return
    // This prevents the browser from retrying or showing an error
    // DO NOT redirect here, as the first request should have already redirected successfully
    return res.status(204).end();
  }

  // Mark this code as being processed
  processedCodes.add(code);
  console.log(`✅ OAuth code ${code.substring(0, 10)}... marked as processing`);
  
  next();
};

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email']
  })
);

router.get(
  '/google/callback',
  preventDuplicateCallback, // Prevent duplicate requests BEFORE passport authentication
  (req: Request, res: Response, next: any) => {
    console.log('🔐 OAuth callback received (passed duplicate check)');
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
    
    // Log callback URL for debugging
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/auth/google/callback` : '/api/auth/google/callback');
    console.log(`🔐 Callback URL: ${callbackURL}`);
    
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
      
      // After processing, we can optionally remove the code from cache on error
      // (though it's not strictly necessary since codes are one-time use)
      const code = req.query.code as string;
      
      if (err) {
        // Remove code from cache on error so it can be retried if needed (though unlikely)
        if (code) {
          processedCodes.delete(code);
          console.log(`🗑️  Removed code ${code.substring(0, 10)}... from cache due to error`);
        }
        
        // Handle duplicate request error (code already used)
        // This should rarely happen now due to preventDuplicateCallback middleware,
        // but we keep it as a fallback safety net
        if (err.code === 'invalid_grant' || (err.message && err.message.includes('invalid_grant'))) {
          console.warn('⚠️  OAuth code already used (this should be rare with duplicate prevention middleware)');
          console.warn('⚠️  Redirecting to frontend home page...');
          
          const frontendUrl = process.env.FRONTEND_URL || 'https://paper-master.vercel.app';
          return res.redirect(`${frontendUrl}/`);
        }
        
        // Other OAuth errors - redirect with error message
        console.error('❌ OAuth authentication error:', err);
        const frontendUrl = process.env.FRONTEND_URL || 'https://paper-master.vercel.app';
        return res.redirect(`${frontendUrl}/?error=oauth_error&message=${encodeURIComponent(err.message || 'Authentication failed')}&code=${err.code || 'unknown'}`);
      }
      
      if (!user) {
        console.error('❌ OAuth authentication failed: No user');
        // Remove code from cache on failure
        if (code) {
          processedCodes.delete(code);
          console.log(`🗑️  Removed code ${code.substring(0, 10)}... from cache due to no user`);
        }
        const frontendUrl = process.env.FRONTEND_URL || 'https://paper-master.vercel.app';
        return res.redirect(`${frontendUrl}/?error=oauth_error&message=Authentication failed`);
      }
      
      // Success - attach user to request and continue to callback handler
      console.log('✅ OAuth authentication successful, generating token...');
      // Keep code in cache for a bit longer to catch any late duplicate requests
      // The interval cleanup will handle it eventually
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

