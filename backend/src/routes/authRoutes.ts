import { Router } from 'express';
import passport from '../config/passport';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
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

