import axios from 'axios';
import * as cheerio from 'cheerio';
import { AppDataSource } from '../config/database';
import { Paper } from '../entities/Paper';
import { AdvancedCitationService } from './AdvancedCitationService';

export class PaperService {
  private paperRepository = AppDataSource.getRepository(Paper);
  private semanticScholarLastRequest = 0;
  private semanticScholarRequestCount = 0;
  private readonly SEMANTIC_SCHOLAR_RATE_LIMIT = 100; // requests per minute
  private readonly SEMANTIC_SCHOLAR_DELAY = 60000 / 100; // 600ms between requests
  private advancedCitationService = new AdvancedCitationService();

  async fetchPapersFromUrls(urls: string[]): Promise<Paper[]> {
    const papers: Paper[] = [];

    console.log(`Starting to fetch ${urls.length} papers:`, urls);

    for (const url of urls) {
      try {
        console.log(`Fetching paper from: ${url}`);
        const paper = await this.fetchPaperFromUrl(url);
        if (paper) {
          const savedPaper = await this.paperRepository.save(paper);
          papers.push(savedPaper);
          console.log(`Successfully fetched and saved paper: ${paper.title}`);
        } else {
          console.warn(`No paper data extracted from: ${url}`);
        }
      } catch (error) {
        console.error(`Error fetching paper from ${url}:`, error);
        // Continue with other URLs instead of failing completely
      }
    }

    console.log(`Successfully fetched ${papers.length} out of ${urls.length} papers`);
    return papers;
  }

  private async fetchPaperFromUrl(url: string): Promise<Partial<Paper> | null> {
    try {
      console.log(`Determining paper source for URL: ${url}`);
      
      // Clean and normalize URL
      const cleanUrl = url.trim();
      
      if (cleanUrl.includes('arxiv.org') || /^[0-9]{4}\.[0-9]{4,5}/.test(cleanUrl)) {
        console.log('Detected arXiv paper');
        return await this.fetchArxivPaper(cleanUrl);
      } else if (cleanUrl.includes('doi.org') || cleanUrl.startsWith('10.')) {
        console.log('Detected DOI paper');
        return await this.fetchDoiPaper(cleanUrl);
      } else {
        console.log('Detected generic web paper');
        return await this.fetchGenericPaper(cleanUrl);
      }
    } catch (error) {
      console.error(`Error fetching paper from ${url}:`, error);
      return null;
    }
  }

  private async fetchArxivPaper(url: string): Promise<Partial<Paper> | null> {
    try {
      // Extract arXiv ID from URL - support multiple formats
      let arxivMatch = url.match(/arxiv\.org\/abs\/([^?\/\s]+)/i);
      
      // If no match, try alternative formats
      if (!arxivMatch) {
        // Try format like arxiv.org/pdf/1234.5678.pdf (without .pdf extension in ID)
        arxivMatch = url.match(/arxiv\.org\/pdf\/([^?\/\s]+)(?:\.pdf)?/i);
      }
      
      if (!arxivMatch) {
        // Try direct arXiv ID format (just the ID)
        arxivMatch = url.match(/^([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?)/);
      }
      
      if (!arxivMatch) {
        console.error('Invalid arXiv URL format:', url);
        throw new Error(`Invalid arXiv URL format: ${url}`);
      }

      const arxivId = arxivMatch[1];
      console.log(`Fetching arXiv paper with ID: ${arxivId}`);
      
      const apiUrl = `http://export.arxiv.org/api/query?id_list=${arxivId}`;

      const response = await axios.get(apiUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Paper Master Bot 1.0'
        }
      });
      
      const $ = cheerio.load(response.data, { xmlMode: true });

      const entry = $('entry').first();
      if (!entry.length) {
        throw new Error('Paper not found on arXiv');
      }

      const title = entry.find('title').text().trim();
      const authors = entry.find('author name').map((_, el) => $(el).text().trim()).get();
      let abstract = entry.find('summary').text().trim();
      const published = entry.find('published').text().trim();

      // Clean up citation markers from abstract (even from arXiv)
      if (abstract) {
        abstract = abstract
          .replace(/\[\d+(?:,\s*\d+)*\]/g, '') // Remove [1], [1,2,3] style citations
          .replace(/\(\s*[A-Za-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}\s*\)/g, '') // Remove (Author et al., 2020) style citations
          .replace(/\(\s*\d{4}\s*\)/g, '') // Remove (2020) style citations
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      }

      return {
        title,
        authors,
        abstract,
        introduction: '', // Will be filled later if needed
        url,
        arxivId,
        publishedDate: published,
        tags: ['arXiv'],
      };
    } catch (error) {
      console.error('Error fetching arXiv paper:', error);
      return null;
    }
  }

  private async fetchDoiPaper(url: string): Promise<Partial<Paper> | null> {
    try {
      // For DOI papers, we would typically use CrossRef API
      // This is a simplified implementation
      const response = await axios.get(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Paper Master Bot 1.0'
        }
      });

      const $ = cheerio.load(response.data);
      
      const title = $('title').text().trim() || 
                   $('meta[name="citation_title"]').attr('content') || 
                   $('h1').first().text().trim();

      const authors = $('meta[name="citation_author"]')
        .map((_, el) => $(el).attr('content'))
        .get()
        .filter(Boolean);

      let abstract = $('meta[name="citation_abstract"]').attr('content') ||
                    $('#abstract').text().trim() ||
                    $('.abstract').text().trim();

      // Clean up citation markers from abstract
      if (abstract) {
        abstract = abstract
          .replace(/\[\d+(?:,\s*\d+)*\]/g, '') // Remove [1], [1,2,3] style citations
          .replace(/\(\s*[A-Za-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}\s*\)/g, '') // Remove (Author et al., 2020) style citations
          .replace(/\(\s*\d{4}\s*\)/g, '') // Remove (2020) style citations
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      }

      return {
        title,
        authors: authors.length > 0 ? authors : ['Unknown'],
        abstract: abstract || 'Abstract not available',
        introduction: '',
        url,
        doi: url.includes('doi.org') ? url.split('doi.org/')[1] : undefined,
        tags: ['DOI'],
      };
    } catch (error) {
      console.error('Error fetching DOI paper:', error);
      return null;
    }
  }

  private async fetchGenericPaper(url: string): Promise<Partial<Paper> | null> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Paper Master Bot 1.0'
        }
      });

      const $ = cheerio.load(response.data);
      
      const title = $('title').text().trim() || 
                   $('h1').first().text().trim() ||
                   'Unknown Title';

      // Try to extract some basic information
      let abstract = $('.abstract').text().trim() ||
                    $('#abstract').text().trim() ||
                    $('meta[name="description"]').attr('content') ||
                    'Abstract not available';

      // Clean up citation markers from abstract
      if (abstract && abstract !== 'Abstract not available') {
        abstract = abstract
          .replace(/\[\d+(?:,\s*\d+)*\]/g, '') // Remove [1], [1,2,3] style citations
          .replace(/\(\s*[A-Za-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}\s*\)/g, '') // Remove (Author et al., 2020) style citations
          .replace(/\(\s*\d{4}\s*\)/g, '') // Remove (2020) style citations
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      }

      return {
        title,
        authors: ['Unknown'],
        abstract,
        introduction: '',
        url,
        tags: ['Web'],
      };
    } catch (error) {
      console.error('Error fetching generic paper:', error);
      return null;
    }
  }

  async getAllPapers(): Promise<Paper[]> {
    return await this.paperRepository.find();
  }

  async getPaperById(id: string): Promise<Paper | null> {
    return await this.paperRepository.findOneBy({ id });
  }

  async updatePaper(id: string, updateData: Partial<Paper>): Promise<Paper | null> {
    await this.paperRepository.update(id, updateData);
    return await this.getPaperById(id);
  }

  async deletePaper(id: string): Promise<boolean> {
    const result = await this.paperRepository.delete(id);
    return result.affected !== 0;
  }

  async savePaper(paper: Partial<Paper>): Promise<Paper> {
    return await this.paperRepository.save(paper);
  }

  /**
   * Extract citation network with semantic relationship analysis
   */
  async extractSemanticCitationNetwork(papers: Paper[]): Promise<{
    citedPapers: Paper[];
    citingPapers: Paper[];
    allPapers: Paper[];
    semanticRelationships: Array<{
      fromPaper: string;
      toPaper: string;
      relationship: string;
      context: string;
      confidence: number;
    }>;
  }> {
    console.log(`Extracting semantic citation network for ${papers.length} papers`);
    
    const citedPapers: Paper[] = [];
    const citingPapers: Paper[] = [];
    const semanticRelationships: Array<{
      fromPaper: string;
      toPaper: string;
      relationship: string;
      context: string;
      confidence: number;
    }> = [];
    const processedUrls = new Set<string>();

    // Process papers sequentially to avoid overwhelming APIs
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      
      try {
        console.log(`Processing semantic relationships for paper ${i + 1}/${papers.length}: ${paper.title}`);
        
        // Extract semantic relationships using advanced analysis
        const semanticResults = await this.advancedCitationService.extractSemanticRelationships(paper);
        
        for (const relationship of semanticResults.citedPapers) {
          const relatedPaper = relationship.paper as Paper;
          
          // Add to cited papers if not already processed
          if (!processedUrls.has(relatedPaper.url || relatedPaper.title || '')) {
            citedPapers.push(relatedPaper);
            processedUrls.add(relatedPaper.url || relatedPaper.title || '');
          }
          
          // Record semantic relationship
          semanticRelationships.push({
            fromPaper: paper.title,
            toPaper: relatedPaper.title || 'Unknown',
            relationship: relationship.relationship,
            context: relationship.context,
            confidence: relationship.confidence
          });
        }

        // Add delay between papers to respect rate limits
        if (i < papers.length - 1) {
          console.log('Waiting 3 seconds before processing next paper...');
          await this.sleep(3000);
        }
        
      } catch (error) {
        console.error(`Error processing semantic relationships for ${paper.title}:`, error);
        // Continue with next paper instead of failing
      }
    }

    // Combine all papers (original + cited + citing)
    const allPapers = [...papers];
    
    // Add cited papers that aren't already in the list
    for (const citedPaper of citedPapers) {
      if (!allPapers.some(p => p.url === citedPaper.url || p.title === citedPaper.title)) {
        allPapers.push(citedPaper);
      }
    }

    console.log(`Semantic citation network extracted: ${citedPapers.length} cited papers, ${citingPapers.length} citing papers, ${allPapers.length} total papers, ${semanticRelationships.length} semantic relationships`);

    return {
      citedPapers,
      citingPapers,
      allPapers,
      semanticRelationships
    };
  }
  async extractCitationNetwork(papers: Paper[]): Promise<{
    citedPapers: Paper[];
    citingPapers: Paper[];
    allPapers: Paper[];
  }> {
    console.log(`Extracting citation network for ${papers.length} papers`);
    
    const citedPapers: Paper[] = [];
    const citingPapers: Paper[] = [];
    const processedUrls = new Set<string>();

    // Process papers sequentially to avoid overwhelming APIs
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      
      try {
        console.log(`Processing citations for paper ${i + 1}/${papers.length}: ${paper.title}`);
        
        // Extract papers that cite this paper (limited to avoid rate limits)
        const citations = await this.extractCitations(paper);
        for (const citation of citations.slice(0, 5)) { // Limit to 5 citations per paper
          if (!processedUrls.has(citation.url || citation.title)) {
            citingPapers.push(citation);
            processedUrls.add(citation.url || citation.title);
          }
        }

        // Add delay between papers to respect rate limits
        if (i < papers.length - 1) {
          console.log('Waiting 2 seconds before processing next paper...');
          await this.sleep(2000);
        }
        
      } catch (error) {
        console.error(`Error processing citations for ${paper.title}:`, error);
        // Continue with next paper instead of failing
      }
    }

    // Combine all papers (original + cited + citing)
    const allPapers = [...papers];
    
    // Add cited papers that aren't already in the list
    for (const citedPaper of citedPapers) {
      if (!allPapers.some(p => p.url === citedPaper.url || p.title === citedPaper.title)) {
        allPapers.push(citedPaper);
      }
    }
    
    // Add citing papers that aren't already in the list
    for (const citingPaper of citingPapers) {
      if (!allPapers.some(p => p.url === citingPaper.url || p.title === citingPaper.title)) {
        allPapers.push(citingPaper);
      }
    }

    console.log(`Citation network extracted: ${citedPapers.length} cited papers, ${citingPapers.length} citing papers, ${allPapers.length} total papers`);

    return {
      citedPapers,
      citingPapers,
      allPapers
    };
  }

  /**
   * Extract papers that are referenced by the given paper
   */
  private async extractReferences(paper: Paper): Promise<Paper[]> {
    const references: Paper[] = [];
    
    try {
      if (paper.arxivId) {
        // For arXiv papers, we can extract references from the paper text
        const arxivReferences = await this.extractArxivReferences(paper.arxivId);
        references.push(...arxivReferences);
      } else if (paper.url) {
        // For other papers, try to extract from various sources
        const webReferences = await this.extractWebReferences(paper.url);
        references.push(...webReferences);
      }
    } catch (error) {
      console.error(`Error extracting references for ${paper.title}:`, error);
    }

    return references;
  }

  /**
   * Extract papers that cite the given paper
   */
  private async extractCitations(paper: Paper): Promise<Paper[]> {
    const citations: Paper[] = [];
    
    try {
      console.log(`Extracting citations for: ${paper.title}`);
      
      // Only use Semantic Scholar for now, and with conservative limits
      if (paper.title && paper.title.length > 10) { // Only search for papers with substantial titles
        const scholarCitations = await this.extractScholarCitations(paper);
        citations.push(...scholarCitations);
      } else {
        console.log(`Skipping citation extraction for paper with short title: ${paper.title}`);
      }
      
    } catch (error) {
      console.error(`Error extracting citations for ${paper.title}:`, error);
    }

    return citations;
  }

  /**
   * Extract references from arXiv paper
   */
  private async extractArxivReferences(arxivId: string): Promise<Paper[]> {
    const references: Paper[] = [];
    
    try {
      // Get the paper's full text or use arXiv API to find references
      console.log(`Extracting references for arXiv paper: ${arxivId}`);
      
      // This is a simplified implementation
      // In practice, you might want to:
      // 1. Download the PDF and extract references
      // 2. Use specialized services like Semantic Scholar API
      // 3. Parse LaTeX source if available
      
      // For now, we'll use a mock implementation
      // You can replace this with actual reference extraction logic
      
    } catch (error) {
      console.error(`Error extracting arXiv references for ${arxivId}:`, error);
    }
    
    return references;
  }

  /**
   * Extract references from web-based papers
   */
  private async extractWebReferences(url: string): Promise<Paper[]> {
    const references: Paper[] = [];
    
    try {
      console.log(`Extracting web references from: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Paper Master Bot 1.0)'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Look for common reference patterns
      const referenceLinks = $('a[href*="arxiv.org"], a[href*="doi.org"], a[href*="scholar.google"]').toArray();
      
      for (const link of referenceLinks.slice(0, 10)) { // Limit to first 10 references
        const href = $(link).attr('href');
        if (href) {
          try {
            const refPaper = await this.fetchPaperFromUrl(href);
            if (refPaper) {
              references.push(refPaper as Paper);
            }
          } catch (error) {
            console.warn(`Failed to fetch reference from ${href}:`, error);
          }
        }
      }
      
    } catch (error) {
      console.error(`Error extracting web references from ${url}:`, error);
    }
    
    return references;
  }

  /**
   * Extract papers that cite an arXiv paper
   */
  private async extractArxivCitations(arxivId: string): Promise<Paper[]> {
    const citations: Paper[] = [];
    
    try {
      console.log(`Extracting citations for arXiv paper: ${arxivId}`);
      
      // This would typically use services like:
      // - Semantic Scholar API
      // - Google Scholar
      // - INSPIRE-HEP (for physics papers)
      // - Microsoft Academic (discontinued but data available)
      
      // Mock implementation for now
      // You can integrate with actual citation APIs here
      
    } catch (error) {
      console.error(`Error extracting arXiv citations for ${arxivId}:`, error);
    }
    
    return citations;
  }

  /**
   * Extract citations using Google Scholar or similar services
   */
  private async extractScholarCitations(paper: Paper): Promise<Paper[]> {
    const citations: Paper[] = [];
    
    try {
      console.log(`Extracting Scholar citations for: ${paper.title}`);
      
      // Only use Semantic Scholar API - no mock data fallback for testing
      const semanticScholarCitations = await this.getSemanticScholarCitations(paper);
      citations.push(...semanticScholarCitations);
      
      if (citations.length === 0) {
        console.log(`No citations found via Semantic Scholar for: ${paper.title}`);
      } else {
        console.log(`Found ${citations.length} real citations for: ${paper.title}`);
      }
      
    } catch (error) {
      console.error(`Error extracting Scholar citations for ${paper.title}:`, error);
      // No fallback to mock data - return empty array to test real API
    }
    
    return citations;
  }

  /**
   * Get citations using Semantic Scholar API with rate limiting
   */
  private async getSemanticScholarCitations(paper: Paper): Promise<Paper[]> {
    const citations: Paper[] = [];
    
    try {
      // Apply rate limiting
      await this.waitForSemanticScholarRateLimit();
      
      // Search for the paper on Semantic Scholar
      const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(paper.title)}&limit=1`;
      
      console.log(`Searching Semantic Scholar for: ${paper.title}`);
      
      const searchResponse = await axios.get(searchUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Paper Master Bot 1.0 (Educational Research Tool)'
        }
      });
      
      if (searchResponse.data.data && searchResponse.data.data.length > 0) {
        const semanticPaperId = searchResponse.data.data[0].paperId;
        console.log(`Found paper ID: ${semanticPaperId}`);
        
        // Apply rate limiting again
        await this.waitForSemanticScholarRateLimit();
        
        // Get citations for this paper (limit to 10 to avoid overwhelming)
        const citationsUrl = `https://api.semanticscholar.org/graph/v1/paper/${semanticPaperId}/citations?fields=title,authors,url,abstract,year&limit=10`;
        
        console.log(`Fetching citations for paper: ${semanticPaperId}`);
        
        const citationsResponse = await axios.get(citationsUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Paper Master Bot 1.0 (Educational Research Tool)'
          }
        });
        
        if (citationsResponse.data.data) {
          console.log(`Found ${citationsResponse.data.data.length} citations`);
          
          for (const citation of citationsResponse.data.data) {
            const citingPaper = citation.citingPaper;
            if (citingPaper && citingPaper.title) {
              citations.push({
                title: citingPaper.title,
                authors: citingPaper.authors?.map((a: any) => a.name) || ['Unknown'],
                abstract: citingPaper.abstract || '',
                introduction: '',
                url: citingPaper.url || '',
                publishedDate: citingPaper.year?.toString() || '',
                tags: ['Semantic Scholar', 'Citation']
              } as Paper);
            }
          }
        }
      } else {
        console.log(`No results found on Semantic Scholar for: ${paper.title}`);
      }
      
    } catch (error) {
      if (error instanceof Error && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status === 429) {
          console.warn(`Rate limited by Semantic Scholar for paper: ${paper.title}. Backing off...`);
          // Exponential backoff
          await this.sleep(5000 + Math.random() * 5000);
          return citations; // Return empty array instead of retrying
        } else if (axiosError.response?.status === 404) {
          console.log(`Paper not found on Semantic Scholar: ${paper.title}`);
        } else {
          console.error(`Semantic Scholar API error (${axiosError.response?.status}):`, axiosError.response?.data);
        }
      } else {
        console.error('Error fetching from Semantic Scholar:', error);
      }
    }
    
    return citations;
  }

  /**
   * Wait to respect Semantic Scholar rate limits
   */
  private async waitForSemanticScholarRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.semanticScholarLastRequest;
    
    // Reset counter every minute
    if (timeSinceLastRequest > 60000) {
      this.semanticScholarRequestCount = 0;
    }
    
    // If we've hit the rate limit, wait
    if (this.semanticScholarRequestCount >= this.SEMANTIC_SCHOLAR_RATE_LIMIT) {
      const waitTime = 60000 - timeSinceLastRequest;
      if (waitTime > 0) {
        console.log(`Rate limit reached for Semantic Scholar. Waiting ${waitTime}ms...`);
        await this.sleep(waitTime);
        this.semanticScholarRequestCount = 0;
      }
    }
    
    // Wait minimum delay between requests
    if (timeSinceLastRequest < this.SEMANTIC_SCHOLAR_DELAY) {
      await this.sleep(this.SEMANTIC_SCHOLAR_DELAY - timeSinceLastRequest);
    }
    
    this.semanticScholarLastRequest = Date.now();
    this.semanticScholarRequestCount++;
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
