import { Request, Response } from 'express';
import { SessionService } from '../services/SessionService';
import { AnalysisSaveService, GraphData } from '../services/AnalysisSaveService';

export class SessionController {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }

  /**
   * Create a new session
   */
  async createSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { title, description } = req.body;
      const session = await this.sessionService.createSession(userId, title, description);
      
      res.status(201).json(session);
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }

  /**
   * Get all sessions for current user
   */
  async getUserSessions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const sessions = await this.sessionService.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error('Error getting user sessions:', error);
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  }

  /**
   * Get session by ID
   */
  async getSessionById(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await this.sessionService.getSessionById(id, userId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json(session);
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }

  /**
   * Get full graph data for a session
   */
  async getSessionGraphData(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const graphData = await this.sessionService.getSessionGraphData(id, userId);
      
      if (!graphData) {
        return res.status(404).json({ error: 'Session not found or has no graph data' });
      }

      // Extract priorWorks and derivativeWorks from graphData if available
      const priorWorks = (graphData as any).priorWorks || {};
      const derivativeWorks = (graphData as any).derivativeWorks || {};

      res.json({
        sessionId: id,
        graphData: {
          nodes: graphData.nodes,
          edges: graphData.edges
        },
        priorWorks,
        derivativeWorks
      });
    } catch (error) {
      console.error('Error getting session graph data:', error);
      res.status(500).json({ error: 'Failed to get session graph data' });
    }
  }

  /**
   * Update session
   */
  async updateSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      const { title, description } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await this.sessionService.updateSession(id, userId, { title, description });
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json(session);
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({ error: 'Failed to update session' });
    }
  }

  /**
   * Update graph data for a session
   */
  async updateSessionGraph(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      const { graphData, originalPapers } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      if (!graphData || !graphData.nodes || !graphData.edges) {
        return res.status(400).json({ error: 'graphData with nodes and edges is required' });
      }

      const analysisSaveService = new AnalysisSaveService();
      const result = await analysisSaveService.updateSessionGraph(id, userId, graphData as GraphData, originalPapers);

      res.json({
        session: {
          id: result.session.id,
          title: result.session.title,
          updatedAt: result.session.updatedAt,
        },
        analysesCount: result.analyses.length,
      });
    } catch (error) {
      console.error('Error updating session graph:', error);
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.status(500).json({ error: 'Failed to update session graph' });
    }
  }

  /**
   * Delete session
   */
  async deleteSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const success = await this.sessionService.deleteSession(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  }

  /**
   * Delete all sessions for current user
   */
  async deleteAllSessions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const deletedCount = await this.sessionService.deleteAllSessions(userId);
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error('Error deleting all sessions:', error);
      res.status(500).json({ error: 'Failed to delete all sessions' });
    }
  }
}

