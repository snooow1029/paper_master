import { AppDataSource } from '../config/database';
import { Session } from '../entities/Session';
import { User } from '../entities/User';
import { AnalysisSaveService, GraphData } from './AnalysisSaveService';

export class SessionService {
  /**
   * Create a new session for a user
   */
  async createSession(userId: string, title?: string, description?: string): Promise<Session> {
    const sessionRepository = AppDataSource.getRepository(Session);
    
    const session = sessionRepository.create({
      userId,
      title: title || 'New Session',
      description: description || undefined,
    });
    
    return await sessionRepository.save(session);
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const sessionRepository = AppDataSource.getRepository(Session);
    return await sessionRepository.find({
      where: { userId },
      relations: ['analyses', 'analyses.paper'],
      order: { updatedAt: 'DESC' }, // Sort by last update time (most recently edited first)
    });
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string, userId?: string): Promise<Session | null> {
    const sessionRepository = AppDataSource.getRepository(Session);
    const where: any = { id: sessionId };
    if (userId) {
      where.userId = userId;
    }
    return await sessionRepository.findOne({
      where,
      relations: ['analyses', 'analyses.paper'],
    });
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, userId: string, updates: {
    title?: string;
    description?: string;
  }): Promise<Session | null> {
    const sessionRepository = AppDataSource.getRepository(Session);
    const session = await sessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return null;
    }

    if (updates.title !== undefined) {
      session.title = updates.title;
    }
    if (updates.description !== undefined) {
      session.description = updates.description;
    }

    return await sessionRepository.save(session);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const sessionRepository = AppDataSource.getRepository(Session);
    const result = await sessionRepository.delete({ id: sessionId, userId });
    return (result.affected || 0) > 0;
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllSessions(userId: string): Promise<number> {
    const sessionRepository = AppDataSource.getRepository(Session);
    const result = await sessionRepository.delete({ userId });
    return result.affected || 0;
  }

  /**
   * Get full graph data for a session
   */
  async getSessionGraphData(sessionId: string, userId?: string): Promise<GraphData | null> {
    const sessionRepository = AppDataSource.getRepository(Session);
    const where: any = { id: sessionId };
    if (userId) {
      where.userId = userId;
    }

    const session = await sessionRepository.findOne({ where });
    if (!session) {
      return null;
    }

    const analysisSaveService = new AnalysisSaveService();
    return await analysisSaveService.getSessionGraphData(sessionId);
  }
}

