import { AppDataSource } from '../config/database';
import { Analysis } from '../entities/Analysis';
import { Session } from '../entities/Session';
import { Paper } from '../entities/Paper';

export class AnalysisService {
  /**
   * Create or update analysis for a session and paper
   */
  async createOrUpdateAnalysis(
    sessionId: string,
    paperId: string,
    data: {
      notes?: string;
      relationshipGraph?: {
        nodes: Array<{ id: string; label: string; [key: string]: any }>;
        edges: Array<{ id: string; from: string; to: string; label: string; [key: string]: any }>;
      };
    }
  ): Promise<Analysis> {
    const analysisRepository = AppDataSource.getRepository(Analysis);

    // Check if analysis already exists
    let analysis = await analysisRepository.findOne({
      where: { sessionId, paperId },
    });

    if (analysis) {
      // Update existing analysis
      if (data.notes !== undefined) {
        analysis.notes = data.notes;
      }
      if (data.relationshipGraph !== undefined) {
        analysis.relationshipGraph = data.relationshipGraph;
      }
    } else {
      // Create new analysis
      analysis = analysisRepository.create({
        sessionId,
        paperId,
        notes: data.notes || undefined,
        relationshipGraph: data.relationshipGraph || undefined,
      });
    }

    return await analysisRepository.save(analysis);
  }

  /**
   * Get all analyses for a session
   */
  async getSessionAnalyses(sessionId: string): Promise<Analysis[]> {
    const analysisRepository = AppDataSource.getRepository(Analysis);
    return await analysisRepository.find({
      where: { sessionId },
      relations: ['paper'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get analysis by ID
   */
  async getAnalysisById(analysisId: string): Promise<Analysis | null> {
    const analysisRepository = AppDataSource.getRepository(Analysis);
    return await analysisRepository.findOne({
      where: { id: analysisId },
      relations: ['paper', 'session'],
    });
  }

  /**
   * Delete analysis
   */
  async deleteAnalysis(analysisId: string): Promise<boolean> {
    const analysisRepository = AppDataSource.getRepository(Analysis);
    const result = await analysisRepository.delete({ id: analysisId });
    return (result.affected || 0) > 0;
  }
}

