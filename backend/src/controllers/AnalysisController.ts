import { Request, Response } from 'express';
import { AnalysisService } from '../services/AnalysisService';
import { SessionService } from '../services/SessionService';

export class AnalysisController {
  private analysisService: AnalysisService;
  private sessionService: SessionService;

  constructor() {
    this.analysisService = new AnalysisService();
    this.sessionService = new SessionService();
  }

  /**
   * Create or update analysis
   */
  async createOrUpdateAnalysis(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { sessionId, paperId, notes, relationshipGraph } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Verify session belongs to user
      const session = await this.sessionService.getSessionById(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const analysis = await this.analysisService.createOrUpdateAnalysis(sessionId, paperId, {
        notes,
        relationshipGraph,
      });

      res.json(analysis);
    } catch (error) {
      console.error('Error creating/updating analysis:', error);
      res.status(500).json({ error: 'Failed to create/update analysis' });
    }
  }

  /**
   * Get all analyses for a session
   */
  async getSessionAnalyses(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { sessionId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Verify session belongs to user
      const session = await this.sessionService.getSessionById(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const analyses = await this.analysisService.getSessionAnalyses(sessionId);
      res.json(analyses);
    } catch (error) {
      console.error('Error getting session analyses:', error);
      res.status(500).json({ error: 'Failed to get analyses' });
    }
  }

  /**
   * Get analysis by ID
   */
  async getAnalysisById(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const analysis = await this.analysisService.getAnalysisById(id);
      
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Verify session belongs to user
      const session = await this.sessionService.getSessionById(analysis.sessionId, userId);
      if (!session) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(analysis);
    } catch (error) {
      console.error('Error getting analysis:', error);
      res.status(500).json({ error: 'Failed to get analysis' });
    }
  }

  /**
   * Delete analysis
   */
  async deleteAnalysis(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const analysis = await this.analysisService.getAnalysisById(id);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Verify session belongs to user
      const session = await this.sessionService.getSessionById(analysis.sessionId, userId);
      if (!session) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const success = await this.analysisService.deleteAnalysis(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting analysis:', error);
      res.status(500).json({ error: 'Failed to delete analysis' });
    }
  }
}

