/**
 * Paper Citation Service
 * 处理论文的引用关系（Prior Works 和 Derivative Works）
 */

import axios from 'axios';
import { AppDataSource } from '../config/database';
import { Paper } from '../entities/Paper';
import { PaperRelation } from '../entities/PaperRelation';
import { AdvancedCitationService } from './AdvancedCitationService';
import { SemanticScholarService } from './SemanticScholarService';

export interface PriorWork {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  abstract?: string;
  url?: string;
  citationContext?: string; // 引用上下文
  relationship?: string; // 关系类型（如 builds_on, extends）
  citationCount?: number; // 总引用数（从 Semantic Scholar 获取）
}

export interface DerivativeWork {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  abstract?: string;
  url?: string;
  citationCount?: number;
}

export class PaperCitationService {
  private get paperRepository() {
    return AppDataSource.getRepository(Paper);
  }

  private get relationRepository() {
    return AppDataSource.getRepository(PaperRelation);
  }

  private grobidService: AdvancedCitationService;

  constructor() {
    this.grobidService = new AdvancedCitationService();
  }

  /**
   * 获取论文的 Prior Works（这篇论文引用的论文）
   */
  async getPriorWorks(paperId: string): Promise<PriorWork[]> {
    try {
      const paper = await this.paperRepository.findOne({
        where: { id: paperId },
        relations: ['relations'],
      });

      if (!paper) {
        throw new Error(`Paper not found: ${paperId}`);
      }

      // 从 GROBID 提取的引用信息中获取 prior works
      // 这些信息应该已经在论文分析时存储在数据库中
      // 暂时从数据库的关系中获取，或者从 GROBID 重新提取

      // 方法1: 从数据库的关系表中查找（如果之前分析过）
      const relations = await this.relationRepository.find({
        where: { fromPaper: { id: paperId } },
        relations: ['toPaper'],
      });

      const priorWorks: PriorWork[] = relations.map((rel) => ({
        id: rel.toPaper.id,
        title: rel.toPaper.title,
        authors: rel.toPaper.authors,
        abstract: rel.toPaper.abstract,
        url: rel.toPaper.url,
        relationship: rel.relationship,
      }));

      // 如果数据库中没有，尝试从 GROBID 提取
      if (priorWorks.length === 0 && paper.url) {
        const citations = await this.extractCitationsFromPaper(paper.url);
        priorWorks.push(...citations);
      }

      return priorWorks;
    } catch (error) {
      console.error(`Error getting prior works for paper ${paperId}:`, error);
      throw error;
    }
  }

  /**
   * 获取论文的 Derivative Works（引用这篇论文的论文）
   */
  async getDerivativeWorks(paperId: string): Promise<DerivativeWork[]> {
    try {
      const paper = await this.paperRepository.findOne({
        where: { id: paperId },
      });

      if (!paper) {
        throw new Error(`Paper not found: ${paperId}`);
      }

      // 从数据库的关系表中查找引用当前论文的论文
      const relations = await this.relationRepository.find({
        where: { toPaper: { id: paperId } },
        relations: ['fromPaper'],
      });

      const derivativeWorks: DerivativeWork[] = relations.map((rel) => ({
        id: rel.fromPaper.id,
        title: rel.fromPaper.title,
        authors: rel.fromPaper.authors,
        abstract: rel.fromPaper.abstract,
        url: rel.fromPaper.url,
      }));

      // 如果数据库中没有，尝试从 Semantic Scholar API 获取
      if (derivativeWorks.length === 0 && paper.arxivId) {
        try {
          const citations = await SemanticScholarService.getCitingPapers(paper.arxivId);
          derivativeWorks.push(...citations);
        } catch (error) {
          console.warn('Failed to fetch citing papers from Semantic Scholar:', error);
        }
      }

      return derivativeWorks;
    } catch (error) {
      console.error(`Error getting derivative works for paper ${paperId}:`, error);
      throw error;
    }
  }

  /**
   * 从 GROBID 提取论文的引用信息
   */
  private async extractCitationsFromPaper(paperUrl: string): Promise<PriorWork[]> {
    try {
      const result = await this.grobidService.extractCitationsWithContextFiltered(paperUrl);
      
      if (!result.success || !result.citations) {
        return [];
      }

      return result.citations.map((citation) => ({
        id: citation.id || `citation_${Date.now()}_${Math.random()}`,
        title: citation.title || 'Unknown Title',
        authors: citation.authors || [],
        year: citation.year,
        citationContext: citation.context,
        url: this.inferPaperUrl(citation.title || ''),
      }));
    } catch (error) {
      console.error('Error extracting citations from paper:', error);
      return [];
    }
  }

  /**
   * 推断论文 URL（尝试从标题推断 arXiv ID）
   */
  private inferPaperUrl(title: string): string {
    if (!title) return '';
    
    // 尝试从标题中提取 arXiv ID（使用改进的 extractArxivId 方法）
    const arxivId = this.extractArxivId(title);
    if (arxivId) {
      return `https://arxiv.org/abs/${arxivId}`;
    }
    
    return '';
  }

  /**
   * 根据论文 URL 获取 Prior Works
   * 直接从 GROBID 提取，不依赖数据库
   * 尝试从 Semantic Scholar 获取 citationCount
   */
  async getPriorWorksFromUrl(paperUrl: string): Promise<PriorWork[]> {
    try {
      const result = await this.grobidService.extractCitationsWithContextFiltered(paperUrl);
      
      if (!result.success || !result.citations) {
        return [];
      }

      // 并行获取每个 citation 的额外信息（citationCount）
      console.log(`📚 Processing ${result.citations.length} citations to get citationCount...`);
      const priorWorksPromises = result.citations.map(async (citation, index) => {
        // 首先推断 URL（如果有的话）
        const inferredUrl = this.inferPaperUrl(citation.title || '');
        
        const priorWork: PriorWork = {
          id: citation.id || `citation_${Date.now()}_${Math.random()}`,
          title: citation.title || 'Unknown Title',
          authors: citation.authors || [],
          year: citation.year,
          citationContext: citation.context,
          url: inferredUrl,
        };

        // 尝试从 Semantic Scholar 获取 citationCount
        // 方法1: 尝试从 URL 中提取 arXiv ID
        let arxivId: string | null = null;
        if (inferredUrl) {
          arxivId = this.extractArxivId(inferredUrl);
        }
        
        // 方法2: 如果 URL 中没有，尝试从标题中提取 arXiv ID
        if (!arxivId && citation.title) {
          arxivId = this.extractArxivId(citation.title);
        }
        
        // 方法3: 尝试从引用上下文（context）中提取 arXiv ID
        if (!arxivId && citation.context) {
          arxivId = this.extractArxivId(citation.context);
        }
        
        // 方法4: 尝试从 contextBefore 和 contextAfter 中提取
        if (!arxivId && citation.contextBefore) {
          arxivId = this.extractArxivId(citation.contextBefore);
        }
        if (!arxivId && citation.contextAfter) {
          arxivId = this.extractArxivId(citation.contextAfter);
        }

        // 尝试从 Semantic Scholar 获取 citationCount
        let citationCount: number | undefined = undefined;
        
        // 方法1: 如果有 arXiv ID，优先使用 arXiv ID 查询
        if (arxivId) {
          try {
            console.log(`🔍 [Method 1] Fetching citation count for arXiv:${arxivId} (title: "${citation.title?.substring(0, 50)}...")`);
            const ssResult = await SemanticScholarService.queryByArxivId(arxivId);
            if (ssResult.success && ssResult.data && ssResult.data.citationCount !== undefined && ssResult.data.citationCount !== null) {
              citationCount = ssResult.data.citationCount;
              console.log(`✅ Found citation count via arXiv ID: ${citationCount} for "${citation.title?.substring(0, 50)}..."`);
            }
          } catch (error) {
            console.debug(`Failed to fetch citation count via arXiv ID for ${arxivId}:`, error);
          }
        }
        
        // 方法2: 如果没有找到或没有 arXiv ID，尝试通过标题和作者搜索
        if (citationCount === undefined || citationCount === null) {
          try {
            console.log(`🔍 [Method 2] Searching by title and authors for: "${citation.title?.substring(0, 50)}..." (authors: ${citation.authors?.slice(0, 2).join(', ') || 'none'}, year: ${citation.year || 'none'})`);
            const searchResult = await SemanticScholarService.queryByTitleAndAuthors(
              citation.title || '',
              citation.authors || [],
              citation.year
            );
            if (searchResult.success && searchResult.data) {
              // 如果搜索成功，尝试从返回的数据中提取 arxiv ID
              let extractedArxivId: string | null = null;
              if (searchResult.data.url) {
                extractedArxivId = this.extractArxivId(searchResult.data.url);
                if (extractedArxivId && !arxivId) {
                  arxivId = extractedArxivId;
                  console.log(`✅ Extracted arXiv ID from Semantic Scholar URL: ${arxivId}`);
                }
              }
              
              // 如果从 paperId 中也能提取 arxiv ID
              if (!extractedArxivId && searchResult.data.paperId) {
                extractedArxivId = this.extractArxivId(searchResult.data.paperId);
                if (extractedArxivId && !arxivId) {
                  arxivId = extractedArxivId;
                  console.log(`✅ Extracted arXiv ID from Semantic Scholar paperId: ${arxivId}`);
                }
              }
              
              // 如果找到了新的 arxiv ID 但还没有 citationCount，尝试用这个 ID 查询
              if (arxivId && (citationCount === undefined || citationCount === null)) {
                console.log(`🔍 Found arXiv ID ${arxivId} from search, querying directly for citationCount...`);
                try {
                  const directResult = await SemanticScholarService.queryByArxivId(arxivId);
                  if (directResult.success && directResult.data?.citationCount !== undefined && directResult.data.citationCount !== null) {
                    citationCount = directResult.data.citationCount;
                    console.log(`✅ Found citation count via extracted arXiv ID: ${citationCount}`);
                  }
                } catch (error) {
                  console.debug(`Failed to query with extracted arXiv ID:`, error instanceof Error ? error.message : 'Unknown error');
                }
              }
              
              // 更新 URL 如果找到了更好的 URL
              if (searchResult.data.url && !priorWork.url) {
                priorWork.url = searchResult.data.url;
              }
              
              // 获取 citationCount
              if (searchResult.data.citationCount !== undefined && searchResult.data.citationCount !== null) {
                citationCount = searchResult.data.citationCount;
                console.log(`✅ Found citation count via title search: ${citationCount} for "${citation.title?.substring(0, 50)}..."`);
              } else {
                // 如果标题搜索找到了匹配但没有 citationCount，尝试多种方式查询
                if (searchResult.data.paperId || searchResult.data.url) {
                  console.log(`🔍 Found match but no citationCount, attempting multiple query methods...`);
                  
                  // 方法1: 直接用 paperId 查询（最可靠的方法）
                  if (searchResult.data.paperId && (citationCount === undefined || citationCount === null)) {
                    try {
                      console.log(`🔍 [Method 1] Querying directly by paperId: ${searchResult.data.paperId}`);
                      const paperIdResult = await SemanticScholarService.queryByPaperId(searchResult.data.paperId);
                      if (paperIdResult.success && paperIdResult.data?.citationCount !== undefined && paperIdResult.data.citationCount !== null) {
                        citationCount = paperIdResult.data.citationCount;
                        console.log(`✅ Found citation count via direct paperId query: ${citationCount}`);
                      }
                    } catch (error) {
                      console.debug(`Failed to query by paperId:`, error instanceof Error ? error.message : 'Unknown error');
                    }
                  }
                  
                  // 方法2: 如果有 URL，尝试提取 arxiv ID 并查询
                  if (searchResult.data.url && (citationCount === undefined || citationCount === null)) {
                    try {
                      const urlArxivId = this.extractArxivId(searchResult.data.url);
                      if (urlArxivId) {
                        console.log(`🔍 [Method 2] Extracted arXiv ID from URL: ${urlArxivId}`);
                        const directResult = await SemanticScholarService.queryByArxivId(urlArxivId);
                        if (directResult.success && directResult.data?.citationCount !== undefined && directResult.data.citationCount !== null) {
                          citationCount = directResult.data.citationCount;
                          console.log(`✅ Found citation count via direct arXiv query: ${citationCount}`);
                        }
                      }
                    } catch (error) {
                      console.debug(`Failed to query via arXiv URL:`, error instanceof Error ? error.message : 'Unknown error');
                    }
                  }
                  
                  // 方法3: 如果 paperId 本身是 arXiv ID 格式，尝试查询
                  if ((citationCount === undefined || citationCount === null) && searchResult.data.paperId) {
                    try {
                      const paperIdArxivId = this.extractArxivId(searchResult.data.paperId);
                      if (paperIdArxivId && paperIdArxivId !== arxivId) {
                        console.log(`🔍 [Method 3] Extracted arXiv ID from paperId: ${paperIdArxivId}`);
                        const directResult = await SemanticScholarService.queryByArxivId(paperIdArxivId);
                        if (directResult.success && directResult.data?.citationCount !== undefined && directResult.data.citationCount !== null) {
                          citationCount = directResult.data.citationCount;
                          console.log(`✅ Found citation count via paperId arXiv query: ${citationCount}`);
                        }
                      }
                    } catch (error) {
                      console.debug(`Failed to query via arXiv paperId:`, error instanceof Error ? error.message : 'Unknown error');
                    }
                  }
                }
              }
              
              if (citationCount === undefined || citationCount === null) {
                console.warn(`⚠️  Title search found match but no citationCount for "${citation.title?.substring(0, 50)}..."`);
              }
            } else {
              console.warn(`⚠️  Title search failed for "${citation.title?.substring(0, 50)}...": ${searchResult.error || 'No match found'}`);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`⚠️  Exception during title search for "${citation.title?.substring(0, 50)}...": ${errorMsg}`);
          }
        }
        
        // 设置 citationCount（如果有的话）
        if (citationCount !== undefined && citationCount !== null) {
          priorWork.citationCount = citationCount;
          console.log(`✅ [${index + 1}/${result.citations.length}] Citation count for "${citation.title?.substring(0, 50)}...": ${citationCount}`);
        } else {
          console.warn(`⚠️  [${index + 1}/${result.citations.length}] Could not find citation count for: "${citation.title?.substring(0, 50)}..." (arXiv ID: ${arxivId || 'none'})`);
        }

        return priorWork;
      });

      const priorWorks = await Promise.all(priorWorksPromises);
      const withCitationCount = priorWorks.filter(w => w.citationCount !== undefined && w.citationCount !== null).length;
      console.log(`📊 Prior works summary: ${priorWorks.length} total, ${withCitationCount} with citationCount`);
      return priorWorks;
    } catch (error) {
      console.error('Error getting prior works from URL:', error);
      throw error;
    }
  }

  /**
   * 根据论文 URL 获取 Derivative Works
   * 使用 Semantic Scholar API 查找引用这篇论文的其他论文
   * 支持多种查找方式：arXiv ID、paperId、标题+作者+年份
   */
  async getDerivativeWorksFromUrl(paperUrl: string): Promise<DerivativeWork[]> {
    try {
      let citingPapers: Array<{
        id: string;
        title: string;
        authors: string[];
        year?: string;
        abstract?: string;
        url?: string;
        citationCount?: number;
      }> = [];

      // 方法1: 尝试通过 arXiv ID 查找
      const arxivId = this.extractArxivId(paperUrl);
      if (arxivId) {
        console.log(`🔍 [Derivative Works] Trying to find citing papers via arXiv ID: ${arxivId}`);
        citingPapers = await SemanticScholarService.getAllCitingPapers(arxivId, {
          maxResults: 500, // 增加默认值到500篇引用论文
          pagesToFetch: 10, // 增加默认值到10页（每页100篇）
          fetchAllAvailable: false // 如果论文引用数很多，可以考虑设为 true 来获取所有
        });
      }

      // 方法2: 如果没有结果或结果太少，尝试通过其他方式找到 paperId
      if (citingPapers.length === 0) {
        console.log(`🔍 [Derivative Works] No results via arXiv ID, trying alternative methods...`);
        try {
          // 方法2a: 如果 paperUrl 是 Semantic Scholar URL，直接提取 paperId
          const semanticScholarMatch = paperUrl.match(/semanticscholar\.org\/paper\/([^\/\?]+)/i);
          if (semanticScholarMatch && semanticScholarMatch[1]) {
            const paperId = semanticScholarMatch[1];
            console.log(`🔍 [Derivative Works] Found paperId from Semantic Scholar URL: ${paperId}`);
            citingPapers = await SemanticScholarService.getAllCitingPapers(paperId, {
              maxResults: 500,
              pagesToFetch: 10,
              fetchAllAvailable: false
            });
          }
          
          // 方法2b: 如果还是没有结果，尝试通过 GROBID 提取论文信息，然后搜索 Semantic Scholar 获取 paperId
          if (citingPapers.length === 0) {
            console.log(`🔍 [Derivative Works] Trying to extract paper info via GROBID and search Semantic Scholar...`);
            try {
              const grobidResult = await this.grobidService.extractCitationsWithContextFiltered(paperUrl);
              if (grobidResult.success && grobidResult.paperTitle) {
                console.log(`🔍 [Derivative Works] Extracted title: "${grobidResult.paperTitle}"`);
                const searchResult = await SemanticScholarService.queryByTitleAndAuthors(
                  grobidResult.paperTitle,
                  grobidResult.paperAuthors || [],
                  grobidResult.paperYear
                );
                
                if (searchResult.success && searchResult.data?.paperId) {
                  const paperId = searchResult.data.paperId;
                  console.log(`✅ [Derivative Works] Found paperId via title search: ${paperId}`);
                  citingPapers = await SemanticScholarService.getAllCitingPapers(paperId, {
                    maxResults: 200,
                    pagesToFetch: 3
                  });
                }
              }
            } catch (error) {
              console.debug(`Failed to find paperId via GROBID extraction:`, error instanceof Error ? error.message : 'Unknown error');
            }
          }
        } catch (error) {
          console.debug(`Failed to find paperId via alternative methods:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // 如果还是没有结果，返回空数组
      if (citingPapers.length === 0) {
        console.warn(`⚠️  Could not find any citing papers for: ${paperUrl}`);
        return [];
      }

      console.log(`📊 [Derivative Works] Found ${citingPapers.length} potential citing papers, processing citationCount...`);
      
      // If many papers are missing citationCount, try to fetch them individually using paperId
      const derivativeWorksPromises = citingPapers.map(async (paper: any) => {
        let citationCount = paper.citationCount;
        
        // If citationCount is missing, try multiple methods to fetch it
        if ((citationCount === undefined || citationCount === null)) {
          // Method 1: Use paperId to query individual paper details directly
          if (paper.id) {
            try {
              console.log(`🔍 [Derivative Works] Querying by paperId: ${paper.id} for "${paper.title?.substring(0, 40)}..."`);
              const paperIdResult = await SemanticScholarService.queryByPaperId(paper.id);
              if (paperIdResult.success && paperIdResult.data?.citationCount !== undefined && paperIdResult.data.citationCount !== null) {
                citationCount = paperIdResult.data.citationCount;
                console.log(`✅ [Derivative Works] Found citationCount via paperId query: ${citationCount} for "${paper.title?.substring(0, 40)}..."`);
              }
            } catch (error) {
              console.debug(`Failed to fetch citationCount via paperId for ${paper.id}:`, error instanceof Error ? error.message : 'Unknown error');
            }
          }
          
          // Method 2: If still not found and we have URL, try extracting arXiv ID from URL
          if ((citationCount === undefined || citationCount === null) && paper.url) {
            try {
              const urlArxivId = this.extractArxivId(paper.url);
              if (urlArxivId) {
                console.log(`🔍 [Derivative Works] Extracted arXiv ID from URL: ${urlArxivId} for "${paper.title?.substring(0, 40)}..."`);
                const arxivResult = await SemanticScholarService.queryByArxivId(urlArxivId);
                if (arxivResult.success && arxivResult.data?.citationCount !== undefined && arxivResult.data.citationCount !== null) {
                  citationCount = arxivResult.data.citationCount;
                  console.log(`✅ [Derivative Works] Found citationCount via arXiv ID: ${citationCount} for "${paper.title?.substring(0, 40)}..."`);
                }
              }
            } catch (error) {
              console.debug(`Failed to fetch citationCount via arXiv URL:`, error instanceof Error ? error.message : 'Unknown error');
            }
          }
          
          // Method 3: If still not found, try searching by title + authors + year (fallback)
          if ((citationCount === undefined || citationCount === null) && paper.title && paper.authors && paper.authors.length > 0) {
            try {
              console.log(`🔍 [Derivative Works] Searching by title+authors+year for "${paper.title?.substring(0, 40)}..."`);
              const searchResult = await SemanticScholarService.queryByTitleAndAuthors(
                paper.title,
                paper.authors,
                paper.year
              );
              if (searchResult.success && searchResult.data?.citationCount !== undefined && searchResult.data.citationCount !== null) {
                citationCount = searchResult.data.citationCount;
                console.log(`✅ [Derivative Works] Found citationCount via title search: ${citationCount} for "${paper.title?.substring(0, 40)}..."`);
              }
            } catch (error) {
              console.debug(`Failed to search by title for derivative work:`, error instanceof Error ? error.message : 'Unknown error');
            }
          }
        }
        
        return {
          id: paper.id || `paper_${Date.now()}_${Math.random()}`,
          title: paper.title || 'Unknown Title',
          authors: paper.authors || [],
          year: paper.year,
          abstract: paper.abstract,
          url: paper.url,
          citationCount: citationCount,
        };
      });
      
      const derivativeWorks = await Promise.all(derivativeWorksPromises);
      
      const withCitationCount = derivativeWorks.filter(w => w.citationCount !== undefined && w.citationCount !== null).length;
      console.log(`📊 Derivative works summary: ${derivativeWorks.length} total, ${withCitationCount} with citationCount`);
      
      // Log papers without citationCount for debugging
      const withoutCitationCount = derivativeWorks.filter(w => w.citationCount === undefined || w.citationCount === null);
      if (withoutCitationCount.length > 0) {
        console.warn(`⚠️  ${withoutCitationCount.length} derivative works without citationCount:`, 
          withoutCitationCount.map(w => `"${w.title?.substring(0, 40)}..."`).join(', '));
      }
      
      return derivativeWorks;
    } catch (error) {
      console.error('Error getting derivative works from URL:', error);
      // 如果 Semantic Scholar 失败，返回空数组
      return [];
    }
  }

  /**
   * 从 URL 或文本中提取 arXiv ID
   * 支持多种格式：
   * - URL: https://arxiv.org/abs/2305.10403
   * - URL: https://arxiv.org/pdf/2305.10403.pdf
   * - 带前缀: arXiv:2305.10403
   * - 带分类: 2305.10403[cs.CL] 或 arXiv:2305.10403[cs.CL]
   * - 带版本号: 2305.10403v1
   * - 旧格式: 2305.1234 (4位年份，4位数字)
   * - 新格式: 2305.10403 (4位年份，5位数字)
   */
  private extractArxivId(input: string): string | null {
    if (!input || typeof input !== 'string') {
      return null;
    }

    // 模式1: URL 格式 (https://arxiv.org/abs/2305.10403 等)
    const urlPatterns = [
      /arxiv\.org\/abs\/([^\/\?\s]+)/i,
      /arxiv\.org\/pdf\/([^\/\?\s]+)/i,
      /arxiv\.org\/html\/([^\/\?\s]+)/i,
      /arxiv\.org\/e-print\/([^\/\?\s]+)/i,
      /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i,
      /arxiv\.org\/pdf\/(\d{4}\.\d{4,5})/i,
    ];

    for (const pattern of urlPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        let arxivId = match[1].replace(/\.pdf$/i, ''); // 移除 .pdf 后缀
        // 移除可能的版本号 v1, v2 等
        arxivId = arxivId.replace(/v\d+$/i, '');
        // 移除可能的分类标签 [cs.CL] 等
        arxivId = arxivId.replace(/\[.*?\]$/, '');
        // 验证格式
        if (/^\d{4}\.\d{4,5}$/.test(arxivId)) {
          return arxivId;
        }
      }
    }

    // 模式2: arXiv:前缀格式 (arXiv:2305.10403 或 arXiv:2305.10403v1 或 arXiv:2305.10403[cs.CL])
    const arxivPrefixMatch = input.match(/(?:arXiv:)?(\d{4}\.\d{4,5})(?:v\d+)?(?:\[[^\]]+\])?/i);
    if (arxivPrefixMatch && arxivPrefixMatch[1]) {
      return arxivPrefixMatch[1];
    }

    // 模式3: 直接匹配 arXiv ID 格式（支持新格式 YYYY.NNNNN 和旧格式 YYMM.NNNN）
    // 新格式: 4位年份 + 点 + 4-5位数字 (例如: 2305.10403, 2001.12345)
    // 旧格式: 4位年月 + 点 + 4位数字 (例如: 9701.1234)
    const directMatch = input.match(/(\d{4}\.\d{4,5})(?:v\d+)?(?:\[[^\]]+\])?/);
    if (directMatch && directMatch[1]) {
      const arxivId = directMatch[1];
      // 验证是否为有效的 arXiv ID 格式
      // 新格式: YYYY.MMMMM (2007年以后)
      // 旧格式: YYMM.NNNN (1991-2007年)
      if (/^\d{4}\.\d{4,5}$/.test(arxivId)) {
        const year = parseInt(arxivId.substring(0, 4));
        // 新格式: 年份应该是 2007 或更大
        // 旧格式: 前两位应该是月份（01-12），第三四位应该是年份（91-07）
        if (year >= 2007 || (year >= 9101 && year <= 9912)) {
          return arxivId;
        }
        // 对于 2000-2006 之间的，可能是旧格式
        if (year >= 2000 && year < 2007) {
          const month = parseInt(arxivId.substring(4, 6));
          if (month >= 1 && month <= 12) {
            return arxivId; // 可能是旧格式
          }
        }
      }
    }

    // 模式4: 在文本中查找 arXiv ID（可能在句子中间）
    // 查找形如 "2305.10403" 的数字格式
    const textMatch = input.match(/\b(\d{4}\.\d{4,5})(?:v\d+)?(?:\[[^\]]+\])?\b/);
    if (textMatch && textMatch[1]) {
      const arxivId = textMatch[1];
      if (/^\d{4}\.\d{4,5}$/.test(arxivId)) {
        return arxivId;
      }
    }

    return null;
  }
}

