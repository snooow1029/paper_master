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
   * Generate session title from source paper (original paper)
   */
  private generateSessionTitle(papers: PaperData[], originalPaperIds?: string[], graphData?: GraphData): string {
    // If originalPaperIds is provided, try to find the first original paper
    if (originalPaperIds && originalPaperIds.length > 0) {
      const firstOriginalId = originalPaperIds[0];
      console.log(`🔍 Looking for original paper with ID: ${firstOriginalId}`);
      
      // Try to find by ID first
      let firstOriginalPaper = papers.find(p => p.id === firstOriginalId);
      
      // If not found by ID, try to find by matching node in graphData
      if (!firstOriginalPaper && graphData) {
        const originalNode = graphData.nodes.find(n => n.id === firstOriginalId);
        if (originalNode && originalNode.url) {
          // Try to find paper by URL
          firstOriginalPaper = papers.find(p => p.url === originalNode.url);
          console.log(`🔍 Found original paper by URL: ${originalNode.url}`);
        }
      }
      
      if (firstOriginalPaper && firstOriginalPaper.title) {
        const title = firstOriginalPaper.title;
        console.log(`✅ Using original paper title: "${title}"`);
        return title.length > 60 ? title.substring(0, 60) + '...' : title;
      } else {
        console.log(`⚠️ Could not find original paper with ID ${firstOriginalId}, falling back to first paper`);
      }
    }
    
    // Fallback: use first paper title
    if (papers.length > 0 && papers[0].title) {
      const title = papers[0].title;
      console.log(`📝 Using first paper title: "${title}"`);
      return title.length > 60 ? title.substring(0, 60) + '...' : title;
    }
    
    return `Analysis of ${papers.length} papers`;
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
      // Ensure arrays are initialized (not undefined)
      authors: Array.isArray(node.authors) ? node.authors : [],
      tags: Array.isArray(node.tags) ? node.tags : [],
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
    graphData: GraphData,
    originalPapers?: {
      urls?: string[];
      priorWorks?: Record<string, any[]>;
      derivativeWorks?: Record<string, any[]>;
    }
  ): Promise<{ session: Session; analyses: Analysis[] }> {
    console.log(`\n🔵 ========== SAVE ANALYSIS START ==========`);
    console.log(`📥 Input graphData: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
    console.log(`📥 Input edges sample (first 3):`, graphData.edges.slice(0, 3).map(e => {
      const edgeAny = e as any;
      return {
        id: e.id,
        from: edgeAny.from || edgeAny.source,
        to: edgeAny.to || edgeAny.target,
        label: e.label || e.relationship
      };
    }));
    
    // Get originalPapers from graphData if available
    const originalPaperIds = (graphData as any).originalPapers;
    console.log(`📥 Original papers: ${originalPaperIds ? originalPaperIds.length : 0} papers`);
    if (originalPaperIds && originalPaperIds.length > 0) {
      console.log(`📥 Original paper IDs:`, originalPaperIds);
    }
    
    // Use provided title or generate from source paper (original paper)
    const finalTitle = sessionTitle || this.generateSessionTitle(papers, originalPaperIds, graphData);
    console.log(`📝 Generated session title: "${finalTitle}"`);
    const sessionRepository = AppDataSource.getRepository(Session);
    const analysisRepository = AppDataSource.getRepository(Analysis);
    const paperRelationRepository = AppDataSource.getRepository(PaperRelation);

    // 1. Create Session with graphSnapshot (Snapshot Layer)
    // Normalize graphData to ensure edges use 'from/to' format before saving
    const normalizedGraphData = this.normalizeGraphData(graphData);
    console.log(`🔄 After normalization: ${normalizedGraphData.nodes.length} nodes, ${normalizedGraphData.edges.length} edges`);
    console.log(`🔄 Normalized edges sample (first 3):`, normalizedGraphData.edges.slice(0, 3).map(e => ({
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.label
    })));
    const sessionData: Partial<Session> = {
      userId,
      title: finalTitle,
      description: `Analysis of ${papers.length} papers`,
      graphSnapshot: JSON.stringify(normalizedGraphData), // Save normalized graphData for instant UI restoration
      priorWorksSnapshot: originalPapers?.priorWorks ? JSON.stringify(originalPapers.priorWorks) : undefined,
      derivativeWorksSnapshot: originalPapers?.derivativeWorks ? JSON.stringify(originalPapers.derivativeWorks) : undefined,
    };
    const session = sessionRepository.create(sessionData);
    const savedSession = await sessionRepository.save(session);
    console.log(`💾 Saved graphSnapshot to Session ${savedSession.id} with ${normalizedGraphData.nodes.length} nodes and ${normalizedGraphData.edges.length} edges`);
    if (originalPapers?.priorWorks) {
      const priorWorksCount = Object.values(originalPapers.priorWorks).flat().length;
      console.log(`💾 Saved priorWorksSnapshot with ${priorWorksCount} prior works across ${Object.keys(originalPapers.priorWorks).length} papers`);
    }
    if (originalPapers?.derivativeWorks) {
      const derivativeWorksCount = Object.values(originalPapers.derivativeWorks).flat().length;
      console.log(`💾 Saved derivativeWorksSnapshot with ${derivativeWorksCount} derivative works across ${Object.keys(originalPapers.derivativeWorks).length} papers`);
    }

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

      // IMPORTANT: Save complete graph (all nodes and all edges) for each Analysis
      // This ensures consistency when reading back - each Analysis has the full context
      // The original design saved only relatedEdges, but this causes issues when merging
      console.log(`📊 Paper ${savedPaper.id}: Saving complete graph with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);

      // Create relationship graph with ALL nodes and ALL edges (not just related ones)
      const relationshipGraph = {
        nodes: graphData.nodes.map(n => {
          const mappedId = paperIdMap.get(n.id) || n.id;
          return {
            ...n,
            id: mappedId,
            label: n.label,
          };
        }),
        edges: graphData.edges.map(e => {
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

      console.log(`  📦 Analysis for paper ${savedPaper.id}: relationshipGraph has ${relationshipGraph.nodes.length} nodes, ${relationshipGraph.edges.length} edges`);
      if (relationshipGraph.edges.length > 0) {
        console.log(`  📦 Edges sample:`, relationshipGraph.edges.slice(0, 2).map(e => ({
          id: e.id,
          from: e.from,
          to: e.to,
          label: e.label
        })));
      }

      const analysis = analysisRepository.create({
        sessionId: savedSession.id,
        paperId: savedPaper.id,
        relationshipGraph,
      });

      analyses.push(analysis);
    }

    console.log(`💾 Saving ${analyses.length} Analysis records...`);
    const savedAnalyses = await analysisRepository.save(analyses);
    console.log(`✅ Saved ${savedAnalyses.length} Analysis records`);
    
    // Verify saved data
    for (const analysis of savedAnalyses.slice(0, 2)) {
      if (analysis.relationshipGraph && analysis.relationshipGraph.edges) {
        console.log(`  ✅ Verified Analysis ${analysis.id}: ${analysis.relationshipGraph.edges.length} edges in DB`);
      }
    }

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
    
    console.log(`🔵 ========== SAVE ANALYSIS END ==========`);
    console.log(`📤 Returning: Session ${savedSession.id} with ${savedAnalyses.length} analyses`);

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
  async getSessionGraphData(sessionId: string, userId?: string): Promise<GraphData | null> {
    console.log(`\n🟢 ========== GET SESSION GRAPH DATA START ==========`);
    console.log(`📥 Loading session: ${sessionId}`);
    
    const sessionRepository = AppDataSource.getRepository(Session);

    // 1. 讀取 Session
    const session = await sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['analyses', 'analyses.paper'],
    });

    if (!session) {
      console.log(`❌ Session not found`);
      return null;
    }

    // =========== 優先讀取 Snapshot ===========
    // 如果有 graphSnapshot (代表這是使用者編輯過或儲存過的畫面)，直接回傳這個 JSON
    if (session.graphSnapshot) {
      try {
        console.log(`💾 Found graphSnapshot, returning saved UI state directly.`);
        const snapshotData = JSON.parse(session.graphSnapshot);
        
        // 建議再次 Normalize 確保 ID 格式統一 (全部轉字串)
        const normalizedSnapshot = this.normalizeGraphData(snapshotData);
        
        // 讀取 prior works 和 derivative works
        let priorWorks: Record<string, any[]> = {};
        let derivativeWorks: Record<string, any[]> = {};
        
        if (session.priorWorksSnapshot) {
          try {
            priorWorks = JSON.parse(session.priorWorksSnapshot);
            console.log(`📚 Found priorWorksSnapshot with ${Object.keys(priorWorks).length} papers, ${Object.values(priorWorks).flat().length} total prior works`);
          } catch (error) {
            console.error('Error parsing priorWorksSnapshot:', error);
          }
        }
        
        if (session.derivativeWorksSnapshot) {
          try {
            derivativeWorks = JSON.parse(session.derivativeWorksSnapshot);
            console.log(`📚 Found derivativeWorksSnapshot with ${Object.keys(derivativeWorks).length} papers, ${Object.values(derivativeWorks).flat().length} total derivative works`);
          } catch (error) {
            console.error('Error parsing derivativeWorksSnapshot:', error);
          }
        }
        
        // 將 prior works 和 derivative works 附加到返回的數據中
        // 确保返回的数据包含 priorWorks 和 derivativeWorks
        const result: any = normalizedSnapshot;
        result.priorWorks = priorWorks;
        result.derivativeWorks = derivativeWorks;
        result.originalPapers = {
          urls: Object.keys(priorWorks).length > 0 ? Object.keys(priorWorks) : Object.keys(derivativeWorks),
          priorWorks: priorWorks,
          derivativeWorks: derivativeWorks
        };
        
        console.log(`📥 Returning snapshot: ${normalizedSnapshot.nodes.length} nodes, ${normalizedSnapshot.edges.length} edges`);
        if (normalizedSnapshot.edges.length > 0) {
          console.log(`📥 Snapshot edges sample (first 3):`, normalizedSnapshot.edges.slice(0, 3).map((e: any) => ({
            id: e.id,
            from: e.from,
            to: e.to,
            label: e.label
          })));
        }
        console.log(`✅ Returning graphData with priorWorks (${Object.values(priorWorks).flat().length} items) and derivativeWorks (${Object.values(derivativeWorks).flat().length} items)`);
        console.log(`🟢 ========== GET SESSION GRAPH DATA END ==========\n`);
        return result;
      } catch (error) {
        console.error("❌ Error parsing graphSnapshot, falling back to analysis merging:", error);
        // 如果 JSON 解析失敗，才執行下面的 Fallback 邏輯
      }
    }
    // =========== Snapshot 讀取結束 ===========

    // --- 下面是原本的 Fallback 邏輯 (只有當 graphSnapshot 不存在時才會執行) ---
    
    if (!session.analyses || session.analyses.length === 0) {
      console.log(`❌ Session has no analyses and no snapshot`);
      return null;
    }

    console.log(`📊 Found session with ${session.analyses.length} analyses (Using legacy merge)`);
    
    const analysisRepository = AppDataSource.getRepository(Analysis);

    // Combine all relationship graphs from analyses
    // Since all analyses should have the same complete graph, we can use the first one
    // But we'll still merge to be safe
    const allNodes = new Map<string, any>();
    const allEdges = new Map<string, any>();

    console.log(`📊 Merging ${session.analyses.length} analyses for session ${sessionId}`);
    
    for (const analysis of session.analyses) {
      if (analysis.relationshipGraph) {
        console.log(`  📦 Analysis ${analysis.id} (paperId: ${analysis.paperId}):`);
        console.log(`     - relationshipGraph exists: true`);
        
        // Add nodes
        if (analysis.relationshipGraph.nodes) {
          console.log(`     - nodes: ${analysis.relationshipGraph.nodes.length}`);
          for (const node of analysis.relationshipGraph.nodes) {
            if (!allNodes.has(node.id)) {
              allNodes.set(node.id, node);
            }
          }
        } else {
          console.log(`     - nodes: null or undefined`);
        }

        // Add edges
        if (analysis.relationshipGraph.edges) {
          console.log(`     - edges: ${analysis.relationshipGraph.edges.length}`);
          if (analysis.relationshipGraph.edges.length > 0) {
            console.log(`     - edges sample (first 2):`, analysis.relationshipGraph.edges.slice(0, 2).map((e: any) => ({
              id: e.id,
              from: e.from || e.source,
              to: e.to || e.target,
              label: e.label
            })));
          }
          
          for (const edge of analysis.relationshipGraph.edges) {
            // Ensure edge has an ID for deduplication
            const edgeAny = edge as any;
            const fromId = edgeAny.from || edgeAny.source;
            const toId = edgeAny.to || edgeAny.target;
            const edgeId = edgeAny.id || `edge-${fromId}-${toId}`;
            
            if (!allEdges.has(edgeId)) {
              allEdges.set(edgeId, {
                ...edge,
                id: edgeId,
                // Ensure both from/to and source/target formats exist
                from: fromId,
                to: toId,
                source: fromId,
                target: toId,
              });
            } else {
              console.log(`     ⚠️ Skipping duplicate edge: ${edgeId}`);
            }
          }
        } else {
          console.log(`     - edges: null or undefined`);
        }
      } else {
        console.log(`  ❌ Analysis ${analysis.id}: No relationshipGraph`);
      }
    }
    
    console.log(`📊 Merged result: ${allNodes.size} unique nodes, ${allEdges.size} unique edges`);
    if (allEdges.size > 0) {
      console.log(`📊 Merged edges sample (first 3):`, Array.from(allEdges.values()).slice(0, 3).map((e: any) => ({
        id: e.id,
        from: e.from || e.source,
        to: e.to || e.target,
        label: e.label
      })));
    }

    const result = {
      nodes: Array.from(allNodes.values()),
      edges: Array.from(allEdges.values()),
    };

    console.log(`📥 Final result: ${result.nodes.length} nodes, ${result.edges.length} edges`);
    console.log(`🟢 ========== GET SESSION GRAPH DATA END ==========\n`);

    return result;
  }

  /**
   * Update graph data for an existing session
   */
  async updateSessionGraph(
    sessionId: string,
    userId: string,
    graphData: GraphData,
    originalPapers?: {
      urls?: string[];
      priorWorks?: Record<string, any[]>;
      derivativeWorks?: Record<string, any[]>;
    }
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

    // 建議加入這行：先正規化再儲存
    const normalizedData = this.normalizeGraphData(graphData);
    console.log(`🔄 Normalized graphData before saving: ${normalizedData.nodes.length} nodes, ${normalizedData.edges.length} edges`);

    // Update graphSnapshot in Session (Snapshot Layer)
    session.graphSnapshot = JSON.stringify(normalizedData); // 使用 normalizedData
    
    // Update prior works and derivative works if provided
    if (originalPapers?.priorWorks) {
      session.priorWorksSnapshot = JSON.stringify(originalPapers.priorWorks);
      const priorWorksCount = Object.values(originalPapers.priorWorks).flat().length;
      console.log(`💾 Updated priorWorksSnapshot with ${priorWorksCount} prior works`);
    }
    
    if (originalPapers?.derivativeWorks) {
      session.derivativeWorksSnapshot = JSON.stringify(originalPapers.derivativeWorks);
      const derivativeWorksCount = Object.values(originalPapers.derivativeWorks).flat().length;
      console.log(`💾 Updated derivativeWorksSnapshot with ${derivativeWorksCount} derivative works`);
    }
    
    await sessionRepository.save(session);
    console.log(`💾 Updated graphSnapshot in Session ${sessionId}`);

    // Get existing papers from session
    const existingPapers = session.analyses.map(a => a.paper);
    const paperIdMap = new Map<string, string>();
    existingPapers.forEach(paper => {
      paperIdMap.set(paper.id, paper.id);
    });

    console.log(`📊 Existing papers in session: ${existingPapers.length}`);
    console.log(`📊 NormalizedData to save: ${normalizedData.nodes.length} nodes, ${normalizedData.edges.length} edges`);
    
    // IMPORTANT: 保留完整的 graph 数据，不要过滤
    // Graph 中可能包含很多 nodes（包括引用关系中的论文），这些都应该保留
    // 只过滤掉确实被用户删除的 nodes（如果有删除标记的话）
    // 目前我们直接使用完整的 normalizedData，不做过滤
    const relationshipGraph = {
      nodes: normalizedData.nodes.map(n => ({
        ...n,
        id: n.id, // 保留原始 ID
        label: n.label || '',
      })),
      edges: normalizedData.edges.map(e => {
        // Support both 'from/to' and 'source/target' formats
        const edgeAny = e as any;
        const fromId = edgeAny.from || (typeof edgeAny.source === 'string' ? edgeAny.source : (edgeAny.source as any)?.id);
        const toId = edgeAny.to || (typeof edgeAny.target === 'string' ? edgeAny.target : (edgeAny.target as any)?.id);
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

    console.log(`💾 Updating session ${sessionId} with ${relationshipGraph.nodes.length} nodes and ${relationshipGraph.edges.length} edges`);
    console.log(`📊 RelationshipGraph edges sample:`, relationshipGraph.edges.slice(0, 3).map(e => {
      const edgeAny = e as any;
      return {
        id: e.id,
        from: edgeAny.from || edgeAny.source,
        to: edgeAny.to || edgeAny.target,
        label: e.label
      };
    }));

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
        // console.log(`  Updating Analysis ${analysis.id} for paper ${paper.id} with ${relationshipGraph.edges.length} edges`);
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

    // Then, create new relations from normalizedData edges (only for edges between existing papers)
    const relationsToSave: PaperRelation[] = [];
    for (const edge of normalizedData.edges) {
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
    await this.buildKnowledgeGraph(normalizedData, existingPapers, paperIdMap);
    console.log(`✅ Updated knowledge graph`);

    // Note: Don't update updatedAt here - we want to preserve the original createdAt
    // updatedAt will be automatically updated by TypeORM's @UpdateDateColumn
    // But we explicitly don't want to change it manually to preserve the original analysis time
    await sessionRepository.save(session);

    return {
      session,
      analyses: savedAnalyses,
    };
  }
}

