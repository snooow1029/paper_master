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
  private static async waitForRateLimit(): Promise<void> {
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
    // Handle URLs like https://arxiv.org/pdf/2305.10403.pdf
    const urlMatch = input.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)(?:v\d+)?/i);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Handle raw arXiv IDs like arXiv:2305.10403v3[cs.CL] or 2305.10403
    const idMatch = input.match(/(?:arXiv:)?(\d+\.\d+)(?:v\d+)?/i);
    if (idMatch) {
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
}
