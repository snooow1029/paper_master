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
   * Generate session title from first paper
   */
  private generateSessionTitle(papers: PaperData[]): string {
    if (papers.length > 0 && papers[0].title) {
      // Use first paper title, truncate if too long
      const title = papers[0].title;
      return title.length > 60 ? title.substring(0, 60) + '...' : title;
    }
    return `Analysis of ${papers.length} papers - ${new Date().toLocaleDateString()}`;
  }

  /**
   * Normalize graphData to ensure consistent format (from/to instead of source/target)
   * This ensures edges are always in the correct format for storage and retrieval
   */
  private normalizeGraphData(graphData: GraphData): GraphData {
    const normalizedNodes = (graphData.nodes || []).map(node => ({
      ...node,
      id: String(node.id || node.url || `node-${Math.random()}`),
      label: String(node.label || node.title || ''),
    }));

    const normalizedEdges = (graphData.edges || []).map((edge, index) => {
      // Support both 'from/to' and 'source/target' formats
      const fromId = edge.from || (typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id);
      const toId = edge.to || (typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id);
      
      const fromIdStr = typeof fromId === 'string' 
        ? fromId 
        : (fromId?.id ? String(fromId.id) : String(fromId));
      const toIdStr = typeof toId === 'string' 
        ? toId 
        : (toId?.id ? String(toId.id) : String(toId));

      return {
        ...edge,
        id: String(edge.id || `edge-${fromIdStr}-${toIdStr}-${index}`),
        from: fromIdStr,
        to: toIdStr,
        label: edge.label || edge.relationship || '',
      };
    });

    console.log(`🔄 Normalized graphData: ${normalizedNodes.length} nodes, ${normalizedEdges.length} edges`);

    const result: GraphData = {
      nodes: normalizedNodes,
      edges: normalizedEdges,
    };
    
    // Add originalPapers if it exists (it's not part of GraphData interface but may be present)
    if ((graphData as any).originalPapers) {
      (result as any).originalPapers = (graphData as any).originalPapers.map((id: any) => String(id));
    }
    
    return result;
  }

  /**
   * Save analysis result to database
   * Creates Session, saves Papers, creates Analysis records, and saves relationships
   */
  async saveAnalysis(
    userId: string,
    sessionTitle: string | undefined,
    papers: PaperData[],
    graphData: GraphData
  ): Promise<{ session: Session; analyses: Analysis[] }> {
    // Use provided title or generate from first paper
    const finalTitle = sessionTitle || this.generateSessionTitle(papers);
    const sessionRepository = AppDataSource.getRepository(Session);
    const analysisRepository = AppDataSource.getRepository(Analysis);
    const paperRelationRepository = AppDataSource.getRepository(PaperRelation);

    // 1. Create Session with graphSnapshot (Snapshot Layer)
    // Normalize graphData to ensure edges use 'from/to' format before saving
    const normalizedGraphData = this.normalizeGraphData(graphData);
    const session = sessionRepository.create({
      userId,
      title: finalTitle,
      description: `Analysis of ${papers.length} papers`,
      graphSnapshot: JSON.stringify(normalizedGraphData), // Save normalized graphData for instant UI restoration
    });
    const savedSession = await sessionRepository.save(session);
    console.log(`💾 Saved graphSnapshot to Session ${savedSession.id} with ${normalizedGraphData.nodes.length} nodes and ${normalizedGraphData.edges.length} edges`);

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

      if (!node) {
        console.warn(`⚠️ Could not find node for paper ${savedPaper.id} (${savedPaper.title})`);
        continue;
      }

      // Get edges related to this paper
      // Support both 'from/to' and 'source/target' formats
      const nodeId = node.id;
      const relatedEdges = graphData.edges.filter(e => {
        const edgeAny = e as any;
        const fromId = edgeAny.from || (typeof e.source === 'string' ? e.source : (e.source as any)?.id);
        const toId = edgeAny.to || (typeof e.target === 'string' ? e.target : (e.target as any)?.id);
        return fromId === nodeId || toId === nodeId;
      });
      
      console.log(`📊 Paper ${savedPaper.id}: Found ${relatedEdges.length} related edges out of ${graphData.edges.length} total edges`);

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
          // Support both 'from/to' and 'source/target' formats
          const edgeAny = e as any;
          const fromId = edgeAny.from || (typeof e.source === 'string' ? e.source : (e.source as any)?.id);
          const toId = edgeAny.to || (typeof e.target === 'string' ? e.target : (e.target as any)?.id);
          const mappedFrom = paperIdMap.get(fromId) || fromId;
          const mappedTo = paperIdMap.get(toId) || toId;
          return {
            ...e,
            id: e.id || `edge-${mappedFrom}-${mappedTo}`,
            from: mappedFrom,
            to: mappedTo,
            source: mappedFrom, // Also include source/target for compatibility
            target: mappedTo,
            label: e.label || e.relationship || '',
            // 明確保留 LLM 分析的關係信息
            relationship: e.relationship,
            strength: e.strength,
            evidence: e.evidence,
            description: e.description,
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
    console.log(`💾 Saving ${graphData.edges.length} edges as PaperRelation`);
    for (const edge of graphData.edges) {
      // Support both 'from/to' and 'source/target' formats
      const fromId = edge.from || (typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id);
      const toId = edge.to || (typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id);
      
      const fromPaperId = paperIdMap.get(fromId);
      const toPaperId = paperIdMap.get(toId);

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
              relationship: edge.label || edge.relationship || 'related',
              description: edge.description || edge.label || edge.relationship || '',
              evidence: edge.evidence || '', // 保存 LLM 分析的證據
              confidence: edge.strength !== undefined ? edge.strength : 1.0, // 使用 LLM 分析的強度作為置信度
              weight: edge.weight || 1,
            });
            relationsToSave.push(relation);
          }
        } else {
          console.warn(`⚠️ Could not find papers for edge: ${fromId} -> ${toId}`);
        }
      } else {
        console.warn(`⚠️ Could not map edge IDs: ${fromId} -> ${toId} (fromPaperId: ${fromPaperId}, toPaperId: ${toPaperId})`);
        console.warn(`   Edge data:`, JSON.stringify(edge, null, 2));
      }
    }

    if (relationsToSave.length > 0) {
      await paperRelationRepository.save(relationsToSave);
      console.log(`✅ Saved ${relationsToSave.length} paper relations`);
    } else {
      console.warn(`⚠️ No paper relations to save (${graphData.edges.length} edges processed)`);
    }

    // 5. Build Knowledge Graph Layer (Many-to-Many relationships)
    await this.buildKnowledgeGraph(graphData, savedPapers, paperIdMap);
    console.log(`✅ Built knowledge graph with ${savedPapers.length} papers`);

    return {
      session: savedSession,
      analyses: savedAnalyses,
    };
  }

  /**
   * Build Knowledge Graph Layer: Create Many-to-Many relationships between Papers
   */
  private async buildKnowledgeGraph(
    graphData: GraphData,
    savedPapers: Paper[],
    paperIdMap: Map<string, string>
  ): Promise<void> {
    const paperRepository = AppDataSource.getRepository(Paper);

    // Create a Map for quick lookup: database ID -> Paper entity
    const paperMap = new Map<string, Paper>();
    savedPapers.forEach(paper => {
      paperMap.set(paper.id, paper);
    });

    // Process edges to build citation relationships
    for (const edge of graphData.edges) {
      // Support both 'from/to' and 'source/target' formats
      const fromId = edge.from || (typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id);
      const toId = edge.to || (typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id);
      
      const sourcePaperId = paperIdMap.get(fromId);
      const targetPaperId = paperIdMap.get(toId);

      if (sourcePaperId && targetPaperId) {
        const sourcePaper = paperMap.get(sourcePaperId);
        const targetPaper = paperMap.get(targetPaperId);

        if (sourcePaper && targetPaper && sourcePaper.id !== targetPaper.id) {
          // Load sourcePaper with its references relation
          const paperWithRelations = await paperRepository.findOne({
            where: { id: sourcePaper.id },
            relations: ['references'],
          });

          if (paperWithRelations) {
            // Check if relationship already exists
            const alreadyReferences = paperWithRelations.references?.some(
              ref => ref.id === targetPaper.id
            );

            if (!alreadyReferences) {
              // Add targetPaper to sourcePaper's references
              if (!paperWithRelations.references) {
                paperWithRelations.references = [];
              }
              paperWithRelations.references.push(targetPaper);
              await paperRepository.save(paperWithRelations);
            }
          }
        }
      }
    }
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
    // Since all analyses should have the same complete graph, we can use the first one
    // But we'll still merge to be safe
    const allNodes = new Map<string, any>();
    const allEdges = new Map<string, any>();

    console.log(`📊 Merging ${session.analyses.length} analyses for session ${sessionId}`);
    
    for (const analysis of session.analyses) {
      if (analysis.relationshipGraph) {
        // Add nodes
        if (analysis.relationshipGraph.nodes) {
          console.log(`  Analysis ${analysis.id}: ${analysis.relationshipGraph.nodes.length} nodes`);
          for (const node of analysis.relationshipGraph.nodes) {
            if (!allNodes.has(node.id)) {
              allNodes.set(node.id, node);
            }
          }
        }

        // Add edges
        if (analysis.relationshipGraph.edges) {
          console.log(`  Analysis ${analysis.id}: ${analysis.relationshipGraph.edges.length} edges`);
          for (const edge of analysis.relationshipGraph.edges) {
            // Ensure edge has an ID for deduplication
            const edgeAny = edge as any;
            const edgeId = edgeAny.id || `edge-${edgeAny.from || edgeAny.source}-${edgeAny.to || edgeAny.target}`;
            if (!allEdges.has(edgeId)) {
              allEdges.set(edgeId, {
                ...edge,
                id: edgeId,
                // Ensure both from/to and source/target formats exist
                from: edgeAny.from || edgeAny.source,
                to: edgeAny.to || edgeAny.target,
                source: edgeAny.source || edgeAny.from,
                target: edgeAny.target || edgeAny.to,
              });
            } else {
              console.log(`    Skipping duplicate edge: ${edgeId}`);
            }
          }
        } else {
          console.log(`  Analysis ${analysis.id}: No edges in relationshipGraph`);
        }
      } else {
        console.log(`  Analysis ${analysis.id}: No relationshipGraph`);
      }
    }
    
    console.log(`📊 Merged result: ${allNodes.size} unique nodes, ${allEdges.size} unique edges`);

    const result = {
      nodes: Array.from(allNodes.values()),
      edges: Array.from(allEdges.values()),
    };

    console.log(`📥 Loading session ${sessionId}: ${result.nodes.length} nodes, ${result.edges.length} edges`);

    return result;
  }

  /**
   * Update graph data for an existing session
   */
  async updateSessionGraph(
    sessionId: string,
    userId: string,
    graphData: GraphData
  ): Promise<{ session: Session; analyses: Analysis[] }> {
    const sessionRepository = AppDataSource.getRepository(Session);
    const analysisRepository = AppDataSource.getRepository(Analysis);
    const paperRelationRepository = AppDataSource.getRepository(PaperRelation);

    // Verify session belongs to user
    const session = await sessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ['analyses', 'analyses.paper'],
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Update graphSnapshot in Session (Snapshot Layer)
    session.graphSnapshot = JSON.stringify(graphData);
    await sessionRepository.save(session);
    console.log(`💾 Updated graphSnapshot in Session ${sessionId}`);

    // Get existing papers from session
    const existingPapers = session.analyses.map(a => a.paper);
    const paperIdMap = new Map<string, string>();
    existingPapers.forEach(paper => {
      paperIdMap.set(paper.id, paper.id);
    });

    // Create a single relationship graph with ALL nodes and edges
    // This ensures we preserve the complete graph structure
    const relationshipGraph = {
      nodes: graphData.nodes.map(n => ({
        ...n,
        id: paperIdMap.get(n.id) || n.id,
        label: n.label || '',
      })),
      edges: graphData.edges.map(e => {
        // Support both 'from/to' and 'source/target' formats
        const fromId = e.from || (typeof e.source === 'string' ? e.source : (e.source as any)?.id);
        const toId = e.to || (typeof e.target === 'string' ? e.target : (e.target as any)?.id);
        const mappedFrom = paperIdMap.get(fromId) || fromId;
        const mappedTo = paperIdMap.get(toId) || toId;
        return {
          ...e,
          id: e.id || `${mappedFrom}-${mappedTo}`,
          from: mappedFrom,
          to: mappedTo,
          label: e.label || e.relationship || '',
          // 明確保留 LLM 分析的關係信息
          relationship: e.relationship,
          strength: e.strength,
          evidence: e.evidence,
          description: e.description,
        };
      }),
    };

    console.log(`💾 Updating session ${sessionId} with ${relationshipGraph.nodes.length} nodes and ${relationshipGraph.edges.length} edges`);
    console.log(`📊 RelationshipGraph edges sample:`, relationshipGraph.edges.slice(0, 3).map(e => ({
      id: e.id,
      from: e.from || e.source,
      to: e.to || e.target,
      label: e.label
    })));

    // Update all Analysis records with the complete graph data
    const updatedAnalyses: Analysis[] = [];

    for (const paper of existingPapers) {
      // Find or create Analysis record
      let analysis = await analysisRepository.findOne({
        where: { sessionId, paperId: paper.id },
      });

      if (analysis) {
        // Update existing analysis with complete graph
        analysis.relationshipGraph = relationshipGraph;
        console.log(`  Updating Analysis ${analysis.id} for paper ${paper.id} with ${relationshipGraph.edges.length} edges`);
      } else {
        // Create new analysis with complete graph
        analysis = analysisRepository.create({
          sessionId,
          paperId: paper.id,
          relationshipGraph,
        });
        console.log(`  Creating new Analysis for paper ${paper.id} with ${relationshipGraph.edges.length} edges`);
      }

      updatedAnalyses.push(analysis);
    }

    const savedAnalyses = await analysisRepository.save(updatedAnalyses);
    console.log(`✅ Saved ${savedAnalyses.length} Analysis records`);

    // Update PaperRelation records
    // First, delete existing relations for papers in this session
    const paperIds = existingPapers.map(p => p.id);
    await paperRelationRepository
      .createQueryBuilder()
      .delete()
      .where('fromPaperId IN (:...paperIds) OR toPaperId IN (:...paperIds)', { paperIds })
      .execute();

    // Then, create new relations from graphData edges
    const relationsToSave: PaperRelation[] = [];
    for (const edge of graphData.edges) {
      // Support both 'from/to' and 'source/target' formats
      const fromId = edge.from || (typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id);
      const toId = edge.to || (typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id);
      
      const fromPaperId = paperIdMap.get(fromId);
      const toPaperId = paperIdMap.get(toId);

      if (fromPaperId && toPaperId) {
        const fromPaper = existingPapers.find(p => p.id === fromPaperId);
        const toPaper = existingPapers.find(p => p.id === toPaperId);

        if (fromPaper && toPaper) {
          const relation = paperRelationRepository.create({
            fromPaper,
            toPaper,
            relationship: edge.label || edge.relationship || 'related',
            description: edge.description || edge.label || edge.relationship || '',
            evidence: edge.evidence || '', // 保存 LLM 分析的證據
            confidence: edge.strength !== undefined ? edge.strength : 1.0, // 使用 LLM 分析的強度作為置信度
            weight: edge.weight || 1,
          });
          relationsToSave.push(relation);
        }
      }
    }

    if (relationsToSave.length > 0) {
      await paperRelationRepository.save(relationsToSave);
      console.log(`💾 Saved ${relationsToSave.length} paper relations`);
    }

    // Build Knowledge Graph Layer (Many-to-Many relationships)
    await this.buildKnowledgeGraph(graphData, existingPapers, paperIdMap);
    console.log(`✅ Updated knowledge graph`);

    // Update session timestamp
    session.updatedAt = new Date();
    await sessionRepository.save(session);

    return {
      session,
      analyses: savedAnalyses,
    };
  }
}

