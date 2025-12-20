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
  arxivId?: string; // arXiv ID
  citationContext?: string; // 引用上下文
  relationship?: string; // 关系类型（如 builds_on, extends）
  citationCount?: number; // 总引用数（从 Semantic Scholar 获取）
  section?: string; // 引用所在的章节（如 Introduction, Related Work）
}

export interface DerivativeWork {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  abstract?: string;
  url?: string;
  arxivId?: string; // arXiv ID
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
   * Remove duplicate citations based on title, authors, and year
   * Normalizes titles and author lists for comparison
   */
  private removeDuplicateCitations(citations: PriorWork[]): PriorWork[] {
    const normalizeTitle = (title: string): string => {
      return title
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[^\w\s]/g, '') // Remove punctuation for comparison
        .trim();
    };

    const normalizeAuthors = (authors: string[]): string[] => {
      return authors
        .map(a => a.trim().toLowerCase())
        .filter(a => a.length > 0)
        .sort(); // Sort to handle different orders
    };

    const areAuthorsSimilar = (authors1: string[], authors2: string[]): boolean => {
      const normalized1 = normalizeAuthors(authors1);
      const normalized2 = normalizeAuthors(authors2);
      
      // If both have no authors, consider them similar
      if (normalized1.length === 0 && normalized2.length === 0) {
        return true;
      }
      
      // If one has authors and the other doesn't, they're not similar
      if (normalized1.length === 0 || normalized2.length === 0) {
        return false;
      }
      
      // Check if all authors match (exact match)
      if (normalized1.length === normalized2.length && 
          normalized1.every((a, i) => a === normalized2[i])) {
        return true;
      }
      
      // Check if they share at least 2 authors (for papers with many authors)
      // Or if one list is a subset of the other (handles cases where one has fewer authors listed)
      const commonAuthors = normalized1.filter(a => normalized2.includes(a));
      const minLength = Math.min(normalized1.length, normalized2.length);
      if (commonAuthors.length >= Math.min(2, minLength) || 
          commonAuthors.length === minLength) {
        return true;
      }
      
      return false;
    };

    const isDuplicate = (c1: PriorWork, c2: PriorWork): boolean => {
      // Compare normalized titles
      const title1 = normalizeTitle(c1.title);
      const title2 = normalizeTitle(c2.title);
      
      if (title1 !== title2) {
        return false;
      }
      
      // If titles match, compare years (if both have years, they must match)
      if (c1.year && c2.year && c1.year !== c2.year) {
        return false; // Different years, not a duplicate
      }
      
      // Compare authors
      return areAuthorsSimilar(c1.authors || [], c2.authors || []);
    };

    const uniqueCitations: PriorWork[] = [];
    
    for (const citation of citations) {
      // Check if this citation is a duplicate of any already in uniqueCitations
      let foundDuplicate = false;
      let duplicateIndex = -1;
      
      for (let i = 0; i < uniqueCitations.length; i++) {
        if (isDuplicate(citation, uniqueCitations[i])) {
          foundDuplicate = true;
          duplicateIndex = i;
          break;
        }
      }
      
      if (foundDuplicate && duplicateIndex >= 0) {
        // Compare and keep the one with more information
        const existing = uniqueCitations[duplicateIndex];
        const shouldReplace = 
          (citation.authors.length > existing.authors.length) ||
          (citation.url && !existing.url) ||
          (citation.citationCount !== undefined && existing.citationCount !== undefined && citation.citationCount > existing.citationCount) ||
          (citation.citationCount !== undefined && existing.citationCount === undefined);
        
        if (shouldReplace) {
          uniqueCitations[duplicateIndex] = citation;
          console.log(`🔄 Replacing duplicate citation "${citation.title.substring(0, 50)}..." with more complete version`);
        } else {
          console.log(`🔄 Skipping duplicate citation "${citation.title.substring(0, 50)}..."`);
        }
      } else {
        // New unique citation
        uniqueCitations.push(citation);
      }
    }
    
    console.log(`✅ Removed ${citations.length - uniqueCitations.length} duplicate citations (${uniqueCitations.length} unique remaining)`);
    
    return uniqueCitations;
  }

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
          section: citation.section, // Include section information for filtering
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
            // Only use first few authors for search to avoid query being too long
            const authorsForSearch = citation.authors && citation.authors.length > 0 
              ? citation.authors.slice(0, 3) // Use first 3 authors only
              : [];
            
            let searchResult = await SemanticScholarService.queryByTitleAndAuthors(
              citation.title || '',
              authorsForSearch,
              citation.year
            );
            
            // 如果搜索失败，尝试只用标题搜索（不带作者）
            if (!searchResult.success && citation.title) {
              console.log(`🔍 [Method 2b] Title+author search failed, trying title-only search...`);
              searchResult = await SemanticScholarService.queryByTitleAndAuthors(
                citation.title,
                [], // No authors
                citation.year
              );
            }
            
            // 如果还是失败，尝试只用标题的前几个关键词
            if (!searchResult.success && citation.title) {
              console.log(`🔍 [Method 2c] Title-only search failed, trying with first 5 keywords...`);
              const titleWords = citation.title.split(/\s+/).filter(w => w.length > 2).slice(0, 5).join(' ');
              if (titleWords.length > 10) {
                searchResult = await SemanticScholarService.queryByTitleAndAuthors(
                  titleWords,
                  [],
                  citation.year
                );
              }
            }
            
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
              // 首先记录搜索返回的 citationCount（但不立即使用，优先使用paperId查询的结果）
              let searchCitationCount: number | undefined = undefined;
              if (searchResult.data.citationCount !== undefined && searchResult.data.citationCount !== null) {
                searchCitationCount = searchResult.data.citationCount;
                console.log(`ℹ️  Title search returned citationCount: ${searchCitationCount} for "${citation.title?.substring(0, 50)}..."`);
              }
              
              // 🚀 FIXED: Always query by paperId if available, even if search returned citationCount
              // This is the most reliable method - paperId queries always return accurate citationCount
              // Even if search returned 0, we should verify with paperId query since it's more reliable
              if (searchResult.data.paperId) {
                try {
                  console.log(`🔍 [Method 2d] Querying by paperId (most reliable method): ${searchResult.data.paperId}`);
                  const paperIdResult = await SemanticScholarService.queryByPaperId(searchResult.data.paperId);
                  if (paperIdResult.success && paperIdResult.data?.citationCount !== undefined && paperIdResult.data.citationCount !== null) {
                    // Always use paperId result if available, as it's most reliable
                    citationCount = paperIdResult.data.citationCount;
                    console.log(`✅ Found citation count via paperId query: ${citationCount} for "${citation.title?.substring(0, 50)}..."`);
                  } else {
                    // If paperId query didn't return citationCount, fall back to search result
                    if (searchCitationCount !== undefined && searchCitationCount !== null) {
                      citationCount = searchCitationCount;
                      console.log(`ℹ️  Using citationCount from search (paperId query didn't return it): ${citationCount}`);
                    }
                  }
                } catch (error) {
                  console.debug(`Failed to query by paperId:`, error instanceof Error ? error.message : 'Unknown error');
                  // If paperId query fails, use the citationCount from search if available
                  if (searchCitationCount !== undefined && searchCitationCount !== null) {
                    citationCount = searchCitationCount;
                    console.log(`ℹ️  Using citationCount from search (paperId query failed): ${citationCount}`);
                }
                }
              } else if (searchCitationCount !== undefined && searchCitationCount !== null) {
                // If no paperId available, use search result
                citationCount = searchCitationCount;
                console.log(`✅ Using citation count from title search: ${citationCount} (no paperId available)`);
              }
              
              // 如果还是没有找到 citationCount，尝试其他方法（只有当是undefined/null时才尝试，不包括0）
              if (citationCount === undefined || citationCount === null) {
                if (searchResult.data.paperId || searchResult.data.url) {
                  console.log(`🔍 Found match but citationCount still missing, attempting additional query methods...`);
                  
                  // 方法1: 如果有 URL，尝试提取 arxiv ID 并查询
                  if (searchResult.data.url) {
                    try {
                      const urlArxivId = this.extractArxivId(searchResult.data.url);
                      if (urlArxivId) {
                        console.log(`🔍 [Method 2e] Extracted arXiv ID from URL: ${urlArxivId}`);
                        const directResult = await SemanticScholarService.queryByArxivId(urlArxivId);
                        if (directResult.success && directResult.data?.citationCount !== undefined && directResult.data.citationCount !== null) {
                          citationCount = directResult.data.citationCount;
                          console.log(`✅ Found citation count via URL arXiv query: ${citationCount}`);
                        }
                      }
                    } catch (error) {
                      console.debug(`Failed to query via arXiv URL:`, error instanceof Error ? error.message : 'Unknown error');
                    }
                  }
                  
                  // 方法2: 如果 paperId 本身是 arXiv ID 格式，尝试查询
                  if ((citationCount === undefined || citationCount === null) && searchResult.data.paperId) {
                    try {
                      const paperIdArxivId = this.extractArxivId(searchResult.data.paperId);
                      if (paperIdArxivId && paperIdArxivId !== arxivId) {
                        console.log(`🔍 [Method 2f] Extracted arXiv ID from paperId: ${paperIdArxivId}`);
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
              
                  // 方法3: 如果仍然没有citationCount，再次尝试用paperId查询（可能之前查询时API暂时失败）
                  if ((citationCount === undefined || citationCount === null) && searchResult.data.paperId) {
                    try {
                      console.log(`🔍 [Method 2h] Retrying paperId query as fallback: ${searchResult.data.paperId}`);
                      // Wait a bit before retry to avoid rate limiting
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      const retryResult = await SemanticScholarService.queryByPaperId(searchResult.data.paperId);
                      if (retryResult.success && retryResult.data?.citationCount !== undefined && retryResult.data.citationCount !== null) {
                        citationCount = retryResult.data.citationCount;
                        console.log(`✅ Found citation count via paperId retry: ${citationCount}`);
                      }
                    } catch (error) {
                      console.debug(`Retry paperId query failed:`, error instanceof Error ? error.message : 'Unknown error');
                    }
                  }
                  
                  // 方法4: 尝试使用更宽松的标题搜索（只匹配主要关键词）
                  if ((citationCount === undefined || citationCount === null) && citation.title) {
                    try {
                      console.log(`🔍 [Method 2i] Trying very loose title search with main keywords only...`);
                      // Extract first 3-4 significant words (length > 3)
                      const mainKeywords = citation.title.split(/\s+/)
                        .filter(w => w.length > 3)
                        .slice(0, 4)
                        .join(' ');
                      if (mainKeywords.length > 10) {
                        await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limit delay
                        const looseSearchResult = await SemanticScholarService.queryByTitleAndAuthors(
                          mainKeywords,
                          [],
                          citation.year
                        );
                        if (looseSearchResult.success && looseSearchResult.data) {
                          // Check if this is likely the same paper
                          const normalizedTitle1 = (citation.title || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
                          const normalizedTitle2 = (looseSearchResult.data.title || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
                          const titleSimilarity = this.calculateTitleSimilarity(normalizedTitle1, normalizedTitle2);
                          
                          if (titleSimilarity > 0.3) { // Accept if similarity > 30%
                            // Try paperId query first (most reliable)
                            if (looseSearchResult.data.paperId) {
                              try {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                const loosePaperIdResult = await SemanticScholarService.queryByPaperId(looseSearchResult.data.paperId);
                                if (loosePaperIdResult.success && loosePaperIdResult.data?.citationCount !== undefined && loosePaperIdResult.data.citationCount !== null) {
                                  citationCount = loosePaperIdResult.data.citationCount;
                                  console.log(`✅ Found citation count via loose search + paperId: ${citationCount}`);
                                }
                              } catch (error) {
                                console.debug(`Loose search paperId query failed:`, error instanceof Error ? error.message : 'Unknown error');
                              }
                            }
                            
                            // Fallback to search result citationCount
                            if ((citationCount === undefined || citationCount === null) && looseSearchResult.data.citationCount !== undefined && looseSearchResult.data.citationCount !== null) {
                              citationCount = looseSearchResult.data.citationCount;
                              console.log(`✅ Found citation count via loose search: ${citationCount}`);
                            }
                          }
                        }
                      }
                    } catch (error) {
                      console.debug(`Loose title search failed:`, error instanceof Error ? error.message : 'Unknown error');
                    }
                  }
                }
              }
              
              // 如果还是没有找到，记录警告（但不包括0，因为0可能是真实的）
              if (citationCount === undefined || citationCount === null) {
                console.warn(`⚠️  [Prior Works] All methods failed to find citationCount for "${citation.title?.substring(0, 50)}..." (paperId: ${searchResult.data?.paperId || 'none'}, URL: ${searchResult.data?.url || 'none'})`);
              } else if (citationCount === 0) {
                console.log(`ℹ️  [Prior Works] CitationCount is 0 for "${citation.title?.substring(0, 50)}..." (this may be accurate for very new papers)`);
              }
            } else {
              console.warn(`⚠️  [Prior Works] Title search failed for "${citation.title?.substring(0, 50)}...": ${searchResult.error || 'No match found'}`);
              
              // 如果所有搜索都失败，尝试最后一次：只用标题的前几个词（更宽松的搜索）
              if (citation.title && citation.title.length > 10) {
                try {
                  console.log(`🔍 [Method 2g] Last attempt: searching with first 3-5 words of title...`);
                  const titleWords = citation.title.split(/\s+/).filter(w => w.length > 2).slice(0, 5).join(' ');
                  if (titleWords.length > 10) {
                    const lastAttemptResult = await SemanticScholarService.queryByTitleAndAuthors(
                      titleWords,
                      [],
                      citation.year
                    );
                    if (lastAttemptResult.success && lastAttemptResult.data) {
                      // 如果找到了，尝试用 paperId 查询
                      // Only try paperId query if citationCount is still undefined/null (not if it's 0)
                      if (lastAttemptResult.data.paperId && (citationCount === undefined || citationCount === null)) {
                        try {
                          const lastPaperIdResult = await SemanticScholarService.queryByPaperId(lastAttemptResult.data.paperId);
                          if (lastPaperIdResult.success && lastPaperIdResult.data?.citationCount !== undefined && lastPaperIdResult.data.citationCount !== null) {
                            citationCount = lastPaperIdResult.data.citationCount;
                            console.log(`✅ Found citation count via last attempt paperId query: ${citationCount}`);
                          }
                        } catch (error) {
                          console.debug(`Last attempt paperId query failed:`, error instanceof Error ? error.message : 'Unknown error');
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.debug(`Last attempt search failed:`, error instanceof Error ? error.message : 'Unknown error');
                }
              }
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`⚠️  Exception during title search for "${citation.title?.substring(0, 50)}...": ${errorMsg}`);
          }
        }
        
        // Ensure authors is a proper array with all authors
        let finalAuthors: string[] = [];
        if (citation.authors && Array.isArray(citation.authors)) {
          finalAuthors = citation.authors.map((author: any) => {
            if (typeof author === 'string') {
              return author;
            } else if (author && typeof author === 'object' && author.name) {
              return author.name;
            }
            return String(author || '');
          }).filter((name: string) => name && name.length > 0);
        }
        
        // 🚀 FINAL FALLBACK: If still no citationCount, try one last comprehensive attempt
        // This is a last resort before giving up
        if (citationCount === undefined || citationCount === null) {
          console.log(`🔍 [Method FINAL] Final comprehensive attempt to find citationCount for "${citation.title?.substring(0, 50)}..."`);
          
          // Strategy 1: Try searching with just the first significant words (very loose match)
          if (citation.title && citation.title.length > 15) {
            try {
              const firstWords = citation.title.split(/\s+/).filter(w => w.length > 4).slice(0, 3).join(' ');
              if (firstWords.length > 10) {
                console.log(`🔍 [Method FINAL-1] Trying with first significant words: "${firstWords}"`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for final attempt
                
                const finalSearchResult = await SemanticScholarService.queryByTitleAndAuthors(
                  firstWords,
                  citation.authors?.slice(0, 1) || [], // Just first author
                  citation.year
                );
                
                if (finalSearchResult.success && finalSearchResult.data) {
                  // If we got a paperId, always try querying it
                  if (finalSearchResult.data.paperId) {
                    try {
                      await new Promise(resolve => setTimeout(resolve, 1500));
                      const finalPaperIdResult = await SemanticScholarService.queryByPaperId(finalSearchResult.data.paperId);
                      if (finalPaperIdResult.success && finalPaperIdResult.data?.citationCount !== undefined && finalPaperIdResult.data.citationCount !== null) {
                        citationCount = finalPaperIdResult.data.citationCount;
                        console.log(`✅ [Method FINAL] Found citationCount via comprehensive search: ${citationCount}`);
                      }
                    } catch (error) {
                      console.debug(`Final paperId query failed:`, error instanceof Error ? error.message : 'Unknown error');
                    }
                  }
                  
                  // If still no citationCount, use the search result (even if 0)
                  if ((citationCount === undefined || citationCount === null) && finalSearchResult.data.citationCount !== undefined && finalSearchResult.data.citationCount !== null) {
                    citationCount = finalSearchResult.data.citationCount;
                    console.log(`✅ [Method FINAL] Using citationCount from comprehensive search: ${citationCount}`);
                  }
                }
              }
            } catch (error) {
              console.debug(`Final comprehensive search failed:`, error instanceof Error ? error.message : 'Unknown error');
            }
          }
          
          // Strategy 2: If we have any URL or identifier, try extracting and querying one more time
          if ((citationCount === undefined || citationCount === null) && (priorWork.url || arxivId)) {
            const urlToCheck = priorWork.url || (arxivId ? `arxiv.org/abs/${arxivId}` : null);
            if (urlToCheck) {
              try {
                console.log(`🔍 [Method FINAL-2] Final attempt with URL/identifier: ${urlToCheck}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const finalUrlArxivId = this.extractArxivId(urlToCheck);
                if (finalUrlArxivId) {
                  const finalArxivResult = await SemanticScholarService.queryByArxivId(finalUrlArxivId);
                  if (finalArxivResult.success && finalArxivResult.data?.citationCount !== undefined && finalArxivResult.data.citationCount !== null) {
                    citationCount = finalArxivResult.data.citationCount;
                    console.log(`✅ [Method FINAL] Found citationCount via final arXiv query: ${citationCount}`);
                  }
                }
              } catch (error) {
                console.debug(`Final URL/arXiv query failed:`, error instanceof Error ? error.message : 'Unknown error');
              }
            }
          }
        }
        
        // 🚀 FINAL DECISION: If we STILL don't have a citationCount, drop this entry (do not return it)
        const finalCitationCount = (citationCount !== undefined && citationCount !== null && typeof citationCount === 'number' && citationCount >= 0)
          ? citationCount
          : undefined;
        
        if (finalCitationCount === undefined) {
          console.warn(`⚠️  [Prior Works ${index + 1}/${result.citations.length}] Dropping citation; citationCount not found after all attempts: "${citation.title?.substring(0, 50)}..."`);
          return null; // Filter out later
        }
        
        // Log final data for debugging
        if (finalCitationCount === 0) {
          console.log(`ℹ️  [Prior Works ${index + 1}/${result.citations.length}] CitationCount is 0 for "${citation.title?.substring(0, 50)}..." (may be accurate for new papers)`);
        } else {
          console.log(`✅ [Prior Works ${index + 1}/${result.citations.length}] Citation count for "${citation.title?.substring(0, 50)}...": ${finalCitationCount}`);
        }
        
        // Log author information
        if (finalAuthors.length > 0) {
          console.log(`📝 [Prior Works ${index + 1}/${result.citations.length}] Authors (${finalAuthors.length}): First: ${finalAuthors[0]}, Last: ${finalAuthors[finalAuthors.length - 1]}`);
        } else {
          console.warn(`⚠️  [Prior Works ${index + 1}/${result.citations.length}] No authors found for "${citation.title?.substring(0, 50)}..."`);
        }

        return {
          ...priorWork,
          authors: finalAuthors, // Ensure complete author list
          citationCount: finalCitationCount, // Must be a number here
        };
      });

      const priorWorks = (await Promise.all(priorWorksPromises))
        .filter((w): w is PriorWork & { citationCount: number } => !!w && typeof w.citationCount === 'number');
      const withCitationCount = priorWorks.filter(w => w.citationCount > 0).length;
      console.log(`📊 Prior works summary: ${priorWorks.length} total (after dropping missing citationCount), ${withCitationCount} with citationCount > 0`);
      
      // Remove duplicate citations based on title, authors, and year
      const uniquePriorWorks = this.removeDuplicateCitations(priorWorks);
      
      // 🚀 FIXED: Only return relevant papers (from Introduction/Related Work sections)
      // Filter to only include papers that were cited in relevant sections
      // Also prioritize papers with higher citationCount
      const relevantPriorWorks = uniquePriorWorks.filter(work => {
        // Only include papers from Introduction/Related Work sections
        // If section is unknown, we'll keep it but prioritize those with known sections
        const section = work.section?.toLowerCase() || '';
        const isRelevantSection = 
          section.includes('introduction') ||
          section.includes('related work') ||
          section.includes('related works') ||
          section.includes('literature review') ||
          section.includes('background') ||
          section.includes('prior work') ||
          section.includes('prior works') ||
          section.includes('motivation');
        
        // Keep if it's from a relevant section, or if section is unknown (fallback)
        return isRelevantSection || !section || section === 'unknown';
      });
      
      // Sort by citationCount (desc) to prioritize highly cited papers
      relevantPriorWorks.sort((a, b) => {
        const countA = a.citationCount || 0;
        const countB = b.citationCount || 0;
        return countB - countA;
      });
      
      // Limit to top 50 most relevant and highly cited papers
      const topPriorWorks = relevantPriorWorks.slice(0, 50);
      
      console.log(`📊 Filtered to ${topPriorWorks.length} relevant prior works (from Introduction/Related Work sections, sorted by citationCount)`);
      console.log(`   Removed ${uniquePriorWorks.length - topPriorWorks.length} papers from other sections`);
      
      return topPriorWorks;
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
      console.log(`\n🔍 [Derivative Works] Starting search for: ${paperUrl}`);
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
        console.log(`🔍 [Derivative Works] Method 1: Trying to find citing papers via arXiv ID: ${arxivId}`);
        try {
          // First, try to get paperId from arXiv ID
          const arxivResult = await SemanticScholarService.queryByArxivId(arxivId);
          if (arxivResult.success && arxivResult.data?.paperId) {
            const paperId = arxivResult.data.paperId;
            const sourcePaperYear = arxivResult.data.year || undefined;
            console.log(`✅ [Derivative Works] Found paperId ${paperId} from arXiv ID ${arxivId}`);
            console.log(`📅 [Derivative Works] Source paper year: ${sourcePaperYear || 'unknown'}`);
            
            // 🚀 FIXED: Use time distribution strategy to ensure papers from ALL years
            // Fetch many pages to get papers from different time periods
            citingPapers = await SemanticScholarService.getAllCitingPapersWithTimeDistribution(
              paperId,
              {
                maxResults: 100, // Limit results but ensure year diversity
                pagesToFetch: 15, // Fetch many pages to ensure year coverage (2018-2025 = 8 years)
                sourcePaperYear: sourcePaperYear,
                preferWithCitations: true // Prioritize papers with citations
              }
            );
            console.log(`📊 [Derivative Works] Method 1 result: Found ${citingPapers.length} citing papers via paperId`);
          } else {
            // Fallback: try with arXiv ID directly
            console.log(`⚠️  [Derivative Works] Could not get paperId, trying with arXiv ID directly...`);
            // For arXiv ID fallback, we need to get paperId first
            const fallbackArxivResult = await SemanticScholarService.queryByArxivId(arxivId);
            if (fallbackArxivResult.success && fallbackArxivResult.data?.paperId) {
              const fallbackPaperId = fallbackArxivResult.data.paperId;
              const fallbackYear = fallbackArxivResult.data.year || undefined;
              citingPapers = await SemanticScholarService.getAllCitingPapersWithTimeDistribution(
                fallbackPaperId,
                {
                  maxResults: 100,
                  pagesToFetch: 15, // Fetch many pages for year coverage
                  sourcePaperYear: fallbackYear,
                  preferWithCitations: true
                }
              );
              console.log(`📊 [Derivative Works] Method 1 fallback result: Found ${citingPapers.length} citing papers via paperId`);
            }
          }
        } catch (error) {
          console.error(`❌ [Derivative Works] Method 1 failed:`, error instanceof Error ? error.message : error);
          // Continue to try other methods
        }
      } else {
        console.warn(`⚠️  [Derivative Works] Could not extract arXiv ID from URL: ${paperUrl}`);
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
            // 首先尝试获取原始论文的年份，以便后续进行时间分布
            let sourcePaperYear: number | null = null;
            try {
              const sourcePaperInfo = await SemanticScholarService.queryByPaperId(paperId);
              if (sourcePaperInfo.success && sourcePaperInfo.data?.year) {
                sourcePaperYear = sourcePaperInfo.data.year;
                console.log(`📅 [Derivative Works] Source paper year: ${sourcePaperYear}`);
              }
            } catch (error) {
              console.warn(`⚠️  Could not get source paper year:`, error);
            }

            // 策略1：优先按 citationCount 排序获取有引用的论文
            // 先获取按 citationCount 排序的结果（获取更多论文以便筛选）
            citingPapers = await SemanticScholarService.getAllCitingPapersWithTimeDistribution(
              paperId,
              {
                maxResults: 100,
                pagesToFetch: 15, // Fetch many pages for comprehensive year coverage
                sourcePaperYear: sourcePaperYear || undefined,
                preferWithCitations: true
              }
            );
          }
          
          // 方法2b: 如果还是没有结果，尝试通过 GROBID 提取论文信息，然后搜索 Semantic Scholar 获取 paperId
          if (citingPapers.length === 0) {
            console.log(`🔍 [Derivative Works] Method 2b: Trying to extract paper info via GROBID and search Semantic Scholar...`);
            try {
              const grobidResult = await this.grobidService.extractCitationsWithContextFiltered(paperUrl);
              if (grobidResult.success && grobidResult.paperTitle) {
                console.log(`🔍 [Derivative Works] GROBID extracted title: "${grobidResult.paperTitle}"`);
                console.log(`🔍 [Derivative Works] GROBID extracted authors: ${grobidResult.paperAuthors?.slice(0, 3).join(', ') || 'none'}`);
                console.log(`🔍 [Derivative Works] GROBID extracted year: ${grobidResult.paperYear || 'none'}`);
                
                const searchResult = await SemanticScholarService.queryByTitleAndAuthors(
                  grobidResult.paperTitle,
                  grobidResult.paperAuthors || [],
                  grobidResult.paperYear
                );
                
                if (searchResult.success && searchResult.data?.paperId) {
                  const paperId = searchResult.data.paperId;
                  console.log(`✅ [Derivative Works] Found paperId via title search: ${paperId}`);
                  // 使用时间分布策略
                  citingPapers = await SemanticScholarService.getAllCitingPapersWithTimeDistribution(
                    paperId,
                    {
                      maxResults: 100,
                      pagesToFetch: 15, // Fetch many pages for year coverage
                      preferWithCitations: true
                    }
                  );
                  console.log(`📊 [Derivative Works] Method 2b result: Found ${citingPapers.length} citing papers via paperId`);
                } else {
                  console.warn(`⚠️  [Derivative Works] Title search failed: ${searchResult.error || 'No match found'}`);
                  // 方法2c: 如果标题搜索失败，尝试直接用 URL 查询（可能是 Semantic Scholar URL）
                  if (paperUrl.includes('semanticscholar.org')) {
                    const ssMatch = paperUrl.match(/semanticscholar\.org\/paper\/([^\/\?]+)/i);
                    if (ssMatch && ssMatch[1]) {
                      console.log(`🔍 [Derivative Works] Method 2c: Trying direct Semantic Scholar paperId from URL`);
                      try {
                        // 使用时间分布策略
                        citingPapers = await SemanticScholarService.getAllCitingPapersWithTimeDistribution(
                          ssMatch[1],
                          {
                            maxResults: 100,
                            pagesToFetch: 15, // Fetch many pages for year coverage
                            preferWithCitations: true
                          }
                        );
                        console.log(`📊 [Derivative Works] Method 2c result: Found ${citingPapers.length} citing papers`);
                      } catch (error) {
                        console.error(`❌ [Derivative Works] Method 2c failed:`, error instanceof Error ? error.message : error);
                      }
                    }
                  }
                }
              } else {
                console.warn(`⚠️  [Derivative Works] GROBID extraction failed or no title found`);
              }
            } catch (error) {
              console.error(`❌ [Derivative Works] GROBID extraction error:`, error instanceof Error ? error.message : 'Unknown error');
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

      // Filter out papers with future years BEFORE processing citationCount
      const currentYear = new Date().getFullYear();
      const validCitingPapers = citingPapers.filter((paper: any) => {
        if (!paper.year) return true; // Keep papers without year
        const year = parseInt(paper.year);
        if (isNaN(year)) return true; // Keep papers with invalid year format
        // Strictly filter out future years
        if (year > currentYear) {
          console.log(`⚠️  [Derivative Works] Filtering out paper with future year ${year}: "${paper.title?.substring(0, 50)}..."`);
          return false;
        }
        // Also filter out obviously wrong years
        if (year < 1900 || year > currentYear) {
          return false;
        }
        return true;
      });

      if (validCitingPapers.length < citingPapers.length) {
        console.log(`📅 [Derivative Works] Filtered out ${citingPapers.length - validCitingPapers.length} papers with invalid/future years`);
      }

      console.log(`📊 [Derivative Works] Found ${validCitingPapers.length} valid citing papers (after year filtering), processing citationCount...`);
      
      // Strategy: First try batch query for all papers, then individual queries ONLY for missing ones
      const paperIdsToQuery = validCitingPapers
        .filter((p: any) => p.id && (p.citationCount === undefined || p.citationCount === null || p.citationCount === 0))
        .map((p: any) => p.id);
      
      console.log(`📦 [Derivative Works] Batch querying citationCount for ${paperIdsToQuery.length} papers (out of ${validCitingPapers.length} total)...`);
      let batchCitationCounts = new Map<string, number>();
      
      if (paperIdsToQuery.length > 0) {
        try {
          batchCitationCounts = await SemanticScholarService.batchQueryPapers(paperIdsToQuery);
          console.log(`✅ [Derivative Works] Batch query found citationCount for ${batchCitationCounts.size}/${paperIdsToQuery.length} papers`);
        } catch (error) {
          console.error(`❌ [Derivative Works] Batch query failed:`, error instanceof Error ? error.message : 'Unknown error');
          // Continue with individual queries as fallback
        }
      } else {
        console.log(`ℹ️  [Derivative Works] All papers already have citationCount, skipping batch query`);
      }
      
      // Process papers: use batch results if available, otherwise try individual queries
      const derivativeWorksPromises = validCitingPapers.map(async (paper: any) => {
        let citationCount = paper.citationCount;
        
        // First, check if batch query found the citationCount
        if (paper.id && batchCitationCounts.has(paper.id)) {
          const batchCount = batchCitationCounts.get(paper.id)!;
          citationCount = batchCount; // Use batch result even if 0 (it's from API)
          if (batchCount > 0) {
            console.log(`✅ [Derivative Works] Found citationCount via batch query: ${citationCount} for "${paper.title?.substring(0, 40)}..."`);
          } else {
            console.log(`ℹ️  [Derivative Works] Batch query returned citationCount=0 for "${paper.title?.substring(0, 40)}..." (paperId: ${paper.id})`);
          }
        } else if (paper.id && (citationCount === undefined || citationCount === null || citationCount === 0)) {
          // Only query individually if batch query didn't find it
          // Skip individual queries if we already have a value from batch (even if 0)
          try {
            console.log(`🔍 [Derivative Works] Batch query missed, trying individual paperId query: ${paper.id} for "${paper.title?.substring(0, 40)}..."`);
            const paperIdResult = await SemanticScholarService.queryByPaperId(paper.id);
            if (paperIdResult.success && paperIdResult.data) {
              if (paperIdResult.data.citationCount !== undefined && paperIdResult.data.citationCount !== null) {
                const queriedCount = paperIdResult.data.citationCount;
                citationCount = queriedCount;
                if (queriedCount > 0) {
                  console.log(`✅ [Derivative Works] Found citationCount via individual paperId query: ${citationCount} for "${paper.title?.substring(0, 40)}..."`);
                } else {
                  console.log(`ℹ️  [Derivative Works] Individual paperId query returned citationCount=0 for "${paper.title?.substring(0, 40)}..."`);
                }
              }
            }
          } catch (error) {
            console.debug(`Failed to fetch citationCount via paperId for ${paper.id}:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }
        
        // If citationCount is still missing or 0, try additional methods
        // Note: We check for 0 because Semantic Scholar API might incorrectly return 0 for papers that actually have citations
        if ((citationCount === undefined || citationCount === null || citationCount === 0)) {
          // Method 2: If we have URL, try extracting arXiv ID from URL
          if (paper.url) {
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
          if ((citationCount === undefined || citationCount === null || citationCount === 0) && paper.title && paper.authors && paper.authors.length > 0) {
            try {
              console.log(`🔍 [Derivative Works] Searching by title+authors+year for "${paper.title?.substring(0, 40)}..."`);
              const searchResult = await SemanticScholarService.queryByTitleAndAuthors(
                paper.title,
                paper.authors.slice(0, 3), // Use first 3 authors only
                paper.year
              );
              if (searchResult.success && searchResult.data) {
                // If search found a match, try using its paperId to query
                if (searchResult.data.paperId && (citationCount === undefined || citationCount === null || citationCount === 0)) {
                  try {
                    const searchPaperIdResult = await SemanticScholarService.queryByPaperId(searchResult.data.paperId);
                    if (searchPaperIdResult.success && searchPaperIdResult.data?.citationCount !== undefined && searchPaperIdResult.data.citationCount !== null) {
                      citationCount = searchPaperIdResult.data.citationCount;
                      console.log(`✅ [Derivative Works] Found citationCount via search+paperId: ${citationCount} for "${paper.title?.substring(0, 40)}..."`);
                    }
                  } catch (error) {
                    console.debug(`Failed to query search result paperId:`, error instanceof Error ? error.message : 'Unknown error');
                  }
                }
                
                // Also try using search result's citationCount directly
                if ((citationCount === undefined || citationCount === null || citationCount === 0) && searchResult.data.citationCount !== undefined && searchResult.data.citationCount !== null) {
                  citationCount = searchResult.data.citationCount;
                  console.log(`✅ [Derivative Works] Found citationCount via title search: ${citationCount} for "${paper.title?.substring(0, 40)}..."`);
                }
              }
            } catch (error) {
              console.debug(`Failed to search by title for derivative work:`, error instanceof Error ? error.message : 'Unknown error');
            }
          }
        }
        
        // Ensure authors is a proper array with all authors
        let finalAuthors: string[] = [];
        if (paper.authors && Array.isArray(paper.authors)) {
          finalAuthors = paper.authors.map((author: any) => {
            if (typeof author === 'string') {
              return author;
            } else if (author && typeof author === 'object' && author.name) {
              return author.name;
            }
            return String(author || '');
          }).filter((name: string) => name && name.length > 0);
        }
        
        // Ensure citationCount is a valid number (not undefined/null)
        // If still not found, set to 0 (not undefined) so frontend can handle it properly
        const finalCitationCount = (citationCount !== undefined && citationCount !== null && typeof citationCount === 'number' && citationCount >= 0)
          ? citationCount
          : 0; // Use 0 instead of undefined/null
        
        // Log final data for debugging
        if (finalCitationCount === 0) {
          console.warn(`⚠️  [Derivative Works] Final citationCount is 0 for "${paper.title?.substring(0, 50)}..." (paperId: ${paper.id || 'none'})`);
        }
        
        return {
          id: paper.id || `paper_${Date.now()}_${Math.random()}`,
          title: paper.title || 'Unknown Title',
          authors: finalAuthors, // Ensure complete author list
          year: paper.year || undefined,
          abstract: paper.abstract || undefined,
          url: paper.url || undefined,
          citationCount: finalCitationCount, // Always a number (0 if all methods failed)
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
   * Calculate title similarity between two titles
   * Returns a value between 0 and 1, where 1 is identical
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    if (!title1 || !title2) return 0;
    
    const words1 = new Set(title1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(title2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
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

