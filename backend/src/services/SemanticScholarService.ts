import axios from 'axios';

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  authors?: Array<{
    authorId: string;
    name: string;
  }>;
  venue?: string;
  year?: number;
  publicationDate?: string;
  publicationTypes?: string[];
  citationCount?: number;
  abstract?: string;
  url?: string;
  fieldsOfStudy?: string[];
  s2FieldsOfStudy?: Array<{
    category: string;
    source: string;
  }>;
}

interface SemanticScholarResponse {
  success: boolean;
  data?: SemanticScholarPaper;
  error?: string;
}

export class SemanticScholarService {
  private static readonly BASE_URL = 'https://api.semanticscholar.org/graph/v1';
  private static readonly RATE_LIMIT_DELAY = 2000; // 2 seconds between requests (increased from 1s)
  private static lastRequestTime = 0;
  private static requestCount = 0;
  private static readonly MAX_REQUESTS_PER_MINUTE = 20; // Conservative limit

  /**
   * Wait for rate limit if necessary
   */
  static async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Enforce minimum delay between requests (increased to 3s for better reliability)
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const waitTime = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
      console.log(`⏳ Waiting ${waitTime}ms for rate limit...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Additional throttling: if too many requests in short time, wait longer
    this.requestCount++;
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      console.log(`⚠️  Reached ${this.MAX_REQUESTS_PER_MINUTE} requests, waiting 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      this.requestCount = 0; // Reset counter
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Retry with exponential backoff for 429 errors
   */
  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 2,
    baseDelay: number = 3000
  ): Promise<T> {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        if (error.response?.status === 429 && i < maxRetries) {
          const delay = baseDelay * Math.pow(2, i);
          console.log(`⚠️  Rate limit hit (429), retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Extract arXiv ID from URL or raw text
   */
  private static extractArxivId(input: string): string | null {
    if (!input) return null;
    
    // Handle URLs like https://arxiv.org/pdf/2305.10403.pdf or https://arxiv.org/abs/2510.22359
    const urlPatterns = [
      /arxiv\.org\/(?:abs|pdf|html|e-print)\/([^\/\?]+)/i,
      /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i,
      /arxiv\.org\/pdf\/(\d{4}\.\d{4,5})/i,
    ];
    
    for (const pattern of urlPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        let arxivId = match[1].replace(/\.pdf$/i, ''); // Remove .pdf suffix
        arxivId = arxivId.replace(/v\d+$/i, ''); // Remove version suffix
        // Check if it matches the arXiv ID format (YYYY.NNNNN)
        if (/^\d{4}\.\d{4,5}$/.test(arxivId)) {
          return arxivId;
        }
      }
    }

    // Handle raw arXiv IDs like arXiv:2305.10403v3[cs.CL] or 2305.10403
    const idMatch = input.match(/(?:arXiv:)?(\d{4}\.\d{4,5})(?:v\d+)?/i);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }

    return null;
  }

  /**
   * Query paper information from Semantic Scholar by arXiv ID
   */
  static async queryByArxivId(arxivInput: string): Promise<SemanticScholarResponse> {
    try {
      const arxivId = this.extractArxivId(arxivInput);
      if (!arxivId) {
        return {
          success: false,
          error: `Invalid arXiv identifier: ${arxivInput}`
        };
      }

      console.log(`🔍 Querying Semantic Scholar for arXiv:${arxivId}`);

      await this.waitForRateLimit();

      // Request all available fields including full author list
      // Note: Semantic Scholar may limit authors in response, but we request all
      const fields = [
        'title',
        'authors', // This should return all authors, but API may limit
        'venue',
        'year',
        'publicationDate',
        'publicationTypes',
        'citationCount',
        'abstract',
        'fieldsOfStudy',
        's2FieldsOfStudy'
      ].join(',');

      const url = `${this.BASE_URL}/paper/arXiv:${arxivId}?fields=${fields}`;
      console.log(`📡 Request URL: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PaperMaster/1.0 (https://example.com/contact)'
        },
        timeout: 10000
      });

      // Log author count in response
      const authorCount = response.data.authors?.length || 0;
      console.log(`✅ Semantic Scholar response:`, {
        title: response.data.title,
        venue: response.data.venue,
        year: response.data.year,
        publicationTypes: response.data.publicationTypes,
        citationCount: response.data.citationCount,
        authorCount: authorCount,
        first3Authors: response.data.authors?.slice(0, 3).map((a: any) => typeof a === 'string' ? a : a.name).join(', ') || 'none'
      });
      
      // Warn if authors array seems truncated (common for papers with many authors)
      if (authorCount > 0 && authorCount < 10 && response.data.authors) {
        const lastAuthor = response.data.authors[response.data.authors.length - 1];
        const lastAuthorName = typeof lastAuthor === 'string' ? lastAuthor : lastAuthor.name;
        console.log(`⚠️  Semantic Scholar returned only ${authorCount} authors. This may be a truncated list.`);
        console.log(`    Last author in response: ${lastAuthorName}`);
        console.log(`    Note: GROBID extraction from PDF should provide the complete author list.`);
      }

      // Extract authors properly and include in response
      let extractedAuthors: string[] = [];
      if (response.data.authors && Array.isArray(response.data.authors)) {
        extractedAuthors = response.data.authors.map((author: any) => {
          if (typeof author === 'string') {
            return author;
          } else if (author && typeof author === 'object' && author.name) {
            return author.name;
          }
          return String(author);
        }).filter((name: string) => name && name.length > 0);
      }
      
      // Include extracted authors in response data
      const responseData = {
        ...response.data,
        authors: extractedAuthors.length > 0 ? extractedAuthors : response.data.authors
      };

      return {
        success: true,
        data: responseData
      };

    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn(`⚠️  Rate limit exceeded. Status: ${error.response.status}`);
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        };
      }

      if (error.response?.status === 404) {
        console.warn(`⚠️  Paper not found in Semantic Scholar: arXiv:${arxivInput}`);
        return {
          success: false,
          error: 'Paper not found in Semantic Scholar database'
        };
      }

      console.error(`❌ Error querying Semantic Scholar:`, error.message);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Get enhanced venue information
   */
  static async getEnhancedVenueInfo(arxivInput: string): Promise<{
    title?: string;
    authors?: string[];
    year?: number;
    venue?: string;
    venueType?: string;
    isPreprint: boolean;
    publicationDate?: string;
    citationCount?: number;
    publicationTypes?: string[];
  }> {
    console.log(`🔍 [SEMANTIC SCHOLAR DEBUG] Starting venue info query for: ${arxivInput}`);
    
    const result = await this.queryByArxivId(arxivInput);
    
    console.log(`🔍 [SEMANTIC SCHOLAR DEBUG] Query result:`, {
      success: result.success,
      error: result.error,
      hasData: !!result.data,
      citationCount: result.data?.citationCount,
      venue: result.data?.venue
    });
    
    if (!result.success || !result.data) {
      console.log(`⚠️  [SEMANTIC SCHOLAR DEBUG] Query failed, returning fallback`);
      return {
        title: undefined,
        authors: [],
        year: undefined,
        venue: 'arXiv preprint',
        venueType: 'preprint',
        isPreprint: true,
        citationCount: undefined
      };
    }

    const paper = result.data;
    
    // Determine if it's still a preprint or has been published
    const hasVenue = paper.venue && paper.venue.trim() !== '';
    const isJournal = paper.publicationTypes?.includes('JournalArticle') || false;
    const isConference = paper.publicationTypes?.includes('Conference') || false;
    
    let venueType = 'preprint';
    if (isJournal) venueType = 'journal';
    else if (isConference) venueType = 'conference';
    else if (hasVenue) venueType = 'other';

    const result_data = {
      title: paper.title,
      // Extract all authors (ensure complete list)
      authors: (() => {
        if (paper.authors && Array.isArray(paper.authors)) {
          return paper.authors.map((author: any) => {
            if (typeof author === 'string') {
              return author;
            } else if (author && typeof author === 'object' && author.name) {
              return author.name;
            }
            return String(author || 'Unknown Author');
          }).filter((name: string) => name && name !== 'Unknown Author' && name.length > 0);
        }
        return [];
      })(),
      year: paper.year,
      venue: hasVenue ? paper.venue : 'arXiv preprint',
      venueType,
      isPreprint: !hasVenue,
      publicationDate: paper.publicationDate,
      citationCount: paper.citationCount,
      publicationTypes: paper.publicationTypes
    };
    
    console.log(`✅ [SEMANTIC SCHOLAR DEBUG] Returning result:`, result_data);
    
    return result_data;
  }

  /**
   * Query paper information from Semantic Scholar by title and optionally authors
   * This is a fallback when arXiv ID is not available
   */
  static async queryByTitleAndAuthors(title: string, authors?: string[], year?: string): Promise<SemanticScholarResponse> {
    try {
      if (!title || title.trim().length === 0) {
        return {
          success: false,
          error: 'Title is required for search'
        };
      }

      console.log(`🔍 Searching Semantic Scholar by title: "${title.substring(0, 50)}..."`);
      
      await this.waitForRateLimit();

      // Clean and normalize title - be more careful with special characters
      const cleanTitle = title.trim()
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/[<>{}[\]]/g, '')  // Remove brackets and braces
        .replace(/[^\w\s-:]/g, ' ')  // Remove special chars but keep hyphens and colons
        .replace(/\s+/g, ' ')  // Normalize whitespace again
        .trim();

      // Try multiple search strategies
      const searchQueries = [];
      
      // Strategy 1: Title + year + first author (most specific)
      if (authors && authors.length > 0 && year) {
        const firstAuthor = authors[0].trim();
        const authorParts = firstAuthor.split(/\s+/);
        const lastName = authorParts.length > 1 ? authorParts[authorParts.length - 1] : authorParts[0];
        searchQueries.push(`${cleanTitle} ${lastName} ${year}`);
      }
      
      // Strategy 2: Title + first author
      if (authors && authors.length > 0) {
        const firstAuthor = authors[0].trim();
        const authorParts = firstAuthor.split(/\s+/);
        const lastName = authorParts.length > 1 ? authorParts[authorParts.length - 1] : authorParts[0];
        searchQueries.push(`${cleanTitle} ${lastName}`);
      }
      
      // Strategy 3: Title + year
      if (year) {
        searchQueries.push(`${cleanTitle} ${year}`);
      }
      
      // Strategy 4: First significant words of title (in case title is truncated)
      const significantWords = cleanTitle.split(' ').filter(w => w.length > 3).slice(0, 5).join(' ');
      if (significantWords && significantWords.length > 10 && significantWords !== cleanTitle) {
        searchQueries.push(significantWords);
      }
      
      // Strategy 5: Title only (last resort)
      searchQueries.push(cleanTitle);
      
      // Try each search strategy until one works
      let response: any = null;
      let usedQuery = '';
      
      for (const query of searchQueries) {
        try {
          await this.waitForRateLimit();
          
          // Use Semantic Scholar search API
          const searchUrl = `${this.BASE_URL}/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,authors,year,citationCount,abstract,paperId,url`;
          
          console.log(`📡 Trying search query: "${query.substring(0, 80)}..."`);
          
          const searchResponse = await axios.get(searchUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'PaperMaster/1.0 (https://example.com/contact)'
            },
            timeout: 10000
          });
          
          if (searchResponse.data && searchResponse.data.data && searchResponse.data.data.length > 0) {
            response = searchResponse;
            usedQuery = query;
            console.log(`✅ Search query succeeded: "${query.substring(0, 60)}..." (found ${searchResponse.data.data.length} results)`);
            break;
          }
        } catch (error: any) {
          // If it's a rate limit error, stop trying other queries
          if (error.response?.status === 429) {
            throw error;
          }
          // Otherwise, continue to next query
          if (error.response) {
            console.debug(`   Query failed with status ${error.response.status}: ${error.response.statusText}`);
          } else {
            console.debug(`   Query failed: ${error.message}`);
          }
        }
      }

      if (!response || !response.data || !response.data.data || response.data.data.length === 0) {
        console.warn(`⚠️  No results found in Semantic Scholar for any query variant. Last tried: "${usedQuery || cleanTitle}"`);
        
        // Log response details if available
        if (response) {
          console.warn(`   Response status: ${response.status || 'N/A'}`);
          if (response.data) {
            console.warn(`   Response data keys: ${Object.keys(response.data).join(', ')}`);
            if (response.data.total !== undefined) {
              console.warn(`   Total results in response: ${response.data.total}`);
            }
          }
        } else {
          console.warn(`   No response received from Semantic Scholar API`);
        }
        
        return {
          success: false,
          error: 'No matching papers found'
        };
      }

      console.log(`📊 Semantic Scholar returned ${response.data.data.length} potential matches using query: "${usedQuery.substring(0, 60)}..."`);

      // Find best match by title similarity
      const normalizeTitle = (t: string) => t.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const targetTitle = normalizeTitle(title);
      let bestMatch = null;
      let bestScore = 0;

      // Also check if authors match (if provided)
      const normalizeAuthors = (authors: string[]) => {
        return authors.map(a => a.toLowerCase().trim().split(/\s+/).pop() || '').filter(Boolean);
      };
      const targetAuthorNames = authors && authors.length > 0 ? normalizeAuthors(authors) : [];

      for (const paper of response.data.data) {
        const paperTitle = normalizeTitle(paper.title || '');
        
        // Calculate similarity (simple word overlap)
        const targetWords = new Set(targetTitle.split(' ').filter(w => w.length > 2));
        const paperWords = new Set(paperTitle.split(' ').filter(w => w.length > 2));
        const intersection = new Set([...targetWords].filter(x => paperWords.has(x)));
        const union = new Set([...targetWords, ...paperWords]);
        
        let similarity = union.size > 0 ? intersection.size / union.size : 0;
        
        // Bonus for author match (if authors provided)
        if (targetAuthorNames.length > 0 && paper.authors) {
          const paperAuthorNames = normalizeAuthors(
            paper.authors.map((a: any) => typeof a === 'string' ? a : a.name || '')
          );
          const authorMatch = targetAuthorNames.some(targetAuthor => 
            paperAuthorNames.some(paperAuthor => 
              paperAuthor.includes(targetAuthor) || targetAuthor.includes(paperAuthor)
            )
          );
          if (authorMatch) {
            similarity += 0.2; // Bonus for author match
          }
        }
        
        // Bonus for year match
        if (year && paper.year && paper.year.toString() === year.toString()) {
          similarity += 0.1;
        }
        
        // Check exact match
        if (paperTitle === targetTitle || 
            paperTitle.includes(targetTitle.substring(0, 30)) ||
            targetTitle.includes(paperTitle.substring(0, 30))) {
          bestMatch = paper;
          bestScore = Math.max(1.0, similarity);
          break;
        }
        
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = paper;
        }
      }

      // Make matching more permissive: accept lower similarity if it's the only candidate
      // Thresholds: >0.15 (general) or >0.08 when only one result (likely correct)
      const acceptableMatch = (bestMatch && bestScore > 0.15) || 
                             (bestMatch && response.data.data.length === 1 && bestScore > 0.08);
      
      if (acceptableMatch && bestMatch) {
        console.log(`✅ Found match with similarity ${bestScore.toFixed(2)}: "${bestMatch.title}" (citationCount: ${bestMatch.citationCount || 'N/A'})`);
        console.log(`   Matched paper authors: ${bestMatch.authors?.map((a: any) => typeof a === 'string' ? a : a.name).slice(0, 3).join(', ') || 'N/A'}`);
        console.log(`   Matched paper year: ${bestMatch.year || 'N/A'}`);
        console.log(`   Matched paper paperId: ${bestMatch.paperId || 'N/A'}`);
        
        // If search returned citationCount but it's 0, try querying by paperId to get accurate count
        let finalCitationCount = bestMatch.citationCount;
        if ((finalCitationCount === undefined || finalCitationCount === null || finalCitationCount === 0) && bestMatch.paperId) {
          try {
            console.log(`🔍 [queryByTitleAndAuthors] Search returned citationCount=${finalCitationCount}, querying by paperId for accurate count...`);
            const paperIdResult = await this.queryByPaperId(bestMatch.paperId);
            if (paperIdResult.success && paperIdResult.data?.citationCount !== undefined && paperIdResult.data.citationCount !== null) {
              finalCitationCount = paperIdResult.data.citationCount;
              console.log(`✅ [queryByTitleAndAuthors] paperId query returned citationCount: ${finalCitationCount}`);
            }
          } catch (error) {
            console.debug(`Failed to query by paperId in queryByTitleAndAuthors:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }
        
        return {
          success: true,
          data: {
            title: bestMatch.title,
            authors: bestMatch.authors?.map((a: any) => 
              typeof a === 'string' ? a : a.name || 'Unknown Author'
            ) || [],
            year: bestMatch.year,
            citationCount: finalCitationCount, // Use the verified citationCount
            abstract: bestMatch.abstract,
            paperId: bestMatch.paperId,
            url: bestMatch.url
          }
        };
      }

      // Log top candidates for debugging
      console.warn(`⚠️  No good match found (best similarity: ${bestScore.toFixed(2)}, threshold: 0.2)`);
      console.warn(`   Search returned ${response.data.data.length} total results`);
      if (response.data.data.length > 0) {
        console.warn(`   Top candidate: "${response.data.data[0].title?.substring(0, 60)}..." (citationCount: ${response.data.data[0].citationCount || 'N/A'})`);
      }
      
      return {
        success: false,
        error: `No matching papers found with sufficient similarity (best: ${bestScore.toFixed(2)})`
      };

    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn(`⚠️  Rate limit exceeded for title search`);
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        };
      }

      console.error(`❌ Error searching Semantic Scholar by title:`, error.message);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Query paper information by paperId (Semantic Scholar paper ID)
   * This is more reliable than arXiv ID for papers that may not have arXiv versions
   */
  static async queryByPaperId(paperId: string): Promise<SemanticScholarResponse> {
    try {
      if (!paperId || paperId.trim().length === 0) {
        return {
          success: false,
          error: 'Paper ID is required'
        };
      }

      console.log(`🔍 Querying Semantic Scholar by paperId: ${paperId}`);
      
      await this.waitForRateLimit();

      const fields = [
        'title',
        'authors',
        'venue',
        'year',
        'publicationDate',
        'publicationTypes',
        'citationCount',
        'abstract',
        'url',
        'fieldsOfStudy'
      ].join(',');

      const url = `${this.BASE_URL}/paper/${paperId}?fields=${fields}`;
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PaperMaster/1.0 (https://example.com/contact)'
        },
        timeout: 10000
      });

      if (!response.data || !response.data.paperId) {
        return {
          success: false,
          error: 'No paper data returned'
        };
      }

      // Log detailed response for debugging
      const responseCitationCount = response.data.citationCount;
      console.log(`✅ Found paper by paperId: "${response.data.title}"`);
      console.log(`   citationCount in response: ${responseCitationCount !== undefined && responseCitationCount !== null ? responseCitationCount : 'missing'}`);
      console.log(`   citationCount type: ${typeof responseCitationCount}`);
      
      // Check if citationCount is actually in the response
      if (responseCitationCount === undefined || responseCitationCount === null) {
        console.warn(`⚠️  [queryByPaperId] citationCount is missing in API response for paperId: ${paperId}`);
        console.warn(`   Response keys: ${Object.keys(response.data).join(', ')}`);
        // Try to check if there's an alternative field name
        if (response.data.citations !== undefined) {
          console.warn(`   Found 'citations' field instead (value: ${response.data.citations})`);
        }
      }

      return {
        success: true,
        data: {
          paperId: response.data.paperId,
          title: response.data.title,
          authors: response.data.authors,
          venue: response.data.venue,
          year: response.data.year,
          publicationDate: response.data.publicationDate,
          publicationTypes: response.data.publicationTypes,
          citationCount: responseCitationCount, // Use the checked value
          abstract: response.data.abstract,
          url: response.data.url,
          fieldsOfStudy: response.data.fieldsOfStudy
        }
      };

    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn(`⚠️  Rate limit exceeded while querying by paperId`);
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        };
      }

      if (error.response?.status === 404) {
        console.warn(`⚠️  Paper not found in Semantic Scholar: paperId=${paperId}`);
        return {
          success: false,
          error: 'Paper not found in Semantic Scholar database'
        };
      }

      console.error(`❌ Error querying Semantic Scholar by paperId:`, error.message);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Get papers that cite this paper (derivative works)
   * Supports multiple methods: arXiv ID, paperId, or title+authors+year search
   */
  static async getCitingPapers(
    identifier: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'year' | 'citationCount';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<Array<{
    id: string;
    title: string;
    authors: string[];
    year?: string;
    abstract?: string;
    url?: string;
    citationCount?: number;
  }>> {
    try {
      const {
        limit = 100, // 增加默认限制到100
        offset = 0,
        sortBy = 'year', // 默认按年份排序，这样可以获取所有年代的论文
        sortOrder = 'desc' // 默认降序，最新的在前，但我们会收集所有年代的
      } = options;

      // Method 1: Try by arXiv ID first
      const arxivId = this.extractArxivId(identifier);
      let paperId: string | null = null;
      
      if (arxivId) {
        try {
          // First get the paperId from arXiv ID
          const arxivResult = await this.queryByArxivId(arxivId);
          if (arxivResult.success && arxivResult.data?.paperId) {
            paperId = arxivResult.data.paperId;
            console.log(`✅ [getCitingPapers] Found paperId ${paperId} from arXiv ID ${arxivId}`);
          } else {
            console.warn(`⚠️  [getCitingPapers] Could not get paperId from arXiv query: ${arxivResult.error || 'No paperId in response'}`);
          }
        } catch (error) {
          console.error(`❌ [getCitingPapers] Error querying arXiv ID ${arxivId}:`, error instanceof Error ? error.message : error);
          // Continue to try other methods
        }
      }

      // Method 2: If no paperId yet, try to find it by treating identifier as paperId
      // Check if identifier looks like a paperId (typically a long hex string)
      if (!paperId && identifier && !identifier.includes('arxiv.org') && !identifier.includes('arXiv:')) {
        // PaperId is typically a 40-character hex string or similar
        if (/^[a-f0-9]{20,}$/i.test(identifier) || identifier.length > 20) {
          paperId = identifier;
          console.log(`🔍 [getCitingPapers] Trying identifier as paperId: ${paperId}`);
        }
      }

      if (!paperId) {
        console.warn(`⚠️  [getCitingPapers] Could not determine paperId from identifier: ${identifier}`);
        console.warn(`    Tried: arxivId=${arxivId}, identifier=${identifier}`);
        return [];
      }

      await this.waitForRateLimit();

      const fields = [
        'paperId',
        'title',
        'authors',
        'year',
        'abstract',
        'citationCount',
        'url'
      ].join(',');

      // Get citations (papers that cite this paper) with pagination
      // Use paperId directly instead of arXiv ID for more reliable results
      const url = `${this.BASE_URL}/paper/${paperId}/citations?fields=${fields}&limit=${limit}&offset=${offset}`;
      
      console.log(`🔍 [getCitingPapers] Fetching citing papers for paperId:${paperId} (limit=${limit}, offset=${offset})`);
      console.log(`    URL: ${url}`);

      // Use retry with backoff for rate limiting
      const response = await this.retryWithBackoff(async () => {
        await this.waitForRateLimit();
        return await axios.get(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'PaperMaster/1.0 (https://example.com/contact)'
          },
          timeout: 15000
        });
      });

      if (!response.data || !response.data.data) {
        console.warn(`⚠️  No data in response for citing papers`);
        return [];
      }

      const totalResults = response.data.total || 0;
      console.log(`📊 Semantic Scholar returned ${response.data.data.length} citing papers (total available: ${totalResults})`);
      
      // Log first paper structure for debugging
      if (response.data.data.length > 0) {
        const firstItem = response.data.data[0];
        console.log(`🔍 Sample citing paper structure:`, {
          hasCitingPaper: !!firstItem.citingPaper,
          citingPaperKeys: firstItem.citingPaper ? Object.keys(firstItem.citingPaper) : [],
          directKeys: Object.keys(firstItem),
          citationCount: firstItem.citingPaper?.citationCount ?? firstItem.citationCount ?? 'missing'
        });
      }

      let citingPapers = response.data.data.map((item: any, index: number) => {
        const paper = item.citingPaper || item;
        let citationCount = paper.citationCount;
        
        // Log if citationCount is missing
        if (citationCount === undefined || citationCount === null) {
          console.warn(`⚠️  [getCitingPapers] Citing paper ${index + 1} "${paper.title?.substring(0, 40)}..." has no citationCount in API response (paperId: ${paper.paperId})`);
          console.warn(`   Available fields: ${Object.keys(paper).join(', ')}`);
          // Check for alternative field names
          if (paper.citations !== undefined) {
            console.warn(`   Found 'citations' field instead (value: ${paper.citations})`);
          }
        } else {
          console.debug(`✅ [getCitingPapers] Paper ${index + 1} has citationCount: ${citationCount} (paperId: ${paper.paperId})`);
        }
        
        // Extract authors - Semantic Scholar API should return all authors
        // Check if authors is an array of objects or strings
        let authors: string[] = [];
        if (paper.authors && Array.isArray(paper.authors)) {
          authors = paper.authors.map((author: any) => {
            if (typeof author === 'string') {
              return author;
            } else if (author && typeof author === 'object' && author.name) {
              return author.name;
            } else if (author) {
              return String(author);
            }
            return '';
          }).filter((name: string) => name && name.length > 0);
        }
        
        // Debug log for papers with many authors
        if (authors.length > 10 || paper.title?.toLowerCase().includes('neural machine translation')) {
          console.log(`📝 [getCitingPapers] Paper with ${authors.length} authors: "${paper.title?.substring(0, 50)}..."`);
          console.log(`   First 3: ${authors.slice(0, 3).join(', ')}`);
          console.log(`   Last 3: ${authors.slice(-3).join(', ')}`);
        }
        
        return {
          id: paper.paperId || `paper_${Date.now()}_${Math.random()}`,
          title: paper.title || 'Unknown Title',
          authors: authors.length > 0 ? authors : [],
          year: paper.year?.toString(),
          abstract: paper.abstract,
          url: paper.url || (paper.paperId ? `https://www.semanticscholar.org/paper/${paper.paperId}` : undefined),
          citationCount: citationCount, // This might be undefined
        };
      });

      // Sort papers if requested
      if (sortBy === 'year' && citingPapers.length > 0) {
        citingPapers.sort((a: { year?: string }, b: { year?: string }) => {
          const yearA = a.year ? parseInt(a.year) : 0;
          const yearB = b.year ? parseInt(b.year) : 0;
          return sortOrder === 'asc' ? yearA - yearB : yearB - yearA;
        });
      } else if (sortBy === 'citationCount' && citingPapers.length > 0) {
        citingPapers.sort((a: { citationCount?: number }, b: { citationCount?: number }) => {
          const countA = a.citationCount || 0;
          const countB = b.citationCount || 0;
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        });
      }

      const withCitationCount = citingPapers.filter((p: { citationCount?: number }) => p.citationCount !== undefined && p.citationCount !== null).length;
      console.log(`✅ Found ${citingPapers.length} citing papers, ${withCitationCount} with citationCount`);
      
      // Log year distribution for debugging
      if (citingPapers.length > 0) {
        const years = citingPapers.map((p: { year?: string }) => p.year).filter(Boolean);
        const yearRange = years.length > 0 ? `${Math.min(...years.map((y: string) => parseInt(y)))}-${Math.max(...years.map((y: string) => parseInt(y)))}` : 'N/A';
        console.log(`📅 Year range of citing papers: ${yearRange}`);
      }
      
      return citingPapers;

    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn(`⚠️  Rate limit exceeded while fetching citing papers`);
      } else if (error.response?.status === 404) {
        console.warn(`⚠️  Paper not found in Semantic Scholar for citations`);
      } else {
        console.error(`❌ Error fetching citing papers:`, error.message);
      }
      return [];
    }
  }

  /**
   * Get papers referenced by this paper (prior works)
   * Supports arXiv ID or paperId
   */
  static async getReferences(
    identifier: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Array<{
    id: string;
    title: string;
    authors: string[];
    year?: string;
    abstract?: string;
    url?: string;
    citationCount?: number;
  }>> {
    const {
      limit = 100,
      offset = 0,
    } = options;

    try {
      // Resolve to paperId via arXiv if possible
      let paperId: string | null = null;
      const arxivId = this.extractArxivId(identifier);
      if (arxivId) {
        const arxivResult = await this.queryByArxivId(arxivId);
        if (arxivResult.success && arxivResult.data?.paperId) {
          paperId = arxivResult.data.paperId;
          console.log(`✅ Found paperId ${paperId} from arXiv ID ${arxivId} for references`);
        }
      }
      if (!paperId) {
        // If identifier already looks like a paperId, try it directly
        if (identifier && !identifier.includes('arxiv.org') && !identifier.includes('arXiv:')) {
          paperId = identifier;
        }
      }
      if (!paperId) {
        console.warn(`⚠️  Could not determine paperId for references from identifier: ${identifier}`);
        return [];
      }

      await this.waitForRateLimit();

      const fields = [
        'paperId',
        'title',
        'authors',
        'year',
        'abstract',
        'citationCount',
        'url'
      ].join(',');

      const url = `${this.BASE_URL}/paper/${paperId}/references?fields=${fields}&limit=${limit}&offset=${offset}`;
      console.log(`🔍 Fetching references for paperId:${paperId} (limit=${limit}, offset=${offset})`);

      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PaperMaster/1.0 (https://example.com/contact)'
        },
        timeout: 15000
      });

      if (!response.data || !response.data.data) {
        console.warn(`⚠️  No data in response for references`);
        return [];
      }

      const refs = response.data.data.map((item: any, index: number) => {
        const paper = item.citedPaper || item;
        const citationCount = paper.citationCount;
        if (citationCount === undefined || citationCount === null) {
          console.debug(`⚠️  Reference ${index + 1} "${paper.title?.substring(0, 40)}..." has no citationCount (paperId: ${paper.paperId})`);
        }
        
        // Extract authors - ensure we get all authors
        let authors: string[] = [];
        if (paper.authors && Array.isArray(paper.authors)) {
          authors = paper.authors.map((author: any) => {
            if (typeof author === 'string') {
              return author;
            } else if (author && typeof author === 'object' && author.name) {
              return author.name;
            } else if (author) {
              return String(author);
            }
            return '';
          }).filter((name: string) => name && name.length > 0);
        }
        
        // Debug log for papers with many authors
        if (authors.length > 10 || paper.title?.toLowerCase().includes('neural machine translation')) {
          console.log(`📝 [getReferences] Paper with ${authors.length} authors: "${paper.title?.substring(0, 50)}..."`);
          console.log(`   First 3 authors: ${authors.slice(0, 3).join(', ')}`);
          console.log(`   Last 3 authors: ${authors.slice(-3).join(', ')}`);
        }
        
        return {
          id: paper.paperId || `paper_${Date.now()}_${Math.random()}`,
          title: paper.title || 'Unknown Title',
          authors: authors.length > 0 ? authors : [],
          year: paper.year?.toString(),
          abstract: paper.abstract,
          url: paper.url || (paper.paperId ? `https://www.semanticscholar.org/paper/${paper.paperId}` : undefined),
          citationCount: citationCount,
        };
      });

      console.log(`✅ Found ${refs.length} references, ${refs.filter((p: { citationCount?: number }) => p.citationCount !== undefined && p.citationCount !== null).length} with citationCount`);
      return refs;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn(`⚠️  Rate limit exceeded while fetching references`);
      } else if (error.response?.status === 404) {
        console.warn(`⚠️  Paper not found in Semantic Scholar for references`);
      } else {
        console.error(`❌ Error fetching references:`, error.message);
      }
      return [];
    }
  }

  /**
   * Get all citing papers across multiple pages
   * This ensures we get papers from all time periods, not just recent ones
   */
  static async getAllCitingPapers(
    identifier: string,
    options: {
      maxResults?: number;
      pagesToFetch?: number;
      fetchAllAvailable?: boolean; // 是否获取所有可用的论文
    } = {}
  ): Promise<Array<{
    id: string;
    title: string;
    authors: string[];
    year?: string;
    abstract?: string;
    url?: string;
    citationCount?: number;
  }>> {
    const {
      maxResults = 100, // 默认值改为100篇（避免太多）
      pagesToFetch = 2, // 默认值改为2页（每页100篇，最多200篇）
      fetchAllAvailable = false // 是否获取所有可用的论文
    } = options;

    // First, try to get the first page to see total available
    const firstPage = await this.getCitingPapers(identifier, {
      limit: 100,
      offset: 0,
      sortBy: 'year',
      sortOrder: 'desc'
    });

    if (firstPage.length === 0) {
      return [];
    }

    const allPapers: Array<{
      id: string;
      title: string;
      authors: string[];
      year?: string;
      abstract?: string;
      url?: string;
      citationCount?: number;
    }> = [...firstPage];

    // Get total available from the first request if available
    // We'll need to check the response to see if there's a total field
    // For now, we'll fetch pages until we get no more results or hit the limit

    // Calculate how many pages to fetch
    let pagesNeeded: number;
    if (fetchAllAvailable) {
      // If fetching all available, we'll keep fetching until no more results
      pagesNeeded = 100; // Set a high limit, we'll break early when no more results
    } else {
      pagesNeeded = Math.min(pagesToFetch - 1, Math.ceil((maxResults - firstPage.length) / 100));
    }
    
    console.log(`📊 [getAllCitingPapers] Will fetch up to ${pagesNeeded} additional pages (already have ${firstPage.length} papers)`);
    
    for (let page = 1; (fetchAllAvailable || (page <= pagesNeeded && allPapers.length < maxResults)); page++) {
      await this.waitForRateLimit();
      
      const nextPage = await this.getCitingPapers(identifier, {
        limit: 100,
        offset: page * 100,
        sortBy: 'year',
        sortOrder: 'desc'
      });

      if (nextPage.length === 0) {
        console.log(`📊 [getAllCitingPapers] No more results at page ${page}, stopping`);
        break; // No more results
      }

      // Add unique papers only (by paperId)
      const existingIds = new Set(allPapers.map(p => p.id));
      let addedCount = 0;
      for (const paper of nextPage) {
        if (!existingIds.has(paper.id)) {
          if (!fetchAllAvailable && allPapers.length >= maxResults) {
            break;
          }
          allPapers.push(paper);
          addedCount++;
        }
      }

      console.log(`📊 [getAllCitingPapers] Page ${page}: added ${addedCount} new papers (total: ${allPapers.length})`);

      // If we're not fetching all and we've reached the limit, stop
      if (!fetchAllAvailable && allPapers.length >= maxResults) {
        console.log(`📊 [getAllCitingPapers] Reached maxResults limit of ${maxResults}, stopping`);
        break;
      }

      // Safety check: if we didn't add any new papers, stop
      if (addedCount === 0) {
        console.log(`📊 [getAllCitingPapers] No new papers added at page ${page}, stopping`);
        break;
      }
    }

      // Filter out papers with invalid or future years BEFORE sorting
      const currentYear = new Date().getFullYear();
      const validPapers = allPapers.filter((p: { year?: string; title?: string }) => {
        if (!p.year) return true; // Keep papers without year for now
        const year = parseInt(p.year);
        if (isNaN(year)) return true; // Keep papers with invalid year format
        // Strictly filter out future years - only keep papers up to current year
        // Some APIs may return papers with wrong years, so we're strict here
        if (year > currentYear) {
          console.log(`⚠️  [getAllCitingPapers] Filtering out paper with future year ${year}: "${p.title?.substring(0, 50)}..."`);
          return false;
        }
        // Also filter out obviously wrong years (e.g., before 1900, after current year)
        if (year < 1900 || year > currentYear) {
          return false;
        }
        return true;
      });

    if (validPapers.length < allPapers.length) {
      console.log(`📅 [getAllCitingPapers] Filtered out ${allPapers.length - validPapers.length} papers with invalid/future years`);
    }

    // Sort by year descending to show latest first, but we have all years
    validPapers.sort((a: { year?: string }, b: { year?: string }) => {
      const yearA = a.year ? parseInt(a.year) : 0;
      const yearB = b.year ? parseInt(b.year) : 0;
      return yearB - yearA;
    });

    console.log(`📊 Collected ${validPapers.length} citing papers across all pages (after filtering)`);
    
    // Log distribution by decade
    const byDecade: { [decade: string]: number } = {};
    const yearsWithCount: { [year: string]: number } = {};
    validPapers.forEach((p: { year?: string }) => {
      if (p.year) {
        const year = parseInt(p.year);
        const decade = Math.floor(year / 10) * 10;
        byDecade[decade.toString()] = (byDecade[decade.toString()] || 0) + 1;
        yearsWithCount[p.year] = (yearsWithCount[p.year] || 0) + 1;
      }
    });
    
    // Calculate year range
    const years = allPapers
      .map((p: { year?: string }) => p.year)
      .filter((y): y is string => Boolean(y))
      .map((y: string) => parseInt(y));
    const yearRange = years.length > 0 ? {
      min: Math.min(...years),
      max: Math.max(...years),
      span: Math.max(...years) - Math.min(...years)
    } : null;
    
    // Check if year range is too narrow (less than 5 years span and we have many papers)
    // This might indicate we're only getting recent papers
    if (yearRange && yearRange.span < 5 && allPapers.length > 100) {
      console.warn(`⚠️  Year range is narrow (${yearRange.span} years) despite having ${allPapers.length} papers.`);
      console.warn(`   This might indicate that older papers are not being returned by Semantic Scholar API.`);
      console.warn(`   Consider increasing pagesToFetch or checking if the paper has citations from different time periods.`);
    }
    
    console.log(`📅 Distribution by decade:`, byDecade);
    if (yearRange) {
      console.log(`📅 Year range: ${yearRange.min} - ${yearRange.max} (span: ${yearRange.span} years)`);
    }
    
    // Show top years
    const topYears = Object.keys(yearsWithCount)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .slice(0, 15);
    if (topYears.length > 0) {
      console.log(`📅 Top ${topYears.length} years:`, topYears.map(y => `${y}: ${yearsWithCount[y]}`).join(', '));
    }

    return validPapers;
  }

  /**
   * Get all citing papers with time distribution and preference for papers with citations
   * This ensures derivative works are distributed across time periods and prioritized by citation count
   */
  static async getAllCitingPapersWithTimeDistribution(
    identifier: string,
    options: {
      maxResults?: number;
      pagesToFetch?: number;
      sourcePaperYear?: number; // Original paper's publication year
      preferWithCitations?: boolean; // Prefer papers with citation counts > 0
    } = {}
  ): Promise<Array<{
    id: string;
    title: string;
    authors: string[];
    year?: string;
    abstract?: string;
    url?: string;
    citationCount?: number;
  }>> {
    const {
      maxResults = 100,
      pagesToFetch = 3,
      sourcePaperYear,
      preferWithCitations = true
    } = options;

    console.log(`📊 [getAllCitingPapersWithTimeDistribution] Strategy: maxResults=${maxResults}, pagesToFetch=${pagesToFetch}, sourcePaperYear=${sourcePaperYear || 'unknown'}, preferWithCitations=${preferWithCitations}`);

    // Strategy: Fetch multiple pages with different sorting to get diverse papers
    // 1. First, get papers sorted by citationCount (desc) - these are likely to have citations
    // 2. Then, get papers sorted by year to ensure time coverage
    // 3. Merge and distribute evenly across time periods

    const allPapers: Array<{
      id: string;
      title: string;
      authors: string[];
      year?: string;
      abstract?: string;
      url?: string;
      citationCount?: number;
    }> = [];

    // Step 1: Get papers sorted by citationCount (prioritize papers with citations)
      // 🚀 IMPROVED: Fetch more pages to get more high-citation papers
    if (preferWithCitations) {
        console.log(`📊 [Step 1] Fetching papers sorted by citationCount (desc) - prioritizing high-citation papers...`);
      try {
          // Fetch multiple pages of citation-sorted papers to get more high-quality results
          const citationPages = Math.min(3, pagesToFetch); // Use up to 3 pages for citation sorting
          for (let page = 0; page < citationPages; page++) {
            await this.waitForRateLimit();
            
        const papersByCitations = await this.getCitingPapers(identifier, {
          limit: 100,
              offset: page * 100,
          sortBy: 'citationCount',
          sortOrder: 'desc'
        });
            
            if (papersByCitations.length === 0) break;
        
        // Filter out papers without citation count or with 0 citations
        const papersWithCitations = papersByCitations.filter(p => 
          p.citationCount !== undefined && p.citationCount !== null && p.citationCount > 0
        );
        
            console.log(`📊 [Step 1.${page + 1}] Found ${papersWithCitations.length} papers with citations (out of ${papersByCitations.length} total)`);
        allPapers.push(...papersWithCitations);
          }
          
          console.log(`✅ [Step 1 Complete] Total papers with citations collected: ${allPapers.length}`);
      } catch (error) {
        console.warn(`⚠️  Failed to fetch papers by citationCount:`, error);
      }
    }

    // Step 2: Get papers with better time coverage
    // 🚀 FIXED: Semantic Scholar API doesn't actually sort by year/citationCount in the URL
    // We need to fetch more pages and manually distribute by year
    console.log(`📊 [Step 2] Fetching more papers to ensure time coverage across all years...`);
    const papersByYear: Array<{
      id: string;
      title: string;
      authors: string[];
      year?: string;
      abstract?: string;
      url?: string;
      citationCount?: number;
    }> = [];

    // Fetch more pages to get papers from different time periods
    // API returns papers in default order (usually recent first), so we fetch many pages
    const pagesToFetchForYearCoverage = Math.max(pagesToFetch * 2, 10); // Fetch more pages for year diversity
    
    for (let page = 0; page < pagesToFetchForYearCoverage; page++) {
      await this.waitForRateLimit();
      
      try {
        // Don't rely on sortBy parameter - Semantic Scholar API may not support it
        // Instead, fetch raw results and we'll sort/distribute manually
        const pagePapers = await this.getCitingPapers(identifier, {
          limit: 100,
          offset: page * 100,
          // Note: sortBy/sortOrder may be ignored by API
          sortBy: 'year',
          sortOrder: 'desc'
        });
        
        if (pagePapers.length === 0) break;
        
        // Log year distribution in this page for debugging
        const pageYears = pagePapers.map(p => p.year).filter(Boolean).map(y => parseInt(y as string));
        if (pageYears.length > 0) {
          const pageYearRange = `${Math.min(...pageYears)}-${Math.max(...pageYears)}`;
          console.log(`📅 [Step 2.${page + 1}] Page ${page + 1}: ${pagePapers.length} papers, year range: ${pageYearRange}`);
        }
        
        papersByYear.push(...pagePapers);
        
        // If we got less than 100 papers, we've reached the end
        if (pagePapers.length < 100) break;
      } catch (error) {
        console.warn(`⚠️  Failed to fetch page ${page + 1}:`, error);
        break;
      }
    }

    console.log(`📊 [Step 2] Collected ${papersByYear.length} papers from ${pagesToFetchForYearCoverage} pages`);

    // Step 3: Merge and deduplicate
    const paperMap = new Map<string, typeof allPapers[0]>();
    
    // First, add papers with citations (priority)
    for (const paper of allPapers) {
      paperMap.set(paper.id, paper);
    }
    
    // Then, add papers from year-sorted queries (fill gaps)
    for (const paper of papersByYear) {
      if (!paperMap.has(paper.id)) {
        paperMap.set(paper.id, paper);
      }
    }

    const mergedPapers = Array.from(paperMap.values());

    // Step 4: Filter out future years
    const currentYear = new Date().getFullYear();
    const validPapers = mergedPapers.filter((p: { year?: string; title?: string }) => {
      if (!p.year) return true;
      const year = parseInt(p.year);
      if (isNaN(year)) return true;
      if (year > currentYear || year < 1900) {
        console.log(`⚠️  Filtering out paper with invalid year ${year}: "${p.title?.substring(0, 50)}..."`);
        return false;
      }
      return true;
    });

      // Step 5: Distribute papers evenly across time periods with better time coverage
      // 🚀 FIXED: Ensure we get papers from ALL years, not just recent ones
    let distributedPapers: typeof validPapers = [];
    
    if (sourcePaperYear && validPapers.length > 0) {
        // Calculate time range - ensure we cover a wide span
      const yearRange = currentYear - sourcePaperYear + 1;
      
        // Group papers by individual year (not periods) to ensure year-by-year coverage
      const papersByYearGroup: { [year: string]: typeof validPapers } = {};
        const yearsWithPapers: number[] = [];
        
      for (const paper of validPapers) {
        if (paper.year) {
          const year = parseInt(paper.year);
          if (!isNaN(year) && year >= sourcePaperYear && year <= currentYear) {
            const yearStr = year.toString();
            if (!papersByYearGroup[yearStr]) {
              papersByYearGroup[yearStr] = [];
                yearsWithPapers.push(year);
            }
            papersByYearGroup[yearStr].push(paper);
          }
        }
      }
      
        // Sort years
        yearsWithPapers.sort((a, b) => a - b);
        
        console.log(`📊 [Step 5] Distributing ${validPapers.length} papers across ${yearRange} years (${sourcePaperYear} - ${currentYear})`);
        console.log(`📅 Found papers in ${yearsWithPapers.length} different years: ${yearsWithPapers.slice(0, 10).join(', ')}${yearsWithPapers.length > 10 ? '...' : ''}`);
        
        // Calculate how many papers per year to ensure even distribution
        // We want at least 1 paper from each year that has papers, but prioritize high-citation papers
        const targetPerYear = Math.max(1, Math.floor(maxResults / Math.min(yearsWithPapers.length, 15))); // Max 15 years to avoid too few per year
        console.log(`   Target: ${targetPerYear} papers per year (will prioritize high-citation papers)`);
        
        // First pass: Get top papers from each year (prioritizing high citations)
        for (const year of yearsWithPapers) {
        const yearStr = year.toString();
          const yearPapers = papersByYearGroup[yearStr];
        
        // Sort by citationCount (desc) to prioritize papers with citations
        yearPapers.sort((a, b) => {
          const countA = a.citationCount || 0;
          const countB = b.citationCount || 0;
          return countB - countA;
        });
        
        // Take top papers from this year
          const selected = yearPapers.slice(0, targetPerYear);
        distributedPapers.push(...selected);
          
          if (selected.length > 0) {
            console.log(`   📅 ${year}: Selected ${selected.length} papers (top citationCount: ${selected[0]?.citationCount || 0})`);
          }
        
        if (distributedPapers.length >= maxResults) break;
      }
      
        // Second pass: If we haven't filled quota and have years with more papers, take more from those years
      if (distributedPapers.length < maxResults) {
          // Find years that still have papers available
          const remainingByYear: { [year: string]: typeof validPapers } = {};
          for (const year of yearsWithPapers) {
            const yearStr = year.toString();
            const alreadySelected = distributedPapers.filter(p => p.year === yearStr);
            const yearPapers = papersByYearGroup[yearStr];
            const remaining = yearPapers.filter(p => !alreadySelected.some(selected => selected.id === p.id));
            
            if (remaining.length > 0) {
              remainingByYear[yearStr] = remaining;
            }
          }
          
          // Sort remaining papers across all years by citationCount and take top ones
          const allRemaining = Object.values(remainingByYear).flat();
          allRemaining.sort((a, b) => {
          const countA = a.citationCount || 0;
          const countB = b.citationCount || 0;
          return countB - countA;
        });
          
          const additionalNeeded = maxResults - distributedPapers.length;
          const additionalPapers = allRemaining.slice(0, additionalNeeded);
          distributedPapers.push(...additionalPapers);
          
          console.log(`📊 Added ${additionalPapers.length} additional high-citation papers from various years`);
      }
    } else {
      // No source year: just prioritize by citationCount and limit
      validPapers.sort((a, b) => {
        // First, prioritize papers with citation counts
        const hasCitationA = (a.citationCount !== undefined && a.citationCount !== null && a.citationCount > 0) ? 1 : 0;
        const hasCitationB = (b.citationCount !== undefined && b.citationCount !== null && b.citationCount > 0) ? 1 : 0;
        if (hasCitationA !== hasCitationB) {
          return hasCitationB - hasCitationA; // Papers with citations first
        }
        // Then sort by citationCount
        const countA = a.citationCount || 0;
        const countB = b.citationCount || 0;
        return countB - countA;
      });
      
      distributedPapers = validPapers.slice(0, maxResults);
    }

    // Final sort by year (desc) for display
    distributedPapers.sort((a, b) => {
      const yearA = a.year ? parseInt(a.year) : 0;
      const yearB = b.year ? parseInt(b.year) : 0;
      return yearB - yearA;
    });

    const withCitations = distributedPapers.filter(p => p.citationCount !== undefined && p.citationCount !== null && p.citationCount > 0).length;
    console.log(`✅ [getAllCitingPapersWithTimeDistribution] Final result: ${distributedPapers.length} papers, ${withCitations} with citations`);
    
    // Log year distribution
    const yearDist: { [year: string]: number } = {};
    distributedPapers.forEach(p => {
      if (p.year) {
        yearDist[p.year] = (yearDist[p.year] || 0) + 1;
      }
    });
    console.log(`📅 Year distribution:`, Object.entries(yearDist).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 10));

    return distributedPapers;
  }

  /**
   * Batch query papers by paperIds to get citationCount efficiently
   * This uses Semantic Scholar's batch endpoint to query multiple papers at once
   */
  static async batchQueryPapers(paperIds: string[]): Promise<Map<string, number>> {
    const citationCountMap = new Map<string, number>();
    
    if (!paperIds || paperIds.length === 0) {
      return citationCountMap;
    }

    // Semantic Scholar batch endpoint can handle up to 500 IDs per request
    const BATCH_SIZE = 100; // Use smaller batch to avoid rate limits
    const fields = ['paperId', 'citationCount'].join(',');

    for (let i = 0; i < paperIds.length; i += BATCH_SIZE) {
      const batch = paperIds.slice(i, i + BATCH_SIZE);
      
      try {
        await this.waitForRateLimit();
        
        // Use batch endpoint: /paper/batch
        // Semantic Scholar batch API uses POST with paperIds in body, or GET with comma-separated ids
        // Try POST first (more reliable for large batches)
        const url = `${this.BASE_URL}/paper/batch`;
        
        console.log(`📦 [batchQueryPapers] Querying batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(paperIds.length / BATCH_SIZE)} (${batch.length} papers)`);
        console.log(`   PaperIds sample: ${batch.slice(0, 3).join(', ')}...`);
        
        const response = await this.retryWithBackoff(async () => {
          await this.waitForRateLimit();
          
          // Try POST method first (recommended for batch queries)
          try {
            return await axios.post(url, {
              ids: batch
            }, {
              params: {
                fields: fields
              },
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'PaperMaster/1.0 (https://example.com/contact)'
              },
              timeout: 20000
            });
          } catch (postError: any) {
            // If POST fails, try GET with comma-separated IDs
            if (postError.response?.status === 404 || postError.response?.status === 405) {
              console.log(`   POST failed, trying GET method...`);
              const idsParam = batch.join(',');
              const getUrl = `${this.BASE_URL}/paper/batch?ids=${idsParam}&fields=${fields}`;
              return await axios.get(getUrl, {
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'PaperMaster/1.0 (https://example.com/contact)'
                },
                timeout: 20000
              });
            }
            throw postError;
          }
        });

        if (response.data && Array.isArray(response.data)) {
          response.data.forEach((paper: any) => {
            if (paper && paper.paperId && paper.citationCount !== undefined && paper.citationCount !== null) {
              citationCountMap.set(paper.paperId, paper.citationCount);
            }
          });
          
          const foundCount = response.data.filter((p: any) => p && p.citationCount !== undefined && p.citationCount !== null).length;
          console.log(`✅ [batchQueryPapers] Found citationCount for ${foundCount}/${batch.length} papers in batch`);
        }
        
        // Add delay between batches
        if (i + BATCH_SIZE < paperIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error: any) {
        console.error(`❌ [batchQueryPapers] Error querying batch:`, error.message);
        // Continue with next batch even if this one fails
      }
    }

    console.log(`✅ [batchQueryPapers] Total citationCount found: ${citationCountMap.size}/${paperIds.length}`);
    return citationCountMap;
  }
}
