import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

export class AuthService {
  /**
   * Find or create user from Google OAuth profile
   */
  async findOrCreateUser(profile: {
    id: string;
    email: string;
    name?: string;
    picture?: string;
  }): Promise<User> {
    const userRepository = AppDataSource.getRepository(User);

    // Try to find existing user by googleId or email
    let user = await userRepository.findOne({
      where: [{ googleId: profile.id }, { email: profile.email }],
    });

    if (!user) {
      // Create new user
      user = userRepository.create({
        googleId: profile.id,
        email: profile.email,
        name: profile.name || null,
        avatar: profile.picture || null,
      });
      await userRepository.save(user);
    } else {
      // Update existing user with Google info if needed
      if (!user.googleId && profile.id) {
        user.googleId = profile.id;
      }
      if (!user.name && profile.name) {
        user.name = profile.name;
      }
      if (!user.avatar && profile.picture) {
        user.avatar = profile.picture;
      }
      await userRepository.save(user);
    }

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const userRepository = AppDataSource.getRepository(User);
    return await userRepository.findOne({ where: { id: userId } });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const userRepository = AppDataSource.getRepository(User);
    return await userRepository.findOne({ where: { email } });
  }
}

