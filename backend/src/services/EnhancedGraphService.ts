/**
 * Enhanced Graph Service with Deep Paper Relationship Analysis
 * 集成深度論文關係分析的增強圖服務
 */

import { GraphService } from './GraphService';
import { AdvancedCitationService } from './AdvancedCitationService';
import { DeepPaperRelationshipAnalyzer, DeepPaperContext, DeepRelationshipEdge } from './DeepPaperRelationshipAnalyzer';
import { PaperMetadata } from './PaperRelationshipAnalyzer';
import { Paper } from '../entities/Paper';
import { SemanticScholarService } from './SemanticScholarService';

export interface EnhancedPaperGraph {
  nodes: Array<{
    id: string;
    title: string;
    authors: string[];
    year: string;
    abstract?: string;
    venue?: string;
    category?: string;
    citationCount?: number; // 新增：引用次數
    
    // 深度分析增強信息
    structuredAnalysis?: {
      contributions: string[];
      limitations: string[];
      methodology: string;
      novelty_score: number;
      influence_score: number;
    };
  }>;
  
  edges: DeepRelationshipEdge[];
  
  // 圖級別的分析結果
  graphMetrics: {
    totalNodes: number;
    totalEdges: number;
    averageRelationshipStrength: number;
    dominantRelationshipTypes: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    
    // 深度指標
    semanticClusters: Array<{
      name: string;
      papers: string[];
      centralPaper: string;
      avgInternalStrength: number;
    }>;
    
    influenceRanking: Array<{
      paperId: string;
      influenceScore: number;
      incomingConnections: number;
      outgoingConnections: number;
    }>;
  };
}

export class EnhancedGraphService extends GraphService {
  private deepAnalyzer: DeepPaperRelationshipAnalyzer;
  private citationService: AdvancedCitationService;

  constructor() {
    super();
    this.deepAnalyzer = new DeepPaperRelationshipAnalyzer();
    this.citationService = new AdvancedCitationService();
  }

  /**
   * 使用深度分析構建增強圖
   */
  async buildEnhancedGraph(seedPapers: string[]): Promise<EnhancedPaperGraph> {
    console.log(`\n🔍 Starting Enhanced Graph Building for ${seedPapers.length} seed papers...`);
    
    try {
      // Step 1: 使用GROBID提取每篇論文的深度結構化內容
      console.log('\n📄 Step 1: Extracting deep structured content...');
      const deepPaperContexts = await this.extractDeepPaperContexts(seedPapers);
      
      if (deepPaperContexts.length === 0) {
        throw new Error('No valid papers could be processed');
      }

      console.log(`✅ Successfully processed ${deepPaperContexts.length} papers`);

      // Step 2: 進行深度關係分析
      console.log('\n🔗 Step 2: Performing deep relationship analysis...');
      const relationships = await this.analyzeDeepRelationships(deepPaperContexts);
      
      console.log(`✅ Found ${relationships.length} significant relationships`);

      // Step 3: 計算圖級別指標
      console.log('\n📊 Step 3: Computing graph metrics...');
      const graphMetrics = await this.computeGraphMetrics(deepPaperContexts, relationships);

      // Step 4: 構建最終圖結構
      const nodes = deepPaperContexts.map(paper => {
        console.log(`📝 Creating node for: ${paper.title}`);
        console.log(`   Authors: ${paper.authors.join(', ') || 'No authors'}`);
        console.log(`   Year: ${paper.year}`);
        console.log(`🔍 [NODE DEBUG] Citation count in paper context:`, {
          citationCount: paper.citationCount,
          citationCountType: typeof paper.citationCount,
          venue: paper.venue
        });
        
        const node = {
          id: paper.id,
          title: paper.title,
          authors: paper.authors,
          year: paper.year,
          abstract: paper.abstract,
          venue: paper.venue,
          url: paper.url, // 保存 URL
          arxivId: paper.arxivId, // 保存 arXiv ID
          citationCount: paper.citationCount, // 新增：引用次數
          category: this.inferPaperCategory(paper),
          structuredAnalysis: {
            contributions: paper.structuredContent.contributions,
            limitations: paper.structuredContent.limitations,
            methodology: paper.structuredContent.methodology.substring(0, 200),
            novelty_score: this.calculateNoveltyScore(paper, relationships),
            influence_score: this.calculateInfluenceScore(paper.id, relationships)
          }
        };
        
        console.log(`🔍 [NODE DEBUG] Final node citationCount:`, {
          nodeCitationCount: node.citationCount,
          nodeCitationCountType: typeof node.citationCount
        });
        
        return node;
      });

      const enhancedGraph: EnhancedPaperGraph = {
        nodes,
        edges: relationships,
        graphMetrics
      };

      // 3.5 獲取並添加 Derivative Works (引用這些論文的後續論文)
      console.log('\n--- Step 3.5: Fetching Derivative Works ---');
      // NOTE: 不再将 derivative works 添加到 graph 中，避免太多 nodes
      // Derivative works 应该只在列表中显示（通过 PaperCitationService 获取）
      // await this.appendDerivativeWorks(enhancedGraph, deepPaperContexts);

      console.log('\n🎉 Enhanced Graph Building Complete!');
      console.log(`   📝 Nodes: ${nodes.length}`);
      console.log(`   🔗 Edges: ${relationships.length}`);
      console.log(`   📊 Avg Relationship Strength: ${graphMetrics.averageRelationshipStrength.toFixed(3)}`);
      console.log(`   🏆 Top Relationship Type: ${graphMetrics.dominantRelationshipTypes[0]?.type || 'None'}`);

      return enhancedGraph;

    } catch (error) {
      console.error('❌ Enhanced Graph Building Failed:', error);
      throw error;
    }
  }

  /**
   * 从 URL 提取 arXiv ID
   */
  private extractArxivId(url: string): string | undefined {
    if (!url) return undefined;
    const match = url.match(/arxiv\.org\/(?:abs|pdf)\/([^\/\?\s]+)/i);
    if (match && match[1]) {
      return match[1].replace(/\.pdf$/i, '').replace(/v\d+$/i, '');
    }
    return undefined;
  }

  /**
   * 提取論文的深度結構化內容
   */
  private async extractDeepPaperContexts(paperUrls: string[]): Promise<DeepPaperContext[]> {
    const contexts: DeepPaperContext[] = [];
    const maxConcurrency = 3; // 限制並發數量

    for (let i = 0; i < paperUrls.length; i += maxConcurrency) {
      const batch = paperUrls.slice(i, i + maxConcurrency);
      
      console.log(`Processing batch ${Math.floor(i/maxConcurrency) + 1}/${Math.ceil(paperUrls.length/maxConcurrency)}`);
      
      const batchPromises = batch.map(async (url, batchIndex) => {
        const globalIndex = i + batchIndex + 1;
        console.log(`[${globalIndex}/${paperUrls.length}] Processing: ${url}`);
        
        try {
          // 使用現有的GROBID服務提取基本信息
          const citationResult = await this.citationService.extractCitationsWithContextFiltered(url);
          
          if (!citationResult.success) {
            console.warn(`⚠️  [${globalIndex}] Failed to extract citations: ${citationResult.error}`);
            return null;
          }

          // 構建基本的論文元數據
          const arxivId = this.extractArxivId(url);
          const paperMetadata: PaperMetadata = {
            id: this.generatePaperId(citationResult.paperTitle || url),
            title: citationResult.paperTitle || 'Unknown Title',
            authors: citationResult.paperAuthors || [],
            year: citationResult.paperYear || 'Unknown',
            abstract: citationResult.paperAbstract,
            venue: citationResult.paperVenue,
            url: url, // 保存原始 URL
            arxivId: arxivId, // 提取 arXiv ID
            citationCount: citationResult.paperCitationCount, // 新增：引用次數
            citations: citationResult.citations || []
          };
          
          console.log(`🔍 [GRAPH DEBUG] Created paperMetadata with citationCount:`, {
            title: paperMetadata.title?.substring(0, 50) + '...',
            citationCount: paperMetadata.citationCount,
            citationCountType: typeof paperMetadata.citationCount,
            venue: paperMetadata.venue
          });

          // 調試信息：打印作者信息
          console.log(`[${globalIndex}] Paper authors extracted: ${paperMetadata.authors.join(', ') || 'No authors found'}`);
          console.log(`[${globalIndex}] Citation result authors: ${citationResult.paperAuthors?.join(', ') || 'No authors in result'}`);

          // 如果有TEI XML，進行深度分析
          let deepContext: DeepPaperContext;
          
          if (citationResult.teiXml) {
            console.log(`[${globalIndex}] Performing deep TEI analysis...`);
            deepContext = await this.deepAnalyzer.extractDeepStructuredContent(
              citationResult.teiXml, 
              paperMetadata
            );
          } else {
            // 使用基本信息創建深度上下文
            deepContext = await this.createDeepContextFromMetadata(paperMetadata);
          }
          
          console.log(`✅ [${globalIndex}] Successfully processed: ${paperMetadata.title.substring(0, 50)}...`);
          return deepContext;

        } catch (error) {
          console.error(`❌ [${globalIndex}] Processing failed:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      contexts.push(...batchResults.filter((context): context is DeepPaperContext => context !== null));
      
      // 批次間短暫暫停
      if (i + maxConcurrency < paperUrls.length) {
        await this.sleep(1000);
      }
    }

    return contexts;
  }

  /**
   * 從基本元數據創建深度上下文（簡化版）
   */
  private async createDeepContextFromMetadata(metadata: PaperMetadata): Promise<DeepPaperContext> {
    console.log(`🔍 [DEEP CONTEXT DEBUG] Input metadata citationCount:`, {
      citationCount: metadata.citationCount,
      citationCountType: typeof metadata.citationCount,
      title: metadata.title?.substring(0, 50) + '...'
    });
    
    return {
      id: metadata.id,
      title: metadata.title,
      authors: metadata.authors,
      year: metadata.year,
      abstract: metadata.abstract || '',
      venue: metadata.venue,
      url: metadata.url, // 新增：論文 URL
      arxivId: metadata.arxivId, // 新增：arXiv ID
      citationCount: metadata.citationCount, // 新增：引用次數
      
      // 簡化的結構化內容
      structuredContent: {
        introduction: '',
        relatedWork: '',
        methodology: '',
        contributions: await this.extractContributionsFromAbstract(metadata.abstract || ''),
        limitations: [],
        conclusions: ''
      },
      
      // 轉換引用分析
      citationAnalysis: metadata.citations.map(citation => ({
        citedPaperId: citation.id,
        citedTitle: citation.title || 'Unknown',
        sentenceContext: citation.context,
        paragraphContext: citation.context,
        sectionContext: citation.context,
        section: 'Unknown',
        position: 'middle' as const,
        discourseFunction: 'background' as const,
        citationDensity: 0,
        coOccurringCitations: []
      }))
    };
  }

  /**
   * 從摘要中提取貢獻（簡化版）
   */
  private async extractContributionsFromAbstract(abstract: string): Promise<string[]> {
    if (!abstract || abstract.length < 50) return [];
    
    // 簡單的關鍵詞匹配提取貢獻
    const contributionKeywords = [
      'we propose', 'we present', 'we introduce', 'we develop',
      'our contribution', 'our approach', 'our method', 'our framework',
      'novel', 'new', 'improved', 'enhanced'
    ];
    
    const sentences = abstract.split(/[.!?]+/);
    const contributions: string[] = [];
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (contributionKeywords.some(keyword => lowerSentence.includes(keyword))) {
        contributions.push(sentence.trim());
      }
    }
    
    return contributions.slice(0, 3); // 最多返回3個
  }

  /**
   * 分析深度關係
   */
  private async analyzeDeepRelationships(papers: DeepPaperContext[]): Promise<DeepRelationshipEdge[]> {
    const relationships: DeepRelationshipEdge[] = [];
    const totalPairs = papers.length * (papers.length - 1);
    let processedPairs = 0;

    console.log(`🔍 Analyzing ${totalPairs} potential relationships...`);

    for (let i = 0; i < papers.length; i++) {
      for (let j = 0; j < papers.length; j++) {
        if (i === j) continue;
        
        processedPairs++;
        const progress = Math.round((processedPairs / totalPairs) * 100);
        
        if (processedPairs % 10 === 0 || processedPairs <= 5) {
          console.log(`[${processedPairs}/${totalPairs}] Progress: ${progress}% - Analyzing: ${papers[i].title.substring(0, 30)}... → ${papers[j].title.substring(0, 30)}...`);
        }

        try {
          const relationship = await this.deepAnalyzer.analyzeDeepRelationship(papers[i], papers[j]);
          
          if (relationship && relationship.strength > 0.3) { // 只保留較強的關係
            relationships.push(relationship);
          }
        } catch (error) {
          console.warn(`⚠️  Relationship analysis failed for pair ${i}-${j}:`, error);
        }
      }
      
      // 每處理完一篇論文的所有關係後稍作暫停
      if (i < papers.length - 1) {
        await this.sleep(500);
      }
    }

    // 過濾和優化關係
    const filteredRelationships = this.filterAndOptimizeRelationships(relationships);
    
    console.log(`✨ Found ${relationships.length} total relationships, kept ${filteredRelationships.length} after filtering`);
    
    return filteredRelationships;
  }

  /**
   * 過濾和優化關係
   */
  private filterAndOptimizeRelationships(relationships: DeepRelationshipEdge[]): DeepRelationshipEdge[] {
    // 1. 按強度排序
    relationships.sort((a, b) => b.strength - a.strength);
    
    // 2. 移除重複的弱關係
    const uniqueRelationships = new Map<string, DeepRelationshipEdge>();
    
    for (const rel of relationships) {
      const key = `${rel.source}-${rel.target}`;
      const existing = uniqueRelationships.get(key);
      
      if (!existing || rel.strength > existing.strength) {
        uniqueRelationships.set(key, rel);
      }
    }
    
    // 3. 只保留強關係或每個節點的前N個關係
    const filteredRelationships: DeepRelationshipEdge[] = [];
    const nodeConnectionCount = new Map<string, number>();
    
    for (const rel of Array.from(uniqueRelationships.values())) {
      const sourceConnections = nodeConnectionCount.get(rel.source) || 0;
      const targetConnections = nodeConnectionCount.get(rel.target) || 0;
      
      // 保留條件：強關係 或 節點連接數未超過限制
      if (rel.strength > 0.6 || (sourceConnections < 5 && targetConnections < 5)) {
        filteredRelationships.push(rel);
        nodeConnectionCount.set(rel.source, sourceConnections + 1);
        nodeConnectionCount.set(rel.target, targetConnections + 1);
      }
    }
    
    return filteredRelationships;
  }

  /**
   * 計算圖指標
   */
  private async computeGraphMetrics(
    papers: DeepPaperContext[], 
    relationships: DeepRelationshipEdge[]
  ): Promise<EnhancedPaperGraph['graphMetrics']> {
    // 基本統計
    const totalNodes = papers.length;
    const totalEdges = relationships.length;
    const averageRelationshipStrength = totalEdges > 0 
      ? relationships.reduce((sum, rel) => sum + rel.strength, 0) / totalEdges 
      : 0;

    // 關係類型分布
    const relationshipTypeCounts = new Map<string, number>();
    relationships.forEach(rel => {
      const count = relationshipTypeCounts.get(rel.relationship) || 0;
      relationshipTypeCounts.set(rel.relationship, count + 1);
    });

    const dominantRelationshipTypes = Array.from(relationshipTypeCounts.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / totalEdges) * 100
      }))
      .sort((a, b) => b.count - a.count);

    // 影響力排名
    const influenceRanking = papers.map(paper => {
      const incomingConnections = relationships.filter(rel => rel.target === paper.id).length;
      const outgoingConnections = relationships.filter(rel => rel.source === paper.id).length;
      const influenceScore = this.calculateInfluenceScore(paper.id, relationships);
      
      return {
        paperId: paper.id,
        influenceScore,
        incomingConnections,
        outgoingConnections
      };
    }).sort((a, b) => b.influenceScore - a.influenceScore);

    // 語義聚類（簡化版）
    const semanticClusters = await this.identifySemanticClusters(papers, relationships);

    return {
      totalNodes,
      totalEdges,
      averageRelationshipStrength,
      dominantRelationshipTypes,
      semanticClusters,
      influenceRanking
    };
  }

  /**
   * 識別語義聚類
   */
  private async identifySemanticClusters(
    papers: DeepPaperContext[], 
    relationships: DeepRelationshipEdge[]
  ): Promise<EnhancedPaperGraph['graphMetrics']['semanticClusters']> {
    // 簡化的聚類算法：基於連接密度
    const clusters: Array<{
      name: string;
      papers: string[];
      centralPaper: string;
      avgInternalStrength: number;
    }> = [];

    const processed = new Set<string>();
    
    for (const paper of papers) {
      if (processed.has(paper.id)) continue;
      
      // 找到與此論文強連接的其他論文
      const stronglyConnected = relationships
        .filter(rel => 
          (rel.source === paper.id || rel.target === paper.id) && 
          rel.strength > 0.5
        )
        .map(rel => rel.source === paper.id ? rel.target : rel.source)
        .filter(id => !processed.has(id));
      
      if (stronglyConnected.length > 0) {
        const clusterPapers = [paper.id, ...stronglyConnected];
        
        // 計算集群內平均連接強度
        const internalConnections = relationships.filter(rel => 
          clusterPapers.includes(rel.source) && clusterPapers.includes(rel.target)
        );
        
        const avgInternalStrength = internalConnections.length > 0
          ? internalConnections.reduce((sum, rel) => sum + rel.strength, 0) / internalConnections.length
          : 0;
        
        clusters.push({
          name: `Cluster_${clusters.length + 1}`,
          papers: clusterPapers,
          centralPaper: paper.id,
          avgInternalStrength
        });
        
        clusterPapers.forEach(id => processed.add(id));
      }
    }
    
    return clusters;
  }

  // 輔助方法
  /**
   * 獲取並添加 Derivative Works 到圖中
   */
  private async appendDerivativeWorks(graph: EnhancedPaperGraph, inputPapers: DeepPaperContext[]): Promise<void> {
    console.log(`🔍 Fetching derivative works for ${inputPapers.length} papers...`);
    
    for (const paper of inputPapers) {
      try {
        const arxivId = paper.arxivId;
        let citingPapers: Array<{
          id: string; title: string; authors: string[]; year?: string; abstract?: string; url?: string; citationCount?: number;
        }> = [];

        // 1) 優先用 arXiv ID
        if (arxivId) {
          citingPapers = await SemanticScholarService.getAllCitingPapers(arxivId, {
            maxResults: 150,
            pagesToFetch: 3,
            fetchAllAvailable: false
          });
        }

        // 2) 若無 arXiv ID 或查不到，改用 Title+Authors+Year 拿 paperId 再查 citing
        if (citingPapers.length === 0) {
          const search = await SemanticScholarService.queryByTitleAndAuthors(paper.title, paper.authors, paper.year);
          if (search.success && search.data?.paperId) {
            citingPapers = await SemanticScholarService.getAllCitingPapers(search.data.paperId, {
              maxResults: 150,
              pagesToFetch: 3,
              fetchAllAvailable: false
            });
          }
        }

        console.log(`📄 Found ${citingPapers.length} derivative works for "${paper.title.substring(0, 50)}..."`);

        for (const citingPaper of citingPapers) {
          // 1. 添加節點 (如果不存在)
          const existingNodeIndex = graph.nodes.findIndex(n => n.id === citingPaper.id);
          if (existingNodeIndex === -1) {
            graph.nodes.push({
              id: citingPaper.id,
              title: citingPaper.title,
              authors: citingPaper.authors,
              year: citingPaper.year || 'Unknown',
              abstract: citingPaper.abstract,
              venue: 'Unknown',
              citationCount: citingPaper.citationCount ?? undefined,
              // 對於衍生作品，我們沒有深度分析，提供空的結構化分析
              structuredAnalysis: {
                contributions: [],
                limitations: [],
                methodology: '',
                novelty_score: 0,
                influence_score: 0
              }
            });
          }

          // 2. 添加邊 (Derivative -> Input Paper)
          // 檢查邊是否已存在
          const edgeExists = graph.edges.some(e => e.source === citingPaper.id && e.target === paper.id);
          if (!edgeExists) {
            // Create a basic edge with minimal analysisDetails
            const basicEdge: DeepRelationshipEdge = {
              source: citingPaper.id,
              target: paper.id,
              relationship: 'builds_on',
              strength: 1.0,
              description: 'Cites source paper (Derivative Work)',
              evidence: 'Citation from Semantic Scholar',
              analysisDetails: {
                discourseDimensions: {
                  methodological: { strength: 0, description: '' },
                  theoretical: { strength: 0, description: '' },
                  empirical: { strength: 0, description: '' },
                  comparative: { strength: 0, description: '' }
                },
                citationPattern: {
                  frequency: 1,
                  distribution: 'unknown',
                  prominence: 0.5,
                  context_diversity: 0
                },
                semanticRelation: {
                  agreement: 0,
                  novelty: 0,
                  dependency: 0.5,
                  complementarity: 0
                },
                keyEvidence: []
              }
            };
            graph.edges.push(basicEdge);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to fetch derivative works for ${paper.title}:`, error);
      }
    }
  }

  private generatePaperId(title: string): string {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  private inferPaperCategory(paper: DeepPaperContext): string {
    const title = paper.title.toLowerCase();
    const abstract = paper.abstract.toLowerCase();
    
    const categories = [
      { name: 'Machine Learning', keywords: ['machine learning', 'deep learning', 'neural network', 'ai', 'artificial intelligence'] },
      { name: 'Natural Language Processing', keywords: ['nlp', 'natural language', 'text', 'language model', 'bert', 'gpt'] },
      { name: 'Computer Vision', keywords: ['computer vision', 'image', 'visual', 'cnn', 'detection', 'recognition'] },
      { name: 'Robotics', keywords: ['robot', 'robotics', 'autonomous', 'control', 'navigation'] },
      { name: 'Systems', keywords: ['system', 'distributed', 'database', 'network', 'architecture'] }
    ];
    
    for (const category of categories) {
      if (category.keywords.some(keyword => title.includes(keyword) || abstract.includes(keyword))) {
        return category.name;
      }
    }
    
    return 'General';
  }

  private calculateNoveltyScore(paper: DeepPaperContext, relationships: DeepRelationshipEdge[]): number {
    // 基於引用模式和貢獻數量計算新穎性分數
    const contributions = paper.structuredContent.contributions.length;
    const outgoingRefs = relationships.filter(rel => rel.source === paper.id).length;
    const incomingRefs = relationships.filter(rel => rel.target === paper.id).length;
    
    // 新穎性 = 貢獻數 + (引用他人 - 被他人引用) / 總關係數
    const baseScore = Math.min(contributions * 0.2, 1.0);
    const referenceRatio = outgoingRefs > 0 ? (outgoingRefs - incomingRefs) / (outgoingRefs + incomingRefs) : 0;
    
    return Math.max(0, Math.min(1, baseScore + referenceRatio * 0.3));
  }

  private calculateInfluenceScore(paperId: string, relationships: DeepRelationshipEdge[]): number {
    // 基於被引用數量和引用強度計算影響力分數
    const incomingRels = relationships.filter(rel => rel.target === paperId);
    const totalIncoming = incomingRels.length;
    const avgStrength = totalIncoming > 0 
      ? incomingRels.reduce((sum, rel) => sum + rel.strength, 0) / totalIncoming 
      : 0;
    
    // 影響力 = 被引用數 * 平均引用強度
    return Math.min(1.0, (totalIncoming * 0.2) * avgStrength);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
