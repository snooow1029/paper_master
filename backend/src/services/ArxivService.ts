/**
 * Arxiv Service
 * 提供 arXiv API 搜索功能
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ArxivSearchResult {
  id: string; // arXiv ID (e.g., "2305.10403")
  title: string;
  authors: string[];
  summary: string;
  published: string; // Published date (YYYY-MM-DD)
  updated?: string; // Last updated date
  arxivUrl: string; // Full URL (e.g., "https://arxiv.org/abs/2305.10403")
  pdfUrl?: string; // PDF URL
  primaryCategory?: string; // Primary category
  categories?: string[]; // All categories
}

export interface ArxivSearchResponse {
  success: boolean;
  results: ArxivSearchResult[];
  totalResults?: number;
  error?: string;
}

export class ArxivService {
  private readonly baseUrl = 'http://export.arxiv.org/api/query';

  /**
   * Normalize and expand query to handle common word combinations
   * e.g., "incontext" -> "in context", "reinforcementlearning" -> "reinforcement learning"
   */
  private normalizeQuery(query: string): string {
    // Common word combinations that might be written together
    const wordExpansions: { [key: string]: string } = {
      'incontext': 'in context',
      'reinforcementlearning': 'reinforcement learning',
      'deeplearning': 'deep learning',
      'machinelearning': 'machine learning',
      'neuralnetwork': 'neural network',
      'neuralnetworks': 'neural networks',
      'artificialintelligence': 'artificial intelligence',
      'naturalanguage': 'natural language',
      'computervision': 'computer vision',
      'transferlearning': 'transfer learning',
      'fewshot': 'few shot',
      'zeroshot': 'zero shot',
      'oneshot': 'one shot',
      'multitask': 'multi task',
      'selfsupervised': 'self supervised',
      'semisupervised': 'semi supervised',
      'unsupervisedlearning': 'unsupervised learning',
      'supervisedlearning': 'supervised learning',
      'algorithmdistillation': 'algorithm distillation',
    };

    let normalized = query.toLowerCase().trim();
    
    // Try to expand common word combinations (case insensitive)
    for (const [combined, expanded] of Object.entries(wordExpansions)) {
      // Replace whole word matches
      const regex = new RegExp(`\\b${combined}\\b`, 'gi');
      normalized = normalized.replace(regex, expanded);
    }
    
    // Also try to split camelCase or words that might be combined
    // This is a heuristic: if we see a lowercase letter followed by uppercase, insert space
    normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    return normalized.trim();
  }

  /**
   * 搜索 arXiv 论文
   * @param query 搜索查询（可以使用 arXiv 搜索语法）
   * @param maxResults 最大返回结果数（默认 10）
   */
  async searchPapers(query: string, maxResults: number = 10): Promise<ArxivSearchResponse> {
    try {
      if (!query || query.trim().length === 0) {
        return {
          success: false,
          results: [],
          error: 'Search query cannot be empty'
        };
      }

      // Normalize query to handle word combinations (e.g., "incontext" -> "in context")
      const normalizedQuery = this.normalizeQuery(query);

      // Check if query already contains field prefixes (all:, au:, cat:, etc.)
      // If it does, use it directly; otherwise, default to all: prefix
      const trimmedQuery = normalizedQuery.trim();
      const hasFieldPrefix = /^(all|ti|au|abs|co|jr|cat|id|rn):/.test(trimmedQuery) || 
                            trimmedQuery.includes('+AND+') || 
                            trimmedQuery.includes('+OR+') ||
                            trimmedQuery.includes('+ANDNOT+');
      
      // If query already has field prefix or operators, use it as-is
      // Otherwise, wrap it with all: prefix for general search
      const searchQuery = hasFieldPrefix ? trimmedQuery : `all:${trimmedQuery}`;
      
      // Encode the query for URL
      const encodedQuery = encodeURIComponent(searchQuery);
      // Use title search first for better relevance, then fallback to all fields
      // This helps prioritize papers where the query matches the title
      const url = `${this.baseUrl}?search_query=${encodedQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

      console.log(`🔍 Searching arXiv: ${query}`);
      console.log(`📡 API URL: ${url}`);

      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept': 'application/atom+xml'
        }
      });

      // Parse XML response
      const results = this.parseArxivXML(response.data);

      console.log(`✅ Found ${results.length} results from arXiv`);

      return {
        success: true,
        results,
        totalResults: results.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Arxiv search error:', errorMessage);
      
      return {
        success: false,
        results: [],
        error: `Failed to search arXiv: ${errorMessage}`
      };
    }
  }

  /**
   * 解析 arXiv API 返回的 XML 数据
   */
  private parseArxivXML(xmlString: string): ArxivSearchResult[] {
    const results: ArxivSearchResult[] = [];

    try {
      // Remove namespace declarations for easier parsing
      const xmlNoNs = xmlString.replace(/xmlns(?::[^=]*)?="[^"]*"/g, '');
      const $ = cheerio.load(xmlNoNs, { xmlMode: true });

      // Process each entry
      $('entry').each((_, entry) => {
        const $entry = $(entry);

        // Extract ID (e.g., "http://arxiv.org/abs/2305.10403v1")
        const fullId = $entry.find('id').first().text().trim();
        if (!fullId) return;

        const arxivIdMatch = fullId.match(/arxiv\.org\/abs\/([^\/]+)/);
        const arxivId = arxivIdMatch ? arxivIdMatch[1].replace(/v\d+$/, '') : fullId.split('/').pop()?.replace(/v\d+$/, '') || '';

        // Extract title
        const title = this.cleanText($entry.find('title').first().text()) || 'Unknown Title';

        // Extract authors
        const authors: string[] = [];
        $entry.find('author').each((_, author) => {
          const name = $(author).find('name').first().text().trim();
          if (name) {
            authors.push(name);
          }
        });

        // Extract summary
        const summary = this.cleanText($entry.find('summary').first().text());

        // Extract published date
        const publishedText = $entry.find('published').first().text().trim();
        const published = publishedText ? publishedText.substring(0, 10) : '';

        // Extract updated date
        const updatedText = $entry.find('updated').first().text().trim();
        const updated = updatedText ? updatedText.substring(0, 10) : undefined;

        // Extract primary category
        const primaryCategoryEl = $entry.find('primary_category, arxiv\\:primary_category').first();
        const primaryCategory = primaryCategoryEl.attr('term') || undefined;

        // Extract all categories
        const categories: string[] = [];
        $entry.find('category').each((_, cat) => {
          const term = $(cat).attr('term');
          if (term) {
            categories.push(term);
          }
        });

        // Build URLs
        const arxivUrl = `https://arxiv.org/abs/${arxivId}`;
        const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

        results.push({
          id: arxivId,
          title,
          authors,
          summary,
          published,
          updated,
          arxivUrl,
          pdfUrl,
          primaryCategory,
          categories: categories.length > 0 ? categories : undefined
        });
      });

    } catch (error) {
      console.error('Error parsing arXiv XML:', error);
      // Fallback to regex parsing if cheerio fails
      return this.parseArxivXMLRegex(xmlString);
    }

    return results;
  }

  /**
   * Fallback regex-based XML parsing (if cheerio fails)
   */
  private parseArxivXMLRegex(xmlString: string): ArxivSearchResult[] {
    const results: ArxivSearchResult[] = [];

    try {
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;

      while ((match = entryRegex.exec(xmlString)) !== null) {
        const entryXml = match[1];

        // Extract ID
        const idMatch = entryXml.match(/<id>([^<]+)<\/id>/);
        if (!idMatch) continue;

        const fullId = idMatch[1];
        const arxivIdMatch = fullId.match(/arxiv\.org\/abs\/([^\/]+)/);
        const arxivId = arxivIdMatch ? arxivIdMatch[1].replace(/v\d+$/, '') : fullId.split('/').pop()?.replace(/v\d+$/, '') || '';

        // Extract title
        const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
        const title = titleMatch ? this.cleanText(titleMatch[1]) : 'Unknown Title';

        // Extract authors
        const authors: string[] = [];
        const authorRegex = /<name>([^<]+)<\/name>/g;
        let authorMatch;
        while ((authorMatch = authorRegex.exec(entryXml)) !== null) {
          authors.push(authorMatch[1].trim());
        }

        // Extract summary
        const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
        const summary = summaryMatch ? this.cleanText(summaryMatch[1]) : '';

        // Extract published date
        const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/);
        const published = publishedMatch ? publishedMatch[1].substring(0, 10) : '';

        // Extract updated date
        const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/);
        const updated = updatedMatch ? updatedMatch[1].substring(0, 10) : undefined;

        // Extract primary category
        const primaryCategoryMatch = entryXml.match(/<arxiv:primary_category[^>]*term="([^"]+)"/);
        const primaryCategory = primaryCategoryMatch ? primaryCategoryMatch[1] : undefined;

        // Extract all categories
        const categories: string[] = [];
        const categoryRegex = /<category[^>]*term="([^"]+)"/g;
        let categoryMatch;
        while ((categoryMatch = categoryRegex.exec(entryXml)) !== null) {
          categories.push(categoryMatch[1]);
        }

        // Build URLs
        const arxivUrl = `https://arxiv.org/abs/${arxivId}`;
        const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

        results.push({
          id: arxivId,
          title,
          authors,
          summary,
          published,
          updated,
          arxivUrl,
          pdfUrl,
          primaryCategory,
          categories: categories.length > 0 ? categories : undefined
        });
      }

    } catch (error) {
      console.error('Error in regex parsing fallback:', error);
    }

    return results;
  }

  /**
   * 清理文本内容（移除换行符和多余空格）
   */
  private cleanText(text: string): string {
    return text
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

