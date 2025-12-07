import { AppDataSource } from '../config/database';
import { Paper } from '../entities/Paper';
import { Session } from '../entities/Session';
import { Analysis } from '../entities/Analysis';
import { PaperRelation } from '../entities/PaperRelation';

export interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    url?: string;
    [key: string]: any;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    label?: string;
    [key: string]: any;
  }>;
}

export interface PaperData {
  id?: string;
  title: string;
  authors: string[];
  abstract: string;
  introduction?: string;
  url: string;
  doi?: string;
  arxivId?: string;
  publishedDate?: string;
  tags: string[];
  fullText?: string;
}

export class AnalysisSaveService {
  /**
   * Upsert paper (create if not exists, update if exists based on URL)
   */
  async upsertPaper(paperData: PaperData): Promise<Paper> {
    const paperRepository = AppDataSource.getRepository(Paper);

    // Try to find existing paper by URL
    let paper = await paperRepository.findOne({
      where: { url: paperData.url },
    });

    if (paper) {
      // Update existing paper
      Object.assign(paper, {
        title: paperData.title,
        authors: paperData.authors,
        abstract: paperData.abstract,
        introduction: paperData.introduction,
        doi: paperData.doi,
        arxivId: paperData.arxivId,
        publishedDate: paperData.publishedDate,
        tags: paperData.tags,
        fullText: paperData.fullText,
      });
    } else {
      // Create new paper
      paper = paperRepository.create({
        title: paperData.title,
        authors: paperData.authors,
        abstract: paperData.abstract,
        introduction: paperData.introduction,
        url: paperData.url,
        doi: paperData.doi,
        arxivId: paperData.arxivId,
        publishedDate: paperData.publishedDate,
        tags: paperData.tags,
        fullText: paperData.fullText,
      });
    }

    return await paperRepository.save(paper);
  }

  /**
   * Save analysis result to database
   * Creates Session, saves Papers, creates Analysis records, and saves relationships
   */
  async saveAnalysis(
    userId: string,
    sessionTitle: string,
    papers: PaperData[],
    graphData: GraphData
  ): Promise<{ session: Session; analyses: Analysis[] }> {
    const sessionRepository = AppDataSource.getRepository(Session);
    const analysisRepository = AppDataSource.getRepository(Analysis);
    const paperRelationRepository = AppDataSource.getRepository(PaperRelation);

    // 1. Create Session
    const session = sessionRepository.create({
      userId,
      title: sessionTitle,
      description: `Analysis of ${papers.length} papers`,
    });
    const savedSession = await sessionRepository.save(session);

    // 2. Upsert all papers
    const savedPapers: Paper[] = [];
    const paperIdMap = new Map<string, string>(); // Map from original ID to database ID

    for (const paperData of papers) {
      const savedPaper = await this.upsertPaper(paperData);
      savedPapers.push(savedPaper);
      
      // Map original ID to database ID
      const originalId = paperData.id || savedPaper.id;
      paperIdMap.set(originalId, savedPaper.id);
    }

    // 3. Create Analysis records for each paper
    const analyses: Analysis[] = [];
    for (const savedPaper of savedPapers) {
      // Find corresponding node in graphData
      const node = graphData.nodes.find(n => {
        // Try to match by URL first
        if (n.url && n.url === savedPaper.url) return true;
        // Then try to match by ID
        const mappedId = paperIdMap.get(n.id);
        return mappedId === savedPaper.id;
      });

      // Get edges related to this paper
      const relatedEdges = graphData.edges.filter(
        e => e.from === node?.id || e.to === node?.id
      );

      // Create relationship graph for this paper
      const relationshipGraph = {
        nodes: graphData.nodes.map(n => {
          const mappedId = paperIdMap.get(n.id) || n.id;
          return {
            ...n,
            id: mappedId,
            label: n.label,
          };
        }),
        edges: relatedEdges.map(e => {
          const mappedFrom = paperIdMap.get(e.from) || e.from;
          const mappedTo = paperIdMap.get(e.to) || e.to;
          return {
            ...e,
            id: e.id,
            from: mappedFrom,
            to: mappedTo,
            label: e.label,
          };
        }),
      };

      const analysis = analysisRepository.create({
        sessionId: savedSession.id,
        paperId: savedPaper.id,
        relationshipGraph,
      });

      analyses.push(analysis);
    }

    const savedAnalyses = await analysisRepository.save(analyses);

    // 4. Save paper relationships (PaperRelation)
    const relationsToSave: PaperRelation[] = [];
    for (const edge of graphData.edges) {
      const fromPaperId = paperIdMap.get(edge.from);
      const toPaperId = paperIdMap.get(edge.to);

      if (fromPaperId && toPaperId) {
        const fromPaper = savedPapers.find(p => p.id === fromPaperId);
        const toPaper = savedPapers.find(p => p.id === toPaperId);

        if (fromPaper && toPaper) {
          // Check if relation already exists
          const existingRelation = await paperRelationRepository.findOne({
            where: {
              fromPaper: { id: fromPaperId },
              toPaper: { id: toPaperId },
            },
          });

          if (!existingRelation) {
            const relation = paperRelationRepository.create({
              fromPaper,
              toPaper,
              relationship: edge.label || 'related',
              description: edge.label || '',
              confidence: 1.0,
              weight: 1,
            });
            relationsToSave.push(relation);
          }
        }
      }
    }

    if (relationsToSave.length > 0) {
      await paperRelationRepository.save(relationsToSave);
    }

    return {
      session: savedSession,
      analyses: savedAnalyses,
    };
  }

  /**
   * Get full graph data for a session
   */
  async getSessionGraphData(sessionId: string): Promise<GraphData | null> {
    const analysisRepository = AppDataSource.getRepository(Analysis);
    const sessionRepository = AppDataSource.getRepository(Session);

    const session = await sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['analyses', 'analyses.paper'],
    });

    if (!session || !session.analyses || session.analyses.length === 0) {
      return null;
    }

    // Combine all relationship graphs from analyses
    const allNodes = new Map<string, any>();
    const allEdges = new Map<string, any>();

    for (const analysis of session.analyses) {
      if (analysis.relationshipGraph) {
        // Add nodes
        for (const node of analysis.relationshipGraph.nodes) {
          if (!allNodes.has(node.id)) {
            allNodes.set(node.id, node);
          }
        }

        // Add edges
        for (const edge of analysis.relationshipGraph.edges) {
          if (!allEdges.has(edge.id)) {
            allEdges.set(edge.id, edge);
          }
        }
      }
    }

    return {
      nodes: Array.from(allNodes.values()),
      edges: Array.from(allEdges.values()),
    };
  }
}

