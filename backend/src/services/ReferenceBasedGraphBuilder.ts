/**
 * Reference-Based Graph Builder
 * 基于引用列表的图构建器
 * 
 * 新流程：
 * 1. 从论文的 reference 列表提取所有被引用的论文
 * 2. 建立基本的引用关系图（节点和边）
 * 3. 对于每个引用关系，在原文中找到引用段落
 * 4. 使用 LLM 分析引用段落，确定关系类型和强度
 */

import { AdvancedCitationService } from './AdvancedCitationService';
import { PaperRelationshipAnalyzer, PaperMetadata, PaperGraph, RelationshipEdge } from './PaperRelationshipAnalyzer';
import { PaperService } from './PaperService';
import { SemanticScholarService } from './SemanticScholarService';

export interface ReferenceBasedGraphResult {
  success: boolean;
  graph?: PaperGraph;
  papers?: PaperMetadata[];
  error?: string;
  stats?: {
    totalPapers: number;
    totalReferences: number;
    analyzedRelations: number;
    processingTime: number;
  };
}

export class ReferenceBasedGraphBuilder {
  private grobidService: AdvancedCitationService;
  private relationshipAnalyzer: PaperRelationshipAnalyzer;
  private paperService: PaperService;

  constructor() {
    this.grobidService = new AdvancedCitationService();
    this.relationshipAnalyzer = new PaperRelationshipAnalyzer();
    this.paperService = new PaperService();
  }

  /**
   * 从多篇论文批量构建引用关系图
   */
  async buildGraphFromPapers(paperUrls: string[]): Promise<ReferenceBasedGraphResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n=== Building Reference-Based Graph from ${paperUrls.length} Papers ===`);

      const allNodes: PaperGraph['nodes'] = [];
      const allEdges: RelationshipEdge[] = [];
      const processedPapers: PaperMetadata[] = [];

      // 处理每篇论文
      for (let i = 0; i < paperUrls.length; i++) {
        const url = paperUrls[i];
        console.log(`\n📄 Processing paper ${i + 1}/${paperUrls.length}: ${url}`);
        
        const result = await this.buildGraphFromPaper(url);
        
        if (result.success && result.graph) {
          // 合并节点（去重）
          for (const node of result.graph.nodes) {
            const existing = allNodes.find(n => 
              n.id === node.id || this.isSimilarTitle(n.title, node.title)
            );
            if (!existing) {
              allNodes.push(node);
            }
          }

          // 合并边
          allEdges.push(...result.graph.edges);
          
          // 保存源论文
          if (result.papers && result.papers.length > 0) {
            processedPapers.push(result.papers[0]);
          }
        } else {
          console.error(`❌ Failed to process paper ${i + 1}: ${result.error}`);
        }
      }

      const finalGraph: PaperGraph = {
        nodes: allNodes,
        edges: allEdges
      };

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        graph: finalGraph,
        papers: processedPapers,
        stats: {
          totalPapers: allNodes.length,
          totalReferences: allEdges.length,
          analyzedRelations: allEdges.length,
          processingTime
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Batch graph building failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 从单篇论文构建引用关系图（新流程）
   */
  async buildGraphFromPaper(paperUrl: string): Promise<ReferenceBasedGraphResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n=== Building Reference-Based Graph from Paper ===`);
      console.log(`Input URL: ${paperUrl}`);

      // Step 1: 使用 GROBID 提取论文信息和 reference 列表
      console.log('\n--- Step 1: Extracting Paper and References ---');
      const citationResult = await this.grobidService.extractCitationsWithContextFiltered(paperUrl);
      
      if (!citationResult.success) {
        return {
          success: false,
          error: `Failed to extract citations: ${citationResult.error}`
        };
      }

      // 创建源论文节点
      const sourcePaper: PaperMetadata = {
        id: this.generatePaperId(paperUrl),
        title: citationResult.paperTitle || 'Unknown Title',
        authors: citationResult.paperAuthors || [],
        year: citationResult.paperYear || 'Unknown',
        abstract: citationResult.paperAbstract || '',
        venue: citationResult.paperVenue,
        citationCount: citationResult.paperCitationCount,
        paperCitationCount: citationResult.paperCitationCount,
        citations: citationResult.citations
      };

      console.log(`✅ Extracted source paper: "${sourcePaper.title}"`);
      console.log(`📚 Found ${citationResult.citations.length} references in bibliography`);

      // Step 2: 从 reference 列表建立基本图结构（支持外部 API 增强）
      console.log('\n--- Step 2: Building Basic Graph from References ---');
      const enrichWithApi = process.env.ENRICH_CITATIONS !== 'false'; // 默认启用
      const { nodes, referenceEdges } = await this.buildBasicGraphFromReferences(
        sourcePaper,
        citationResult.citations,
        enrichWithApi
      );

      console.log(`✅ Created graph with ${nodes.length} nodes and ${referenceEdges.length} reference edges`);

      // Step 3: 对于每个引用关系，在原文中找到引用段落并分析
      console.log('\n--- Step 3: Finding Citation Contexts and Analyzing with LLM ---');
      const analyzedEdges = await this.analyzeCitationRelationships(
        sourcePaper,
        nodes,
        citationResult.citations
      );

      console.log(`✅ Analyzed ${analyzedEdges.length} relationships with LLM`);

      // Step 4: 合并结果
      const finalGraph: PaperGraph = {
        nodes,
        edges: analyzedEdges
      };

      const processingTime = Date.now() - startTime;

      // 将节点转换为 PaperMetadata（添加 citations 属性）
      const paperMetadatas: PaperMetadata[] = [sourcePaper];
      for (const node of nodes) {
        if (node.id !== sourcePaper.id) {
          paperMetadatas.push({
            id: node.id,
            title: node.title,
            authors: node.authors,
            year: node.year,
            abstract: node.abstract,
            venue: node.venue,
            citationCount: node.citationCount,
            paperCitationCount: node.paperCitationCount,
            citations: [] // 被引用论文的引用信息为空（如果需要可以扩展）
          });
        }
      }

      return {
        success: true,
        graph: finalGraph,
        papers: paperMetadatas,
        stats: {
          totalPapers: nodes.length,
          totalReferences: citationResult.citations.length,
          analyzedRelations: analyzedEdges.length,
          processingTime
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Reference-based graph building failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 从 reference 列表建立基本图结构（增强版：尝试从外部 API 获取完整信息）
   */
  private async buildBasicGraphFromReferences(
    sourcePaper: PaperMetadata,
    citations: Array<{
      id: string;
      title?: string;
      authors?: string[];
      year?: string;
    }>,
    enrichWithExternalApi: boolean = true
  ): Promise<{
    nodes: PaperGraph['nodes'];
    referenceEdges: Array<{ source: string; target: string; citationId: string }>;
  }> {
    const nodes: PaperGraph['nodes'] = [{
      id: sourcePaper.id,
      title: sourcePaper.title,
      authors: sourcePaper.authors,
      year: sourcePaper.year,
      abstract: sourcePaper.abstract,
      venue: sourcePaper.venue,
      citationCount: sourcePaper.citationCount,
      paperCitationCount: sourcePaper.paperCitationCount
    }];

    const referenceEdges: Array<{ source: string; target: string; citationId: string }> = [];
    const processedTitles = new Set<string>();

    console.log(`\n📚 Processing ${citations.length} references...`);
    let enrichedCount = 0;

    // 为每个 reference 创建节点和边
    for (let i = 0; i < citations.length; i++) {
      const citation = citations[i];
      
      if (!citation.title || citation.title.trim().length < 5) {
        continue; // 跳过无效的引用
      }

      // 生成被引用论文的 ID
      const citedPaperId = this.generateCitationId(citation.id, citation.title);
      
      // 避免重复节点（基于标题相似度）
      const existingNode = nodes.find(n => 
        this.isSimilarTitle(n.title, citation.title || '')
      );

      if (!existingNode) {
        // 尝试从外部 API 获取完整信息
        let enrichedData: Partial<PaperGraph['nodes'][0]> = {};
        
        if (enrichWithExternalApi) {
          try {
            enrichedData = await this.enrichCitationFromExternalApi(citation);
            if (enrichedData.abstract || enrichedData.venue) {
              enrichedCount++;
            }
          } catch (error) {
            // 静默失败，使用基本信息
            console.log(`⚠️  Failed to enrich citation "${citation.title?.substring(0, 50)}..."`);
          }
        }

        // 创建新节点（合并外部 API 数据）
        nodes.push({
          id: citedPaperId,
          title: citation.title,
          authors: citation.authors || enrichedData.authors || [],
          year: citation.year || enrichedData.year || 'Unknown',
          abstract: enrichedData.abstract || '',
          venue: enrichedData.venue,
          citationCount: enrichedData.citationCount,
          paperCitationCount: enrichedData.paperCitationCount
        });
        processedTitles.add(citation.title.toLowerCase());
      }

      // 创建引用边
      const targetId = existingNode?.id || citedPaperId;
      referenceEdges.push({
        source: sourcePaper.id,
        target: targetId,
        citationId: citation.id
      });

      // 进度提示
      if ((i + 1) % 10 === 0) {
        console.log(`   Processed ${i + 1}/${citations.length} references...`);
      }
    }

    console.log(`✅ Created ${nodes.length - 1} citation nodes (${enrichedCount} enriched from external APIs)`);

    return { nodes, referenceEdges };
  }

  /**
   * 从外部 API 增强引用信息
   */
  private async enrichCitationFromExternalApi(citation: {
    title?: string;
    authors?: string[];
    year?: string;
  }): Promise<Partial<PaperGraph['nodes'][0]>> {
    if (!citation.title) {
      return {};
    }

    try {
      // 方法1: 尝试从标题中提取 arXiv ID（如果有）
      const arxivIdMatch = citation.title.match(/arxiv[:\s]+([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?)/i);
      if (arxivIdMatch) {
        const arxivId = arxivIdMatch[1];
        const semanticData = await SemanticScholarService.queryByArxivId(arxivId);
        
        if (semanticData.success && semanticData.data) {
          const paper = semanticData.data;
          return {
            title: paper.title || citation.title,
            authors: paper.authors?.map((a: { name: string }) => a.name) || citation.authors || [],
            year: paper.year?.toString() || citation.year || 'Unknown',
            abstract: paper.abstract || '',
            venue: paper.venue || undefined,
            citationCount: paper.citationCount,
            paperCitationCount: paper.citationCount
          };
        }
      }

      // 方法2: 尝试使用标题搜索（如果 Semantic Scholar 支持）
      // 注意：Semantic Scholar API 可能需要不同的查询方式
      // 这里先使用基本信息，后续可以扩展
      
    } catch (error) {
      // 静默失败，使用基本信息
      // console.log(`⚠️  External API enrichment failed: ${error}`);
    }

    return {};
  }

  /**
   * 分析引用关系：找到引用段落并使用 LLM 分析
   */
  private async analyzeCitationRelationships(
    sourcePaper: PaperMetadata,
    targetNodes: PaperGraph['nodes'],
    citations: Array<{
      id: string;
      title?: string;
      authors?: string[];
      year?: string;
      context?: string;
      contextBefore?: string;
      contextAfter?: string;
      section?: string;
    }>
  ): Promise<RelationshipEdge[]> {
    const edges: RelationshipEdge[] = [];

    // 对于每个被引用的论文，找到相关的引用上下文
    for (const targetNode of targetNodes) {
      if (targetNode.id === sourcePaper.id) {
        continue; // 跳过源论文自己
      }

      // 找到源论文中引用目标论文的所有上下文
      const relevantCitations = citations.filter(citation => 
        citation.title && 
        this.isSimilarTitle(citation.title, targetNode.title)
      );

      if (relevantCitations.length === 0) {
        console.log(`⚠️  No citation context found for: "${targetNode.title}"`);
        continue;
      }

      console.log(`\n🔍 Analyzing relationship: "${sourcePaper.title}" -> "${targetNode.title}"`);
      console.log(`   Found ${relevantCitations.length} citation context(s)`);

      // 合并所有相关的引用上下文
      const citationContexts = relevantCitations
        .map(c => c.context || `${c.contextBefore} [CITATION] ${c.contextAfter}`)
        .filter(ctx => ctx && ctx.length > 10)
        .join('\n\n---\n\n');

      if (!citationContexts || citationContexts.length < 20) {
        console.log(`⚠️  Insufficient context for analysis`);
        continue;
      }

      // 使用 LLM 分析关系
      try {
        const relationship = await this.relationshipAnalyzer.analyzePairwiseRelationship(
          sourcePaper,
          {
            id: targetNode.id,
            title: targetNode.title,
            authors: targetNode.authors,
            year: targetNode.year,
            abstract: targetNode.abstract || '',
            venue: targetNode.venue,
            citationCount: targetNode.citationCount,
            paperCitationCount: targetNode.paperCitationCount,
            citations: [] // 目标论文的引用信息（如果需要可以扩展）
          }
        );

        if (relationship) {
          edges.push(relationship);
          console.log(`✅ Relationship analyzed: ${relationship.relationship} (strength: ${relationship.strength.toFixed(2)})`);
        } else {
          console.log(`⚪ No significant relationship detected`);
        }
      } catch (error) {
        console.error(`❌ Failed to analyze relationship:`, error);
      }
    }

    return edges;
  }

  /**
   * 检查标题相似度
   */
  private isSimilarTitle(title1: string, title2: string): boolean {
    if (!title1 || !title2) return false;
    
    const normalize = (s: string) => s.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const t1 = normalize(title1);
    const t2 = normalize(title2);
    
    if (t1 === t2) return true;
    
    // 包含关系
    if (t1.includes(t2) || t2.includes(t1)) {
      const shorter = Math.min(t1.length, t2.length);
      const longer = Math.max(t1.length, t2.length);
      return shorter / longer >= 0.6;
    }
    
    // 单词级别匹配
    const words1 = t1.split(' ').filter(w => w.length > 2);
    const words2 = t2.split(' ').filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length / Math.min(words1.length, words2.length) > 0.5;
  }

  /**
   * 生成论文 ID
   */
  private generatePaperId(url: string): string {
    // 从 URL 提取 arXiv ID 或其他标识符
    const arxivMatch = url.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?\/\s]+)/i);
    if (arxivMatch) {
      return `arxiv_${arxivMatch[1].replace(/[^\w.-]/g, '_')}`;
    }
    
    // 其他 URL 格式
    const urlHash = Buffer.from(url).toString('base64').substring(0, 16);
    return `paper_${urlHash}`;
  }

  /**
   * 生成引用 ID
   */
  private generateCitationId(citationId: string, title: string): string {
    if (citationId && citationId.length > 0) {
      return `ref_${citationId}`;
    }
    
    // 基于标题生成 ID
    const titleHash = Buffer.from(title).toString('base64').substring(0, 16);
    return `ref_${titleHash}`;
  }
}

