import { Request, Response } from 'express';
import { AnalysisService } from '../services/AnalysisService';
import { SessionService } from '../services/SessionService';
import { AnalysisSaveService, PaperData, GraphData } from '../services/AnalysisSaveService';
import { PaperService } from '../services/PaperService';
import { GraphService } from '../services/GraphService';

export class AnalysisController {
  private analysisService: AnalysisService;
  private sessionService: SessionService;
  private analysisSaveService: AnalysisSaveService;
  private paperService: PaperService;
  private graphService: GraphService;

  constructor() {
    this.analysisService = new AnalysisService();
    this.sessionService = new SessionService();
    this.analysisSaveService = new AnalysisSaveService();
    this.paperService = new PaperService();
    this.graphService = new GraphService();
  }

  /**
   * Analyze papers and save results to database
   * POST /api/papers/analyze-and-save
   */
  async analyzeAndSave(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { urls, title } = req.body;

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'URLs array is required' });
      }

      // Step 1: Fetch papers metadata
      const papers = await this.paperService.fetchPapersFromUrls(urls);
      
      if (papers.length === 0) {
        return res.status(400).json({ error: 'No papers could be fetched from provided URLs' });
      }

      // Step 2: Generate relationships using AI
      const relations = await this.graphService.generateRelations(papers);
      
      // Step 3: Convert to graph format
      const graphData = await this.graphService.convertToGraphData(papers, relations);

      // Step 4: Save to database
      // Title will be generated from first paper if not provided
      
      // Convert Paper entities to PaperData format
      const paperData = papers.map(paper => ({
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        abstract: paper.abstract,
        introduction: paper.introduction,
        url: paper.url,
        doi: paper.doi,
        arxivId: paper.arxivId,
        publishedDate: paper.publishedDate,
        tags: paper.tags,
        fullText: paper.fullText,
      }));

      const { session, analyses } = await this.analysisSaveService.saveAnalysis(
        userId,
        title, // Pass title (or undefined to auto-generate from first paper)
        paperData,
        graphData
      );

      res.json({
        session: {
          id: session.id,
          title: session.title,
          description: session.description,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        papers,
        nodes: graphData.nodes,
        edges: graphData.edges,
        analysesCount: analyses.length,
      });
    } catch (error) {
      console.error('Error analyzing and saving papers:', error);
      res.status(500).json({ error: 'Failed to analyze and save papers' });
    }
  }

  /**
   * Save existing analysis result to database (without re-analyzing)
   * POST /api/analyses/save-result
   */
  async saveAnalysisResult(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { urls, title, graphData, papers, originalPapers } = req.body;

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'URLs array is required' });
      }

      if (!graphData || !graphData.nodes || !graphData.edges) {
        return res.status(400).json({ error: 'graphData with nodes and edges is required' });
      }

      // Convert papers to PaperData format if provided
      let paperData: PaperData[] = [];
      
      if (papers && Array.isArray(papers) && papers.length > 0) {
        paperData = papers.map((paper: any) => ({
          id: paper.id,
          title: paper.title || '',
          authors: paper.authors || [],
          abstract: paper.abstract || '',
          introduction: paper.introduction,
          url: paper.url || '',
          doi: paper.doi,
          arxivId: paper.arxivId,
          publishedDate: paper.publishedDate,
          tags: paper.tags || [],
          fullText: paper.fullText,
        }));
      } else {
        // Extract paper data from graphData nodes
        paperData = graphData.nodes.map((node: any) => ({
          id: node.id,
          title: node.label || node.title || '',
          authors: node.authors || [],
          abstract: node.abstract || '',
          introduction: node.introduction,
          url: node.url || '',
          doi: node.doi,
          arxivId: node.arxivId,
          publishedDate: node.publishedDate,
          tags: node.tags || [],
          fullText: node.fullText,
        }));
      }

      // Title will be generated from first paper if not provided

      const { session, analyses } = await this.analysisSaveService.saveAnalysis(
        userId,
        title, // Pass title (or undefined to auto-generate from first paper)
        paperData,
        graphData as GraphData,
        originalPapers // Pass priorWorks and derivativeWorks if available
      );

      res.json({
        session: {
          id: session.id,
          title: session.title,
          description: session.description,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        analysesCount: analyses.length,
      });
    } catch (error) {
      console.error('Error saving analysis result:', error);
      res.status(500).json({ error: 'Failed to save analysis result' });
    }
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
