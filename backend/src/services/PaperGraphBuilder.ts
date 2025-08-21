/**
 * Paper Graph Builder Service
 * 整合 GROBID 和 LLM 分析，構建論文關係圖
 */

import { AdvancedCitationService } from './AdvancedCitationService';
import { PaperRelationshipAnalyzer, PaperMetadata, PaperGraph } from './PaperRelationshipAnalyzer';

export interface PaperInput {
  url: string;
  title?: string; // 可選，用於覆蓋自動提取的標題
}

export interface GraphBuildResult {
  success: boolean;
  graph?: PaperGraph;
  papers?: PaperMetadata[];
  error?: string;
  stats?: {
    totalPapers: number;
    totalEdges: number;
    processingTime: number;
  };
}

export class PaperGraphBuilder {
  private grobidService: AdvancedCitationService;
  private relationshipAnalyzer: PaperRelationshipAnalyzer;

  constructor() {
    this.grobidService = new AdvancedCitationService();
    this.relationshipAnalyzer = new PaperRelationshipAnalyzer();
  }

  /**
   * 從多個論文 URL 構建關係圖
   */
  async buildGraphFromUrls(paperUrls: string[]): Promise<GraphBuildResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n=== Building Paper Graph from ${paperUrls.length} URLs ===`);

      // 1. 檢查服務可用性
      const servicesReady = await this.checkServicesPrivate();
      if (!servicesReady.grobid || !servicesReady.llm) {
        return {
          success: false,
          error: `Services not ready - GROBID: ${servicesReady.grobid}, LLM: ${servicesReady.llm}`
        };
      }

      // 2. 使用 GROBID 提取每篇論文的數據
      console.log('\n--- Step 1: Extracting Paper Data with GROBID ---');
      const papers: PaperMetadata[] = [];
      
      for (let i = 0; i < paperUrls.length; i++) {
        const url = paperUrls[i];
        console.log(`Processing paper ${i + 1}/${paperUrls.length}: ${url}`);
        
        const paperData = await this.extractPaperData(url);
        if (paperData) {
          papers.push(paperData);
          console.log(`✅ Extracted: ${paperData.title}`);
        } else {
          console.log(`❌ Failed to extract data from: ${url}`);
        }
      }

      if (papers.length === 0) {
        return {
          success: false,
          error: 'No papers could be processed successfully'
        };
      }

      // 3. 使用 LLM 分析論文關係
      console.log('\n--- Step 2: Analyzing Relationships with LLM ---');
      
      // 將引用轉換為額外的論文節點（深度1表示只提取一層引用）
      const allPapers = await this.expandPapersWithCitations(papers, 1);
      console.log(`Expanded to ${allPapers.length} total papers (including ${allPapers.length - papers.length} cited papers)`);
      
      const graph = await this.relationshipAnalyzer.buildRelationshipGraph(allPapers);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        graph,
        papers,
        stats: {
          totalPapers: papers.length,
          totalEdges: graph.edges.length,
          processingTime
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Graph building failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 從論文 URL 提取數據（包含引用信息）
   */
  private async extractPaperData(url: string): Promise<PaperMetadata | null> {
    try {
      // 使用過濾版本的 GROBID 提取引用（僅 Related Work 和 Introduction）
      const citationResult = await this.grobidService.extractCitationsWithContextFiltered(url);
      
      if (!citationResult.success) {
        console.error(`Failed to extract citations from ${url}:`, citationResult.error);
        return null;
      }

      // 生成唯一 ID（基於 URL）
      const id = this.generatePaperId(url);

      // 嘗試從 arXiv 獲取更好的 abstract
      let finalAbstract = citationResult.paperAbstract;
      const title = citationResult.paperTitle || 'Unknown Title';
      
      if (title !== 'Unknown Title') {
        console.log(`🔍 Attempting to find arXiv version for better abstract: ${title.slice(0, 50)}...`);
        const arxivUrl = await this.inferArxivUrl(title);
        
        if (arxivUrl) {
          console.log(`📄 Found arXiv version: ${arxivUrl}`);
          try {
            const PaperService = require('./PaperService').PaperService;
            const paperService = new PaperService();
            const arxivData = await paperService.fetchPaperByUrl(arxivUrl);
            
            if (arxivData && arxivData.abstract && arxivData.abstract.trim()) {
              console.log(`✅ Using arXiv abstract (${arxivData.abstract.length} chars) instead of GROBID abstract (${finalAbstract?.length || 0} chars)`);
              finalAbstract = arxivData.abstract;
            }
          } catch (error) {
            console.log(`⚠️ Failed to fetch arXiv abstract: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // 構建 PaperMetadata
      const paperMetadata = {
        id,
        title,
        authors: citationResult.paperAuthors || [],
        year: citationResult.paperYear || this.extractYearFromUrl(url) || 'Unknown',
        abstract: finalAbstract,
        venue: citationResult.paperVenue,
        citationCount: citationResult.paperCitationCount, // 新增：引用次數
        paperCitationCount: citationResult.paperCitationCount, // 直接使用 paperCitationCount
        citations: citationResult.citations
      };
      
      console.log(`🔍 [PAPER GRAPH DEBUG] Created PaperMetadata with:`, {
        id,
        title: title?.substring(0, 50) + '...',
        citationCount: citationResult.paperCitationCount,
        paperCitationCount: citationResult.paperCitationCount
      });
      
      return paperMetadata;

    } catch (error) {
      console.error(`Error extracting paper data from ${url}:`, error);
      return null;
    }
  }

  /**
   * 使用篩選後的引用提取構建關係圖（只從 Introduction/Related Work 部分）
   */
  async buildGraphWithFilteredCitations(paperUrls: string[], expansionDepth: number = 0): Promise<GraphBuildResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n=== Building Paper Graph with Filtered Citations from ${paperUrls.length} URLs (depth: ${expansionDepth}) ===`);

      // 1. 檢查服務可用性
      const servicesReady = await this.checkServicesPrivate();
      if (!servicesReady.grobid || !servicesReady.llm) {
        return {
          success: false,
          error: `Services not ready - GROBID: ${servicesReady.grobid}, LLM: ${servicesReady.llm}`
        };
      }

      // 2. 提取論文數據（使用篩選後的引用）
      console.log('\n📋 Extracting paper data with filtered citations...');
      const papers: PaperMetadata[] = [];
      
      for (const url of paperUrls) {
        const paperData = await this.extractPaperDataFiltered(url);
        if (paperData) {
          papers.push(paperData);
        }
      }

      if (papers.length === 0) {
        return {
          success: false,
          error: 'No papers could be extracted'
        };
      }

      console.log(`✅ Successfully extracted ${papers.length} papers with filtered citations`);

      // 2.5. 深度引用擴展（網狀發散分析）
      let allPapers = papers;
      if (expansionDepth > 0) {
        console.log(`\n🕸️  Starting network expansion analysis (depth: ${expansionDepth})`);
        allPapers = await this.expandPapersWithCitations(papers, expansionDepth);
        console.log(`📈 Expanded from ${papers.length} to ${allPapers.length} papers through citation network`);
      }

      // 3. 分析論文關係
      console.log('\n🔍 Analyzing paper relationships...');
      const graph = await this.relationshipAnalyzer.buildRelationshipGraph(allPapers);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Graph construction completed in ${processingTime}ms`);
      console.log(`📊 Final graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

      return {
        success: true,
        graph,
        papers: allPapers, // 修正：返回擴展後的所有論文
        stats: {
          totalPapers: allPapers.length, // 修正：使用擴展後的論文數量
          totalEdges: graph.edges.length,
          processingTime
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Graph building error:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 從論文 URL 提取數據（使用篩選後的引用提取）
   */
  private async extractPaperDataFiltered(url: string): Promise<PaperMetadata | null> {
    try {
      // 使用篩選版本的 GROBID 提取引用（僅 Related Work 和 Introduction）
      const citationResult = await this.grobidService.extractCitationsWithContextFiltered(url);
      
      if (!citationResult.success) {
        console.error(`Failed to extract filtered citations from ${url}:`, citationResult.error);
        return null;
      }

      console.log(`📊 Filtered section analysis for ${url}:`);
      console.log(`   - Total sections found: ${citationResult.totalSections || 0}`);
      console.log(`   - Filtered sections: ${citationResult.filteredSections?.join(', ') || 'none'}`);
      console.log(`   - Citations from filtered sections: ${citationResult.citations.length}`);

      // 生成唯一 ID（基於 URL）
      const id = this.generatePaperId(url);

      // 嘗試從 arXiv 獲取更好的 abstract
      let finalAbstract = citationResult.paperAbstract;
      const title = citationResult.paperTitle || 'Unknown Title';
      
      if (title !== 'Unknown Title') {
        console.log(`🔍 Attempting to find arXiv version for better abstract: ${title.slice(0, 50)}...`);
        const arxivUrl = await this.inferArxivUrl(title);
        
        if (arxivUrl) {
          console.log(`📄 Found arXiv version: ${arxivUrl}`);
          try {
            const PaperService = require('./PaperService').PaperService;
            const paperService = new PaperService();
            const arxivData = await paperService.fetchPaperByUrl(arxivUrl);
            
            if (arxivData && arxivData.abstract && arxivData.abstract.trim()) {
              console.log(`✅ Using arXiv abstract (${arxivData.abstract.length} chars) instead of GROBID abstract (${finalAbstract?.length || 0} chars)`);
              finalAbstract = arxivData.abstract;
            }
          } catch (error) {
            console.log(`⚠️ Failed to fetch arXiv abstract: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // 構建 PaperMetadata
      const paperMetadata = {
        id,
        title,
        authors: citationResult.paperAuthors || [],
        year: citationResult.paperYear || this.extractYearFromUrl(url) || 'Unknown',
        abstract: finalAbstract,
        venue: citationResult.paperVenue,
        citationCount: citationResult.paperCitationCount, // 新增：引用次數
        paperCitationCount: citationResult.paperCitationCount, // 直接使用 paperCitationCount
        citations: citationResult.citations
      };
      
      console.log(`🔍 [PAPER GRAPH FILTERED DEBUG] Created PaperMetadata with:`, {
        id,
        title: title?.substring(0, 50) + '...',
        citationCount: citationResult.paperCitationCount,
        paperCitationCount: citationResult.paperCitationCount
      });
      
      return paperMetadata;

    } catch (error) {
      console.error(`Error extracting filtered paper data from ${url}:`, error);
      return null;
    }
  }

  /**
   * 檢查所需服務是否可用
   */
  private async checkServices(): Promise<{ grobid: boolean; llm: boolean }> {
    const [grobidReady, llmReady] = await Promise.all([
      this.grobidService.testGrobidConnection(),
      this.relationshipAnalyzer.testLLMConnection()
    ]);

    console.log(`Service Status - GROBID: ${grobidReady ? '✅' : '❌'}, LLM: ${llmReady ? '✅' : '❌'}`);

    return {
      grobid: grobidReady,
      llm: llmReady
    };
  }

  /**
   * 將引用轉換為額外的論文節點，擴展論文列表（支持深度提取）
   * 改進版：確保引用論文也通過GROBID處理，避免重複，建立完整的引用網絡
   */
  private async expandPapersWithCitations(mainPapers: PaperMetadata[], depth: number = 1): Promise<PaperMetadata[]> {
    const allPapers: PaperMetadata[] = [...mainPapers];
    const processedPaperIds = new Set<string>();
    const processedUrls = new Set<string>();

    // 記錄已有的論文ID和URL
    for (const paper of mainPapers) {
      processedPaperIds.add(paper.id);
      // 如果論文有原始URL，也記錄下來
      const url = await this.inferArxivUrl(paper.title);
      if (url) processedUrls.add(url);
    }

    console.log(`\n🔗 Expanding papers with citations (depth: ${depth})`);

    // 使用隊列來處理層級遞歸
    const papersToProcess = [...mainPapers];
    let currentDepth = 0;

    while (currentDepth < depth && papersToProcess.length > 0) {
      currentDepth++;
      const currentLevelPapers = [...papersToProcess];
      papersToProcess.length = 0; // 清空待處理隊列

      console.log(`\n📈 Processing depth ${currentDepth}, analyzing ${currentLevelPapers.length} papers`);

      for (const paper of currentLevelPapers) {
        if (paper.citations && paper.citations.length > 0) {
          console.log(`Processing ${paper.citations.length} citations from: ${paper.title}`);
          
          for (const citation of paper.citations) {
            // 跳過沒有標題的引用
            if (!citation.title) continue;

            // 生成引用論文的唯一ID
            const citationId = this.generateCitationId(citation);
            
            // 檢查是否已經處理過這個論文
            if (processedPaperIds.has(citationId)) {
              console.log(`⏭️  Skipping already processed paper: ${citation.title}`);
              continue;
            }

            // 嘗試推斷arXiv URL
            const possibleUrl = await this.inferArxivUrl(citation.title, citation.authors, citation.year);
            
            if (possibleUrl && processedUrls.has(possibleUrl)) {
              console.log(`⏭️  Skipping already processed URL: ${possibleUrl}`);
              continue;
            }

            // 標記為已處理
            processedPaperIds.add(citationId);
            if (possibleUrl) processedUrls.add(possibleUrl);

            // 嘗試通過GROBID處理引用論文
            let citedPaper: PaperMetadata;
            
            if (possibleUrl) {
              console.log(`🔍 Attempting GROBID extraction for: ${citation.title}`);
              console.log(`📎 Inferred URL: ${possibleUrl}`);
              
              try {
                // 使用GROBID提取引用論文的完整信息（包括其引用）
                const extractedPaper = await this.extractPaperDataFiltered(possibleUrl);
                
                if (extractedPaper) {
                  console.log(`✅ Successfully extracted via GROBID: ${citation.title}`);
                  console.log(`📚 Found ${extractedPaper.citations.length} citations in this paper`);
                  citedPaper = extractedPaper;
                  
                  // 如果還有深度剩餘，將此論文添加到下一輪處理隊列
                  if (currentDepth < depth && extractedPaper.citations.length > 0) {
                    papersToProcess.push(extractedPaper);
                    console.log(`🔄 Added to next level processing: ${citation.title}`);
                  }
                } else {
                  console.log(`⚠️  GROBID extraction failed, using basic citation info: ${citation.title}`);
                  citedPaper = this.createBasicCitedPaper(citation);
                }
              } catch (error) {
                console.log(`❌ Error processing ${citation.title}:`, error);
                citedPaper = this.createBasicCitedPaper(citation);
              }
            } else {
              console.log(`📄 No URL found, using basic citation info: ${citation.title}`);
              citedPaper = this.createBasicCitedPaper(citation);
            }

            allPapers.push(citedPaper);
          }
        }
      }
    }

    console.log(`📊 Expanded from ${mainPapers.length} to ${allPapers.length} papers after ${currentDepth} levels`);
    return allPapers;
  }

  /**
   * 為引用創建論文對象，嘗試提取實際內容
   * @deprecated 已被新的 expandPapersWithCitations 邏輯替代
   */
  /*
  private async createCitedPaperWithContent(citation: any, depth: number): Promise<PaperMetadata> {
    const citationId = this.generateCitationId(citation);
    
    // 基本的引用論文對象
    let citedPaper: PaperMetadata = {
      id: citationId,
      title: citation.title,
      authors: citation.authors || [],
      year: citation.year || 'Unknown',
      citations: [] // 默認空引用
    };

    // 如果深度大於0且可以推斷URL，嘗試提取實際內容
    if (depth > 0 && citation.title) {
      const possibleUrl = await this.inferArxivUrl(citation.title, citation.authors, citation.year);
      
      if (possibleUrl) {
        console.log(`🔍 Attempting to extract content for: ${citation.title}`);
        try {
          // 嘗試提取引用論文的內容
          const extractedPaper = await this.extractPaperData(possibleUrl);
          if (extractedPaper) {
            console.log(`✅ Successfully extracted content for: ${citation.title}`);
            citedPaper = extractedPaper;
            // 遞歸提取引用的引用（深度-1）
            if (depth > 1 && extractedPaper.citations.length > 0) {
              console.log(`🔄 Recursively extracting citations for: ${citation.title}`);
              const expandedCitations = await this.expandPapersWithCitations([extractedPaper], depth - 1);
              // 將新發現的論文添加到全局列表（這需要在調用方處理）
            }
          }
        } catch (error) {
          console.log(`⚠️  Failed to extract content for: ${citation.title}`);
        }
      }
    }

    return citedPaper;
  }
  */

  /**
   * 嘗試根據論文信息推斷arXiv URL
   * 改進版：實際搜索arXiv API來找到論文
   */
  private async inferArxivUrl(title: string, authors?: string[], year?: string): Promise<string | null> {
    try {
      // 清理標題，保留連字符和冒號，只移除引號和其他問題字符
      const cleanTitle = title.replace(/["\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
      
      // 嘗試多種搜尋策略
      const searchStrategies = [
        // 策略1: 精確標題搜尋
        `ti:"${cleanTitle}"`,
        // 策略2: 標題 + 作者
        authors && authors.length > 0 ? 
          `ti:"${cleanTitle}" AND au:"${authors[0].replace(/["\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim()}"` : 
          null,
        // 策略3: 不區分大小寫的標題搜尋（使用all字段）
        `all:"${cleanTitle}"`,
        // 策略4: 拆分關鍵詞搜尋
        cleanTitle.split(/[:\-\s]+/)
          .filter(word => word.length > 2)
          .slice(0, 5)
          .map(word => `ti:"${word}"`)
          .join(' AND ')
      ].filter(Boolean);
      
      console.log(`🔍 Searching arXiv for: ${title}`);
      
      // 嘗試每種搜尋策略
      for (let i = 0; i < searchStrategies.length; i++) {
        const searchQuery = searchStrategies[i];
        if (!searchQuery) continue; // 跳過 null 值
        
        console.log(`📝 Strategy ${i + 1}: ${searchQuery}`);
        
        const result = await this.tryArxivSearch(searchQuery, cleanTitle);
        if (result) {
          console.log(`✅ Found via strategy ${i + 1}: ${result}`);
          return result;
        }
      }
      
      console.log(`❌ No suitable match found for: ${title}`);
      return null;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`⚠️  arXiv search failed for "${title}":`, errorMessage);
      return null;
    }
  }

  /**
   * 嘗試使用特定查詢搜尋 arXiv
   */
  private async tryArxivSearch(searchQuery: string, cleanTitle: string): Promise<string | null> {
    try {
      const axios = require('axios');
      const apiUrl = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=10&sortBy=relevance&sortOrder=descending`;
      
      const response = await axios.get(apiUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'PaperMaster/1.0'
        }
      });
      
      if (response.status === 200) {
        const cheerio = require('cheerio');
        const $ = cheerio.load(response.data, { xmlMode: true });
        
        const entries = $('entry');
        console.log(`📊 Found ${entries.length} potential matches`);
        
        for (let i = 0; i < entries.length; i++) {
          const entry = entries.eq(i);
          const arxivTitle = entry.find('title').text().trim();
          const arxivId = entry.find('id').text().trim();
          
          // 計算標題相似度
          const similarity = this.calculateTitleSimilarity(cleanTitle, arxivTitle);
          console.log(`📋 Match ${i + 1}: similarity=${similarity.toFixed(2)}, title="${arxivTitle.substring(0, 50)}..."`);
          
          // 如果相似度足夠高，返回這個URL
          if (similarity > 0.6) { // 降低閾值以捕獲更多潛在匹配
            const arxivUrl = arxivId.replace('http://arxiv.org/abs/', 'https://arxiv.org/abs/');
            console.log(`✅ Found matching paper: ${arxivUrl}`);
            return arxivUrl;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.log(`⚠️  Search strategy failed:`, error);
      return null;
    }
  }

  /**
   * 計算兩個標題之間的相似度
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    const normalize = (s: string) => s.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const t1 = normalize(title1);
    const t2 = normalize(title2);
    
    if (t1 === t2) return 1.0;
    
    // 簡單的詞語重疊計算
    const words1 = new Set(t1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(t2.split(' ').filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * 為引用生成唯一ID
   */
  private generateCitationId(citation: any): string {
    if (citation.id) {
      return `cite_${citation.id}`;
    }
    
    // 基於標題生成ID
    if (citation.title) {
      return `cite_${citation.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50)}`;
    }
    
    // 備用方案
    return `cite_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 檢查所需服務是否可用（私有方法）
   */
  private async checkServicesPrivate(): Promise<{ grobid: boolean; llm: boolean }> {
    const [grobidReady, llmReady] = await Promise.all([
      this.grobidService.testGrobidConnection(),
      this.relationshipAnalyzer.testLLMConnection()
    ]);

    console.log(`Service Status - GROBID: ${grobidReady ? '✅' : '❌'}, LLM: ${llmReady ? '✅' : '❌'}`);

    return {
      grobid: grobidReady,
      llm: llmReady
    };
  }

  /**
   * 生成論文 ID
   */
  private generatePaperId(url: string): string {
    // 從 arXiv URL 提取 ID
    const arxivMatch = url.match(/arxiv\.org\/abs\/(.+)/);
    if (arxivMatch) {
      return `arxiv_${arxivMatch[1].replace(/[^\w.-]/g, '_')}`;
    }
    
    // 其他 URL 的簡單 hash
    return `paper_${url.split('/').pop()?.replace(/[^\w.-]/g, '_') || 'unknown'}`;
  }

  /**
   * 從 URL 提取年份（改進的實現）
   */
  private extractYearFromUrl(url: string): string | null {
    // arXiv URL 格式: https://arxiv.org/abs/YYMM.NNNNN
    const arxivMatch = url.match(/arxiv\.org\/abs\/(\d{2})(\d{2})\./);
    if (arxivMatch) {
      const year = parseInt(arxivMatch[1]);
      // arXiv 使用2位年份，92-99表示1992-1999，00-91表示2000-2091
      if (year >= 92) {
        return `19${year}`;
      } else {
        return `20${year}`;
      }
    }
    
    // 其他格式的年份提取
    const yearMatch = url.match(/(\d{4})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (year >= 1990 && year <= 2030) {
        return yearMatch[1];
      }
    }
    
    return null;
  }

  /**
   * 創建基本的引用論文對象（當無法通過GROBID提取時使用）
   */
  private createBasicCitedPaper(citation: any): PaperMetadata {
    const citationId = this.generateCitationId(citation);
    
    return {
      id: citationId,
      title: citation.title || 'Unknown Title',
      authors: citation.authors || [],
      year: citation.year || 'Unknown',
      abstract: undefined,
      venue: undefined,
      citations: [] // 基本引用論文沒有進一步的引用信息
    };
  }

  /**
   * 測試整個流程
   */
  async testWorkflow(sampleUrls: string[] = [
    'https://arxiv.org/abs/1706.03762', // Transformer
    'https://arxiv.org/abs/2010.11929'  // Vision Transformer
  ]): Promise<GraphBuildResult> {
    console.log('\n=== Testing Complete Workflow ===');
    console.log('Sample papers:', sampleUrls);
    
    return await this.buildGraphFromUrls(sampleUrls);
  }
}
