import { Router } from 'express';
import passport from '../config/passport';
import { AuthController } from '../controllers/AuthController';
import { requireAuth } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  authController.googleCallback.bind(authController)
);

// Get current user
router.get('/me', requireAuth, authController.getCurrentUser.bind(authController));

// Logout
router.post('/logout', requireAuth, authController.logout.bind(authController));

export default router;

