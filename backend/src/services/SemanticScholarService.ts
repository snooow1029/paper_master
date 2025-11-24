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
  private static readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests
  private static lastRequestTime = 0;

  /**
   * Wait for rate limit if necessary
   */
  static async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const waitTime = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
      console.log(`⏳ Waiting ${waitTime}ms for rate limit...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
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

      const fields = [
        'title',
        'authors',
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

      console.log(`✅ Semantic Scholar response:`, {
        title: response.data.title,
        venue: response.data.venue,
        year: response.data.year,
        publicationTypes: response.data.publicationTypes,
        citationCount: response.data.citationCount
      });

      return {
        success: true,
        data: response.data
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
      authors: paper.authors?.map((author: any) => 
        typeof author === 'string' ? author : author.name || 'Unknown Author'
      ) || [],
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

      // Clean and normalize title - remove special characters and normalize spacing
      const cleanTitle = title.trim()
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/[^\w\s-]/g, ' ')  // Remove special chars but keep hyphens
        .trim();

      // Try multiple search strategies
      const searchQueries = [];
      
      // Strategy 1: Title only
      searchQueries.push(cleanTitle);
      
      // Strategy 2: Title + first author
      if (authors && authors.length > 0) {
        const firstAuthor = authors[0].trim();
        // Try to extract last name (usually last word)
        const authorParts = firstAuthor.split(/\s+/);
        const lastName = authorParts.length > 1 ? authorParts[authorParts.length - 1] : authorParts[0];
        searchQueries.push(`${cleanTitle} ${lastName}`);
      }
      
      // Strategy 3: Title + year
      if (year) {
        searchQueries.push(`${cleanTitle} ${year}`);
      }
      
      // Strategy 4: Title + author + year
      if (authors && authors.length > 0 && year) {
        const firstAuthor = authors[0].trim();
        const authorParts = firstAuthor.split(/\s+/);
        const lastName = authorParts.length > 1 ? authorParts[authorParts.length - 1] : authorParts[0];
        searchQueries.push(`${cleanTitle} ${lastName} ${year}`);
      }
      
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

      // Lower threshold to 0.3 to accept more matches
      if (bestMatch && bestScore > 0.3) {
        console.log(`✅ Found match with similarity ${bestScore.toFixed(2)}: "${bestMatch.title}" (citationCount: ${bestMatch.citationCount || 'N/A'})`);
        
        return {
          success: true,
          data: {
            title: bestMatch.title,
            authors: bestMatch.authors?.map((a: any) => 
              typeof a === 'string' ? a : a.name || 'Unknown Author'
            ) || [],
            year: bestMatch.year,
            citationCount: bestMatch.citationCount,
            abstract: bestMatch.abstract,
            paperId: bestMatch.paperId,
            url: bestMatch.url
          }
        };
      }

      // Log top candidates for debugging
      console.warn(`⚠️  No good match found (best similarity: ${bestScore.toFixed(2)}, threshold: 0.3)`);
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

      console.log(`✅ Found paper by paperId: "${response.data.title}" (citationCount: ${response.data.citationCount || 'N/A'})`);

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
          citationCount: response.data.citationCount,
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
        // First get the paperId from arXiv ID
        const arxivResult = await this.queryByArxivId(arxivId);
        if (arxivResult.success && arxivResult.data?.paperId) {
          paperId = arxivResult.data.paperId;
          console.log(`✅ Found paperId ${paperId} from arXiv ID ${arxivId}`);
        }
      }

      // Method 2: If no paperId yet, try to find it by treating identifier as paperId
      if (!paperId && identifier && !identifier.includes('arxiv.org') && !identifier.includes('arXiv:')) {
        // Might already be a paperId
        paperId = identifier;
        console.log(`🔍 Trying identifier as paperId: ${paperId}`);
      }

      if (!paperId) {
        console.warn(`⚠️  Could not determine paperId from identifier: ${identifier}`);
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
      
      console.log(`🔍 Fetching citing papers for paperId:${paperId} (limit=${limit}, offset=${offset})`);

      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PaperMaster/1.0 (https://example.com/contact)'
        },
        timeout: 15000
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
        const citationCount = paper.citationCount;
        
        // Log if citationCount is missing
        if (citationCount === undefined || citationCount === null) {
          console.debug(`⚠️  Citing paper ${index + 1} "${paper.title?.substring(0, 40)}..." has no citationCount (paperId: ${paper.paperId})`);
        }
        
        return {
          id: paper.paperId || `paper_${Date.now()}_${Math.random()}`,
          title: paper.title || 'Unknown Title',
          authors: paper.authors?.map((author: any) => 
            typeof author === 'string' ? author : author.name || 'Unknown Author'
          ) || [],
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
      maxResults = 500, // 增加默认值到500篇
      pagesToFetch = 10, // 增加默认值到10页（每页100篇，最多1000篇）
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

    // Sort by year descending to show latest first, but we have all years
    allPapers.sort((a: { year?: string }, b: { year?: string }) => {
      const yearA = a.year ? parseInt(a.year) : 0;
      const yearB = b.year ? parseInt(b.year) : 0;
      return yearB - yearA;
    });

    console.log(`📊 Collected ${allPapers.length} citing papers across all pages`);
    
    // Log distribution by decade
    const byDecade: { [decade: string]: number } = {};
    const yearsWithCount: { [year: string]: number } = {};
    allPapers.forEach((p: { year?: string }) => {
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

    return allPapers;
  }
}
