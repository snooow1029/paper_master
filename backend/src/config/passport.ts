import passport from 'passport';
import { Strategy as GoogleStrategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../services/AuthService';
import { Profile } from 'passport-google-oauth20';

const authService = new AuthService();

// Configure Google OAuth Strategy (only if credentials are provided)
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  // IMPORTANT: Callback URL must match exactly between:
  // 1. The redirect_uri in the authorization URL (authRoutes.ts)
  // 2. The callbackURL in passport Strategy (this file)
  // 3. The authorized redirect URIs in Google Cloud Console
  //
  // CRITICAL: In production, GOOGLE_CALLBACK_URL MUST be set to full URL!
  // Example: https://papermaster-production-c4fe.up.railway.app/api/auth/google/callback
  //
  // If not set, we use relative path '/api/auth/google/callback'
  // passport-google-oauth20 will resolve this relative to the request host,
  // but it may not match the full URL used in authorization, causing invalid_grant errors
  let callbackURL = process.env.GOOGLE_CALLBACK_URL;
  
  if (!callbackURL) {
    // In production (Railway), try to construct from RAILWAY_PUBLIC_DOMAIN or use relative path
    // Note: Relative path may cause issues if authorization URL uses full URL
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
    if (railwayDomain) {
      callbackURL = `https://${railwayDomain}/api/auth/google/callback`;
      console.log(`🔐 Constructed callback URL from RAILWAY_PUBLIC_DOMAIN: ${callbackURL}`);
    } else {
      callbackURL = '/api/auth/google/callback';
      console.warn('⚠️  WARNING: GOOGLE_CALLBACK_URL not set! Using relative path.');
      console.warn('⚠️  This may cause invalid_grant errors if authorization URL uses full URL.');
      console.warn('⚠️  Please set GOOGLE_CALLBACK_URL environment variable in Railway.');
    }
  }
  
  console.log(`🔐 Google OAuth Strategy callback URL: ${callbackURL}`);
  console.log(`⚠️  Make sure this matches the redirect_uri in authorization URL and Google Cloud Console`);
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: callbackURL,
      },
      async (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
        try {
          const user = await authService.findOrCreateUser({
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName,
            picture: profile.photos?.[0]?.value,
          });
          return done(null, user);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
  console.log('✅ Google OAuth strategy configured');
} else {
  console.log('⚠️  Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable');
}

// Note: We're using JWT tokens instead of sessions
// No need for serializeUser/deserializeUser

export default passport;

