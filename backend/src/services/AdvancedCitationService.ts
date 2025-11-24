/**
 * Simple GROBID Citation Service for testing
 * Step-by-step testing of GROBID PDF parsing functionality
 */

import axios from 'axios';
import FormData from 'form-data';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { SemanticScholarService } from './SemanticScholarService';
import { Paper } from '../entities/Paper';

interface GrobidTestResults {
  connection: boolean;
  pdfDownload: boolean;
  grobidProcessing: boolean;
  teiParsing: boolean;
  error?: string;
}

interface TeiAnalysisResult {
  hasReferences: boolean;
  referenceCount: number;
  hasCitations: boolean;
  citationCount: number;
  sections: string[];
}

export class AdvancedCitationService {
  private grobidBaseUrl: string;

  constructor(grobidUrl?: string) {
    // 優先使用傳入的 URL，否則從環境變數讀取
    const url = grobidUrl || process.env.GROBID_URL;
    
    if (!url) {
      console.error('WARNING: GROBID_URL environment variable is not set.');
      console.error('GROBID features will be disabled. Please set GROBID_URL to enable PDF parsing.');
      // 設置一個默認值以避免崩潰，但會在 testGrobidConnection 中返回 false
      this.grobidBaseUrl = 'http://localhost:8070';
      return;
    }
    
    this.grobidBaseUrl = url;
    console.log(`Using GROBID connection at: ${this.grobidBaseUrl}`);
  }

  /**
   * Test if GROBID service is available
   */
  async testGrobidConnection(): Promise<boolean> {
    // 如果 GROBID_URL 未設置，直接返回 false
    if (!process.env.GROBID_URL && this.grobidBaseUrl === 'http://localhost:8070') {
      console.log('GROBID_URL not configured, skipping GROBID connection test');
      return false;
    }
    try {
      console.log(`Testing GROBID connection at: ${this.grobidBaseUrl}`);
      
      const response = await axios.get(`${this.grobidBaseUrl}/api/isalive`, {
        timeout: 5000
      });
      
      console.log(`GROBID connection test: ${response.status === 200 ? 'SUCCESS' : 'FAILED'}`);
      return response.status === 200;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('GROBID service not available:', errorMessage);
      return false;
    }
  }

  /**
   * Normalize arXiv URL to PDF URL format
   * Supports: /abs/, /pdf/, /html/ formats
   */
  private normalizeArxivUrlToPdf(url: string): string {
    // Extract arXiv ID from various formats
    let arxivId: string | null = null;
    
    // Format 1: https://arxiv.org/abs/2411.00154v1
    const absMatch = url.match(/arxiv\.org\/abs\/([^?\/\s]+)/i);
    if (absMatch) {
      arxivId = absMatch[1];
    }
    
    // Format 2: https://arxiv.org/pdf/2411.00154v1.pdf
    if (!arxivId) {
      const pdfMatch = url.match(/arxiv\.org\/pdf\/([^?\/\s]+)(?:\.pdf)?/i);
      if (pdfMatch) {
        arxivId = pdfMatch[1];
      }
    }
    
    // Format 3: https://arxiv.org/html/2411.00154v1
    if (!arxivId) {
      const htmlMatch = url.match(/arxiv\.org\/html\/([^?\/\s]+)/i);
      if (htmlMatch) {
        arxivId = htmlMatch[1];
      }
    }
    
    // Format 4: Direct arXiv ID (e.g., 2411.00154v1)
    if (!arxivId) {
      const idMatch = url.match(/^([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?)/);
      if (idMatch) {
        arxivId = idMatch[1];
      }
    }
    
    if (!arxivId) {
      throw new Error(`Unable to extract arXiv ID from URL: ${url}`);
    }
    
    // Return normalized PDF URL
    return `https://arxiv.org/pdf/${arxivId}.pdf`;
  }

  /**
   * Test downloading PDF from arXiv URL
   * Now supports: /abs/, /pdf/, /html/ formats
   */
  async testPdfDownload(arxivUrl: string): Promise<Buffer | null> {
    try {
      console.log(`Testing PDF download from: ${arxivUrl}`);
      
      // Normalize URL to PDF format (supports abs, pdf, html)
      const pdfUrl = this.normalizeArxivUrlToPdf(arxivUrl);
      
      console.log(`Normalized PDF URL: ${pdfUrl}`);
      
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Paper Master Bot 1.0)'
        }
      });

      const pdfBuffer = Buffer.from(response.data);
      console.log(`PDF download SUCCESS: ${pdfBuffer.length} bytes`);
      
      return pdfBuffer;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('PDF download FAILED:', errorMessage);
      return null;
    }
  }

  /**
   * Test processing PDF with GROBID
   */
  async testGrobidProcessing(pdfBuffer: Buffer): Promise<string | null> {
    try {
      console.log('Testing GROBID PDF processing...');

      const formData = new FormData();
      formData.append('input', pdfBuffer, {
        filename: 'test_paper.pdf',
        contentType: 'application/pdf'
      });

      console.log('Sending PDF to GROBID...');
      
      const response = await axios.post(
        `${this.grobidBaseUrl}/api/processFulltextDocument`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 120000, // 2 minutes timeout for GROBID processing
        }
      );

      console.log(`GROBID processing SUCCESS: ${response.data.length} characters of TEI XML`);
      return response.data;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('GROBID processing FAILED:', errorMessage);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('Response status:', axiosError.response?.status);
        console.error('Response data:', axiosError.response?.data);
      }
      return null;
    }
  }

  /**
   * Test parsing TEI XML structure
   */
  async testTeiXmlParsing(teiXml: string): Promise<{
    hasReferences: boolean;
    referenceCount: number;
    hasCitations: boolean;
    citationCount: number;
    sections: string[];
  }> {
    try {
      console.log('Testing TEI XML parsing...');
      
      const $ = cheerio.load(teiXml, { xmlMode: true });
      
      // Test bibliography extraction
      const biblStructs = $('listBibl biblStruct');
      const referenceCount = biblStructs.length;
      
      console.log(`Found ${referenceCount} bibliography entries`);
      
      // Test citation extraction
      const citationRefs = $('ref[type="bibr"]');
      const citationCount = citationRefs.length;
      
      console.log(`Found ${citationCount} citation references in text`);
      
      // Test section extraction
      const sections = $('div[type="section"] head').map((_, el) => $(el).text().trim()).get();
      
      console.log(`Found ${sections.length} sections:`, sections);
      
      return {
        hasReferences: referenceCount > 0,
        referenceCount,
        hasCitations: citationCount > 0,
        citationCount,
        sections
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('TEI XML parsing FAILED:', errorMessage);
      return {
        hasReferences: false,
        referenceCount: 0,
        hasCitations: false,
        citationCount: 0,
        sections: []
      };
    }
  }

  /**
   * Complete test pipeline for an arXiv URL
   */
  async testCompleteWorkflow(arxivUrl: string): Promise<{
    success: boolean;
    steps: {
      grobidConnection: boolean;
      pdfDownload: boolean;
      grobidProcessing: boolean;
      teiParsing: boolean;
    };
    results?: {
      referenceCount: number;
      citationCount: number;
      sections: string[];
    };
    error?: string;
  }> {
    console.log(`\n=== Testing Complete GROBID Workflow ===`);
    console.log(`Input URL: ${arxivUrl}`);
    
    const results = {
      success: false,
      steps: {
        grobidConnection: false,
        pdfDownload: false,
        grobidProcessing: false,
        teiParsing: false
      }
    };

    try {
      // Step 1: Test GROBID connection
      console.log('\n--- Step 1: Testing GROBID Connection ---');
      results.steps.grobidConnection = await this.testGrobidConnection();
      
      if (!results.steps.grobidConnection) {
        return { ...results, error: 'GROBID service not available' };
      }

      // Step 2: Test PDF download
      console.log('\n--- Step 2: Testing PDF Download ---');
      const pdfBuffer = await this.testPdfDownload(arxivUrl);
      results.steps.pdfDownload = pdfBuffer !== null;
      
      if (!pdfBuffer) {
        return { ...results, error: 'Failed to download PDF' };
      }

      // Step 3: Test GROBID processing
      console.log('\n--- Step 3: Testing GROBID Processing ---');
      const teiXml = await this.testGrobidProcessing(pdfBuffer);
      results.steps.grobidProcessing = teiXml !== null;
      
      if (!teiXml) {
        return { ...results, error: 'Failed to process PDF with GROBID' };
      }

      // Step 4: Test TEI XML parsing
      console.log('\n--- Step 4: Testing TEI XML Parsing ---');
      const parseResults = await this.testTeiXmlParsing(teiXml);
      results.steps.teiParsing = parseResults.hasReferences || parseResults.hasCitations;

      console.log('\n=== Test Results Summary ===');
      console.log(`✅ GROBID Connection: ${results.steps.grobidConnection}`);
      console.log(`✅ PDF Download: ${results.steps.pdfDownload}`);
      console.log(`✅ GROBID Processing: ${results.steps.grobidProcessing}`);
      console.log(`✅ TEI Parsing: ${results.steps.teiParsing}`);
      console.log(`📚 References: ${parseResults.referenceCount}`);
      console.log(`🔗 Citations: ${parseResults.citationCount}`);
      console.log(`📄 Sections: ${parseResults.sections.length}`);

      return {
        success: true,
        steps: results.steps,
        results: {
          referenceCount: parseResults.referenceCount,
          citationCount: parseResults.citationCount,
          sections: parseResults.sections
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('\nWorkflow FAILED:', errorMessage);
      return { ...results, error: errorMessage };
    }
  }

  /**
   * Quick test with a sample reference extraction
   */
  async extractSampleReferences(teiXml: string): Promise<Array<{
    id: string;
    title: string;
    authors: string[];
    year: string;
  }>> {
    const $ = cheerio.load(teiXml, { xmlMode: true });
    const references: Array<{ id: string; title: string; authors: string[]; year: string }> = [];

    $('listBibl biblStruct').each((_, element) => {
      const $ref = $(element);
      const refId = $ref.attr('xml:id') || '';
      
      const title = $ref.find('analytic title[type="main"], monogr title').first().text().trim();
      const authors = $ref.find('author persName').map((_, el) => {
        const $author = $(el);
        const forename = $author.find('forename').text().trim();
        const surname = $author.find('surname').text().trim();
        return `${forename} ${surname}`.trim();
      }).get();
      
      const year = $ref.find('date[when]').attr('when') || 
                   $ref.find('date').text().match(/\d{4}/)?.[0] || '';

      if (title) {
        references.push({ id: refId, title, authors, year });
      }
    });

    return references.slice(0, 5); // Return first 5 for testing
  }

  /**
   * Extract citations with context from a paper
   */
  async extractCitationsWithContext(arxivUrl: string): Promise<{
    success: boolean;
    paperTitle?: string;
    citations: Array<{
      id: string;
      title?: string;
      authors?: string[];
      year?: string;
      context: string;
      contextBefore: string;
      contextAfter: string;
      section?: string;
    }>;
    error?: string;
  }> {
    try {
      console.log(`\n=== Extracting Citations with Context ===`);
      console.log(`Input URL: ${arxivUrl}`);

      // Step 1: Download PDF
      const pdfBuffer = await this.testPdfDownload(arxivUrl);
      if (!pdfBuffer) {
        return { success: false, citations: [], error: 'Failed to download PDF' };
      }

      // Step 2: Process with GROBID
      const teiXml = await this.testGrobidProcessing(pdfBuffer);
      if (!teiXml) {
        return { success: false, citations: [], error: 'Failed to process PDF with GROBID' };
      }

      // Step 3: Parse TEI XML for citations with context
      const $ = cheerio.load(teiXml, { xmlMode: true });
      
      // Extract paper title
      const paperTitle = $('title[level="a"]').first().text().trim() || 
                        $('titleStmt title').first().text().trim();

      console.log(`Paper title: ${paperTitle}`);

      // Extract bibliography entries first
      const bibliographyMap = new Map<string, any>();
      $('listBibl biblStruct').each((_, biblStruct) => {
        const $bibl = $(biblStruct);
        const xmlId = $bibl.attr('xml:id');
        
        if (xmlId) {
          const title = $bibl.find('title[level="a"]').first().text().trim() ||
                       $bibl.find('title').first().text().trim();
          
          const authors = $bibl.find('author persName').map((_, author) => {
            const $author = $(author);
            const forename = $author.find('forename').text().trim();
            const surname = $author.find('surname').text().trim();
            return `${forename} ${surname}`.trim();
          }).get();

          const year = $bibl.find('date').attr('when') || 
                      $bibl.find('date').text().trim();

          bibliographyMap.set(xmlId, {
            id: xmlId,
            title,
            authors,
            year
          });
        }
      });

      console.log(`Found ${bibliographyMap.size} bibliography entries`);

      // Extract citations in context
      const citations: Array<{
        id: string;
        title?: string;
        authors?: string[];
        year?: string;
        context: string;
        contextBefore: string;
        contextAfter: string;
        section?: string;
      }> = [];

      // Find all citation references in the text
      $('ref[type="bibr"]').each((_, ref) => {
        const $ref = $(ref);
        const target = $ref.attr('target');
        
        if (target && target.startsWith('#')) {
          const bibId = target.substring(1);
          const bibData = bibliographyMap.get(bibId);
          
          if (bibData) {
            // Get the containing paragraph or sentence
            const $paragraph = $ref.closest('p, s');
            const fullText = $paragraph.text().trim();
            
            // Get context around the citation
            const refText = $ref.text().trim();
            const refIndex = fullText.indexOf(refText);
            
            let contextBefore = '';
            let contextAfter = '';
            
            if (refIndex !== -1) {
              const contextLength = 200; // characters before/after
              const start = Math.max(0, refIndex - contextLength);
              const end = Math.min(fullText.length, refIndex + refText.length + contextLength);
              
              contextBefore = fullText.substring(start, refIndex).trim();
              contextAfter = fullText.substring(refIndex + refText.length, end).trim();
            }

            // Find the section this citation is in
            const $section = $ref.closest('div[type="section"]');
            const sectionTitle = $section.find('head').first().text().trim();

            citations.push({
              id: bibId,
              title: bibData.title,
              authors: bibData.authors,
              year: bibData.year,
              context: fullText,
              contextBefore,
              contextAfter,
              section: sectionTitle
            });
          }
        }
      });

      console.log(`Extracted ${citations.length} citations with context`);

      return {
        success: true,
        paperTitle,
        citations
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Citation extraction failed:', errorMessage);
      return {
        success: false,
        citations: [],
        error: errorMessage
      };
    }
  }

  /**
   * Extract semantic relationships from a paper using GROBID analysis
   */
  async extractSemanticRelationships(paper: Paper): Promise<{
    citedPapers: Array<{
      paper: Paper;
      relationship: string;
      confidence: number;
      context: string;
    }>;
  }> {
    try {
      console.log(`Extracting semantic relationships for: ${paper.title}`);

      // For now, return empty relationships
      // TODO: Implement full semantic extraction using GROBID
      return {
        citedPapers: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Semantic relationship extraction failed:', errorMessage);
      return {
        citedPapers: []
      };
    }
  }

  /**
   * 提取帶上下文的引用信息（僅限 Related Work 和 Introduction 部分）
   * 新增：返回 TEI XML 用於深度分析
   */
  async extractCitationsWithContextFiltered(arxivUrl: string): Promise<{
    success: boolean;
    paperTitle?: string;
    paperAuthors?: string[];
    paperAbstract?: string;
    paperVenue?: string;
    paperYear?: string;
    paperCitationCount?: number; // 新增：引用次數
    teiXml?: string; // 新增：返回 TEI XML
    citations: Array<{
      id: string;
      title?: string;
      authors?: string[];
      year?: string;
      context: string;
      contextBefore: string;
      contextAfter: string;
      section?: string;
    }>;
    totalSections?: string[];
    filteredSections?: string[];
    error?: string;
  }> {
    try {
      console.log(`\n=== Extracting Citations (Related Work & Introduction Only) ===`);
      console.log(`Input URL: ${arxivUrl}`);

      // Step 1: Download PDF
      const pdfBuffer = await this.testPdfDownload(arxivUrl);
      if (!pdfBuffer) {
        return { success: false, citations: [], error: 'Failed to download PDF' };
      }

      // Step 2: Process with GROBID
      const teiXml = await this.testGrobidProcessing(pdfBuffer);
      if (!teiXml) {
        return { success: false, citations: [], error: 'Failed to process PDF with GROBID' };
      }

      // Step 3: Parse TEI XML for citations with section filtering
      const $ = cheerio.load(teiXml, { xmlMode: true });
      
      // Debug: Print TEI XML structure for author extraction
      console.log(`\n=== TEI XML Debug Info ===`);
      console.log(`📄 TEI XML length: ${teiXml.length} characters`);
      
      // Save TEI XML to file for detailed inspection
      const debugDir = path.join(__dirname, '../../debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tei_xml_${timestamp}.xml`;
      const filepath = path.join(debugDir, filename);
      
      try {
        fs.writeFileSync(filepath, teiXml, 'utf8');
        console.log(`📁 TEI XML saved to: ${filepath}`);
      } catch (error) {
        console.warn(`⚠️  Could not save TEI XML to file:`, error);
      }
      
      // Print the first 2000 characters of TEI XML to see structure
      console.log(`📋 TEI XML Header (first 2000 chars):`);
      console.log(teiXml.substring(0, 2000));
      console.log(`...(truncated)`);
      
      // Check for different author-related elements
      console.log(`\n📝 Author-related elements found:`);
      console.log(`   - <author> elements: ${$('author').length}`);
      console.log(`   - <persName> elements: ${$('persName').length}`);
      console.log(`   - <name> elements: ${$('name').length}`);
      console.log(`   - <fileDesc> elements: ${$('fileDesc').length}`);
      console.log(`   - <titleStmt> elements: ${$('titleStmt').length}`);
      
      if ($('author').length > 0) {
        console.log(`📋 First <author> element:`, $('author').first().html());
      }
      if ($('persName').length > 0) {
        console.log(`📋 First <persName> element:`, $('persName').first().html());
      }
      
      // Extract paper title
      let paperTitle = $('title[level="a"]').first().text().trim() || 
                        $('titleStmt title').first().text().trim();

      console.log(`Paper title: ${paperTitle}`);

      // Extract paper authors - only from main paper, not from references
      let paperAuthors: string[] = [];
      
      // Extract publication year (initialize early for Semantic Scholar override)
      let paperYear = $('publicationStmt date').attr('when') || 
                       $('imprint date').attr('when') ||
                       $('date').attr('when');
      
      // Use the most specific selector that targets only the main paper authors
      // Based on TEI XML structure: teiHeader > fileDesc > sourceDesc > biblStruct > analytic > author
      const authorSelectors = [
        'teiHeader > fileDesc > sourceDesc > biblStruct > analytic > author persName', // Most specific - main paper only
        'fileDesc > sourceDesc > biblStruct > analytic > author persName', // Alternative without teiHeader
        'sourceDesc > biblStruct > analytic > author persName', // More general but still avoids references
      ];
      
      for (const selector of authorSelectors) {
        if (paperAuthors.length === 0) {
          console.log(`🔍 Trying author selector: "${selector}"`);
          paperAuthors = $(selector).map((_, el) => {
            const $author = $(el);
            const forename = $author.find('forename').text().trim();
            const surname = $author.find('surname').text().trim();
            if (forename || surname) {
              return `${forename} ${surname}`.trim();
            }
            // If no forename/surname structure, try getting direct text
            return $author.text().trim();
          }).get().filter(name => name.length > 0);
          
          if (paperAuthors.length > 0) {
            console.log(`📝 Authors found with selector "${selector}": ${paperAuthors.join(', ')}`);
            break;
          }
        }
      }
      
      // If still no authors found, try more specific fallback methods
      if (paperAuthors.length === 0) {
        // Try to get authors only from the main document (not from references)
        const mainDocAuthors = $('teiHeader').find('author persName');
        if (mainDocAuthors.length > 0) {
          paperAuthors = mainDocAuthors.map((_, el) => {
            const $author = $(el);
            const forename = $author.find('forename').text().trim();
            const surname = $author.find('surname').text().trim();
            return `${forename} ${surname}`.trim();
          }).get().filter(name => name.length > 0);
          console.log(`📝 Authors found in teiHeader: ${paperAuthors.join(', ')}`);
        }
      }
      
      // Debug info if still no authors
      if (paperAuthors.length === 0) {
        console.warn(`⚠️  No authors found with any selector. TEI structure might be different.`);
        // Debug: print some TEI structure info (excluding reference section)
        const teiHeaderAuthors = $('teiHeader author').length;
        const sourceDescAuthors = $('sourceDesc author').length;
        const backAuthors = $('back author').length; // This should show reference authors
        console.log(`📋 TEI author elements - teiHeader: ${teiHeaderAuthors}, sourceDesc: ${sourceDescAuthors}, back/references: ${backAuthors}`);
        
        if ($('teiHeader author').length > 0) {
          console.log(`📋 First teiHeader author element:`, $('teiHeader author').first().html());
        }
      }

      // Extract paper abstract - remove citation references
      let paperAbstract = $('profileDesc abstract p').clone().children('ref').remove().end().text().trim() || 
                         $('abstract p').clone().children('ref').remove().end().text().trim() ||
                         $('abstract').clone().children('ref').remove().end().text().trim();
      
      // Clean up any remaining citation markers like [1], (Smith et al., 2020), etc.
      paperAbstract = paperAbstract
        .replace(/\[\d+(?:,\s*\d+)*\]/g, '') // Remove [1], [1,2,3] style citations
        .replace(/\(\s*[A-Za-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}\s*\)/g, '') // Remove (Author et al., 2020) style citations
        .replace(/\(\s*\d{4}\s*\)/g, '') // Remove (2020) style citations
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Extract publication info (venue) - enhanced with Semantic Scholar lookup
      let paperVenue = '';
      let paperCitationCount: number | undefined = undefined;
      let venueSource = 'TEI XML';
      
      // First try to get venue from main paper's monogr section (most specific)
      const mainPaperVenue = $('teiHeader > fileDesc > sourceDesc > biblStruct > monogr title').text().trim();
      if (mainPaperVenue) {
        paperVenue = mainPaperVenue;
        venueSource = 'TEI XML (main paper)';
      } else {
        // Fallback: try publicationStmt publisher
        const publisher = $('publicationStmt publisher').text().trim();
        if (publisher && publisher !== '') {
          paperVenue = publisher;
          venueSource = 'TEI XML (publisher)';
        } else {
          // Check if this is an arXiv paper and try Semantic Scholar lookup
          const arxivId = $('idno[type="arXiv"]').text().trim();
          if (arxivId) {
            console.log(`🔍 Found arXiv ID: ${arxivId}, querying Semantic Scholar for venue and citations...`);
            
            try {
              // Query Semantic Scholar for complete paper information
              const semanticScholarData = await SemanticScholarService.getEnhancedVenueInfo(arxivId);
              
              // Always get citation count from Semantic Scholar
              paperCitationCount = semanticScholarData.citationCount;
              
              // Use Semantic Scholar data for venue
              if (semanticScholarData.venue && !semanticScholarData.isPreprint) {
                paperVenue = semanticScholarData.venue;
                venueSource = `Semantic Scholar (${semanticScholarData.venueType})`;
                
                console.log(`✅ Found published venue in Semantic Scholar:
                  - Venue: "${semanticScholarData.venue}"
                  - Type: ${semanticScholarData.venueType}
                  - Publication Date: ${semanticScholarData.publicationDate}
                  - Citations: ${semanticScholarData.citationCount}
                  - Publication Types: ${semanticScholarData.publicationTypes?.join(', ')}`);
              } else {
                paperVenue = 'arXiv preprint';
                venueSource = 'arXiv (preprint)';
                console.log(`📄 Paper is still a preprint (${semanticScholarData.citationCount || 0} citations)`);
              }

              // 🚀 NEW: Override title, authors, year with Semantic Scholar data if available
              if (semanticScholarData.title && semanticScholarData.title.trim()) {
                paperTitle = semanticScholarData.title;
                console.log(`✅ Using Semantic Scholar title: "${paperTitle}"`);
              }
              
              if (semanticScholarData.authors && semanticScholarData.authors.length > 0) {
                paperAuthors = semanticScholarData.authors;
                console.log(`✅ Using Semantic Scholar authors: ${paperAuthors.join(', ')}`);
              }
              
              if (semanticScholarData.year) {
                paperYear = semanticScholarData.year.toString();
                console.log(`✅ Using Semantic Scholar year: ${paperYear}`);
              }
            } catch (error) {
              console.warn(`⚠️  Failed to query Semantic Scholar:`, error);
              paperVenue = 'arXiv preprint';
              venueSource = 'arXiv (fallback)';
            }
          } else {
            // Last resort: check for journal/conference in various places, but avoid references
            paperVenue = $('fileDesc > sourceDesc > biblStruct > monogr title').text().trim() || 
                        $('sourceDesc > biblStruct > monogr title').first().text().trim() || 
                        '';
            venueSource = 'TEI XML (fallback)';
          }
        }
      }
      
      console.log(`📍 Paper venue and citation extraction:
        - Main paper monogr title: "${mainPaperVenue}"
        - Publisher: "${$('publicationStmt publisher').text().trim()}"
        - ArXiv ID: "${$('idno[type="arXiv"]').text().trim()}"
        - Final venue: "${paperVenue}" (source: ${venueSource})
        - Citation count: ${paperCitationCount || 'unknown'}
        - Citation count type: ${typeof paperCitationCount}`);

      console.log(`🔍 [CITATION DEBUG] Final citation result: ${JSON.stringify({
        paperCitationCount: paperCitationCount,
        citationCountType: typeof paperCitationCount,
        isUndefined: paperCitationCount === undefined,
        isNull: paperCitationCount === null
      })}`);

      // Use year already extracted earlier (overridden by Semantic Scholar if available)
      // paperYear is already declared above

      console.log(`Paper authors: ${paperAuthors.join(', ')}`);
      console.log(`Paper abstract: ${paperAbstract.substring(0, 100)}...`);
      console.log(`Paper venue: ${paperVenue}`);
      console.log(`Paper year: ${paperYear}`);

      // Extract all section titles for debugging - try multiple selectors
      let allSections = $('div[type="section"] head').map((_, el) => $(el).text().trim()).get();
      
      // If no sections found with first selector, try alternatives
      if (allSections.length === 0) {
        allSections = $('div head').map((_, el) => $(el).text().trim()).get();
      }
      
      if (allSections.length === 0) {
        allSections = $('head').map((_, el) => $(el).text().trim()).get();
      }
      
      if (allSections.length === 0) {
        // Try to find any text that looks like section headers
        allSections = $('p').filter((_, el) => {
          const text = $(el).text().trim();
          return text.length < 100 && /^[A-Z][a-zA-Z\s]{3,50}$/.test(text);
        }).map((_, el) => $(el).text().trim()).get().slice(0, 20); // Limit to first 20
      }
      
      console.log(`All sections found: ${allSections.join(', ')}`);

      // Define target sections (case-insensitive patterns) - 扩展匹配模式
      const targetSectionPatterns = [
        // Introduction 相关变体
        /^introduction$/i,
        /^introduction\s+and\s+motivation$/i,
        /^introduction\s+and\s+overview$/i,
        /^introduction\s+and\s+background$/i,
        /^overview$/i,
        /^motivation$/i,
        /^motivation\s+and\s+introduction$/i,
        /^background$/i,
        /^background\s+and\s+motivation$/i,
        
        // Related Work 相关变体
        /^related\s+work$/i,
        /^related\s+works$/i,
        /^literature\s+review$/i,
        /^literature\s+reviews$/i,
        /^literature$/i,
        /^previous\s+work$/i,
        /^previous\s+works$/i,
        /^prior\s+work$/i,
        /^prior\s+works$/i,
        /^related\s+research$/i,
        /^related\s+studies$/i,
        /^state\s+of\s+the\s+art$/i,
        /^state-of-the-art$/i,
        /^sota$/i,
        /^existing\s+work$/i,
        /^existing\s+works$/i,
        /^related\s+work\s+and\s+background$/i,
        /^background\s+and\s+related\s+work$/i,
        /^related\s+work\s+and\s+motivation$/i,
        /^related\s+work\s+and\s+literature\s+review$/i,
        /^literature\s+review\s+and\s+related\s+work$/i,
        /^survey$/i,
        /^survey\s+of\s+related\s+work$/i,
        /^review\s+of\s+related\s+work$/i,
        /^review$/i,
        
        // 其他可能包含引用的章节
        /^discussion\s+of\s+related\s+work$/i,
        /^comparison\s+with\s+related\s+work$/i,
        /^comparison$/i,
        /^related\s+approaches$/i,
        /^alternative\s+approaches$/i,
        /^other\s+approaches$/i,
        /^related\s+methods$/i,
        /^related\s+techniques$/i
      ];

      // 改进的匹配函数：支持部分匹配和模糊匹配
      const matchSection = (sectionTitle: string): boolean => {
        const normalizedTitle = sectionTitle.trim().toLowerCase();
        
        // 1. 精确模式匹配
        if (targetSectionPatterns.some(pattern => pattern.test(sectionTitle))) {
          return true;
        }
        
        // 2. 部分匹配：检查标题是否包含关键词
        const keywords = [
          'introduction', 'related work', 'related works', 'literature review',
          'background', 'previous work', 'prior work', 'motivation',
          'overview', 'survey', 'review', 'state of the art', 'sota'
        ];
        
        for (const keyword of keywords) {
          if (normalizedTitle.includes(keyword.toLowerCase())) {
            // 确保不是其他章节（如 "Conclusion" 包含 "introduction" 的情况）
            const keywordIndex = normalizedTitle.indexOf(keyword.toLowerCase());
            const beforeKeyword = normalizedTitle.substring(0, keywordIndex);
            const afterKeyword = normalizedTitle.substring(keywordIndex + keyword.length);
            
            // 检查关键词前后是否有其他主要章节词（避免误匹配）
            const conflictingKeywords = ['conclusion', 'discussion', 'methodology', 'method', 'experiment', 'result'];
            const hasConflict = conflictingKeywords.some(conflict => 
              beforeKeyword.includes(conflict) || afterKeyword.includes(conflict)
            );
            
            if (!hasConflict) {
              return true;
            }
          }
        }
        
        return false;
      };
      
      // Find sections that match our patterns - try multiple selectors
      let targetSectionHeads = $('div[type="section"] head').filter((_, el) => {
        const sectionTitle = $(el).text().trim();
        return matchSection(sectionTitle);
      });
      
      // If no target sections found with first selector, try alternatives
      if (targetSectionHeads.length === 0) {
        targetSectionHeads = $('div head').filter((_, el) => {
          const sectionTitle = $(el).text().trim();
          return matchSection(sectionTitle);
        });
      }
      
      if (targetSectionHeads.length === 0) {
        targetSectionHeads = $('head').filter((_, el) => {
          const sectionTitle = $(el).text().trim();
          return matchSection(sectionTitle);
        });
      }
      
      // 如果还是没找到，尝试更宽松的匹配：查找包含关键词的段落标题
      if (targetSectionHeads.length === 0) {
        console.log('🔍 Trying relaxed matching for section titles...');
        const allHeads = $('head').map((_, el) => {
          const title = $(el).text().trim();
          return { element: el, title };
        }).get();
        
        for (const { element, title } of allHeads) {
          if (matchSection(title)) {
            targetSectionHeads = targetSectionHeads.add(element);
          }
        }
      }

      const filteredSections = targetSectionHeads.map((_, el) => $(el).text().trim()).get();
      
      // If no target sections found, fall back to extracting from all content
      if (filteredSections.length === 0) {
        console.log('⚠️  No target sections found (Introduction/Related Work), falling back to extract all citations');
        console.log('🔍 Will analyze first few sections or entire document for citations');
        
        // Try to use first few sections as fallback
        if (allSections.length > 0) {
          console.log(`📝 Available sections in document: ${allSections.slice(0, 10).join(', ')}`);
          console.log(`💡 Tip: If you see sections like "Introduction" or "Related Work" above, they may have different naming in this paper`);
        } else {
          console.log(`⚠️  No sections detected in document structure`);
        }
      } else {
        console.log(`✅ Target sections found (${filteredSections.length}): ${filteredSections.join(', ')}`);
      }

      // Extract bibliography entries first
      const bibliographyMap = new Map<string, any>();
      $('listBibl biblStruct').each((_, biblStruct) => {
        const $bibl = $(biblStruct);
        const xmlId = $bibl.attr('xml:id');
        
        if (xmlId) {
          const title = $bibl.find('title[level="a"]').first().text().trim() ||
                       $bibl.find('title').first().text().trim();
          
          const authors = $bibl.find('author persName').map((_, author) => {
            const $author = $(author);
            const forename = $author.find('forename').text().trim();
            const surname = $author.find('surname').text().trim();
            return `${forename} ${surname}`.trim();
          }).get();

          const year = $bibl.find('date').attr('when') || 
                      $bibl.find('date').text().trim();

          bibliographyMap.set(xmlId, {
            id: xmlId,
            title,
            authors,
            year
          });
        }
      });

      console.log(`Found ${bibliographyMap.size} bibliography entries`);

      // Extract citations from target sections or all content as fallback
      const citations: Array<{
        id: string;
        title?: string;
        authors?: string[];
        year?: string;
        context: string;
        contextBefore: string;
        contextAfter: string;
        section?: string;
      }> = [];

      if (filteredSections.length > 0) {
        // Process each target section
        targetSectionHeads.each((_, head) => {
          const $head = $(head);
          const sectionTitle = $head.text().trim();
          const $section = $head.parent();

          console.log(`Processing section: ${sectionTitle}`);
          
          // Debug: Log section content structure
          console.log(`🔍 Section content preview: ${$section.text().substring(0, 200)}...`);
          
          // Debug: Count citation references in this section
          const citationRefs = $section.find('ref[type="bibr"]');
          console.log(`📊 Found ${citationRefs.length} citation references in section "${sectionTitle}"`);
          
          // Also try alternative selectors
          const altRefs1 = $section.find('ref');
          const altRefs2 = $section.find('[target^="#"]');
          console.log(`📊 Alternative counts: ref=${altRefs1.length}, target=#=${altRefs2.length}`);

          // Find all citation references in this section - 改进匹配逻辑
          // 尝试多种选择器以捕获所有引用
          const citationSelectors = [
            'ref[type="bibr"]',
            'ref[target^="#"]',
            'ref'
          ];
          
          let foundRefs = $section.find(citationSelectors[0]);
          if (foundRefs.length === 0) {
            foundRefs = $section.find(citationSelectors[1]);
          }
          if (foundRefs.length === 0) {
            foundRefs = $section.find(citationSelectors[2]);
          }
          
          foundRefs.each((_, ref) => {
            const $ref = $(ref);
            const target = $ref.attr('target');
            
            if (target && target.startsWith('#')) {
              const bibId = target.substring(1);
              let bibInfo = bibliographyMap.get(bibId);
              
              // 如果直接匹配失败，尝试模糊匹配
              if (!bibInfo) {
                // 尝试匹配部分 ID（有些 GROBID 输出可能 ID 不完整）
                for (const [id, info] of bibliographyMap.entries()) {
                  if (id.includes(bibId) || bibId.includes(id)) {
                    bibInfo = info;
                    console.log(`⚠️  Using fuzzy match: ${bibId} -> ${id}`);
                    break;
                  }
                }
              }
              
              if (bibInfo) {
                // Get surrounding context with improved sentence boundary detection
                const fullText = $section.text();
                const refText = $ref.text();
                const refIndex = fullText.indexOf(refText);
                
                if (refIndex !== -1) {
                  console.log(`🔍 Extracting context for citation "${refText}" at position ${refIndex}`);
                  
                  // Get a larger initial context window
                  const contextRadius = 300; // Increased from 100 to 300
                  const beforeStart = Math.max(0, refIndex - contextRadius);
                  const afterEnd = Math.min(fullText.length, refIndex + refText.length + contextRadius);
                  
                  let contextBefore = fullText.substring(beforeStart, refIndex);
                  let contextAfter = fullText.substring(refIndex + refText.length, afterEnd);
                  
                  // Try to find complete sentences by looking for sentence boundaries
                  // Improve contextBefore to start at sentence beginning
                  const sentenceStartPattern = /[.!?]\s+[A-Z]/g;
                  let match;
                  let lastSentenceStart = 0;
                  while ((match = sentenceStartPattern.exec(contextBefore)) !== null) {
                    lastSentenceStart = match.index + match[0].indexOf(match[0].match(/[A-Z]/)![0]);
                  }
                  if (lastSentenceStart > 0) {
                    contextBefore = contextBefore.substring(lastSentenceStart);
                  }
                  
                  // Improve contextAfter to end at sentence boundary
                  const sentenceEndMatch = contextAfter.match(/[.!?]\s/);
                  if (sentenceEndMatch) {
                    const endPos = sentenceEndMatch.index! + 1;
                    contextAfter = contextAfter.substring(0, endPos);
                  }
                  
                  const context = (contextBefore + refText + contextAfter).trim();
                  
                  // console.log(`📝 Context extracted (${context.length} chars):`);
                  // console.log(`   Before: "${contextBefore.substring(0, 50)}..."`);
                  // console.log(`   Citation: "${refText}"`);
                  // console.log(`   After: "${contextAfter.substring(0, 50)}..."`);
                  // console.log(`   Full context: "${context}"`);

                  citations.push({
                    ...bibInfo,
                    context: context,
                    contextBefore: contextBefore.trim(),
                    contextAfter: contextAfter.trim(),
                    section: sectionTitle
                  });
                } else {
                  console.log(`⚠️ Could not find citation text "${refText}" in section content`);
                }
              } else {
                console.log(`⚠️ No bibliography info found for target: ${target}`);
              }
            } else {
              console.log(`⚠️ Invalid or missing target attribute: ${target}`);
            }
          });
        });
        
        console.log(`📋 Extracted ${citations.length} citations from target sections`);
        
        // If no citations found in target sections, try fallback approach
        if (citations.length === 0) {
          console.log('⚠️  No citations found in target sections, trying fallback...');
          
          // Fallback: extract citations from entire document
          console.log('Extracting citations from entire document...');
          
          // First, count total bibliography entries and citation references
          const totalBibEntries = $('listBibl biblStruct').length;
          const totalCitationRefs = $('ref[type="bibr"]').length;
          // console.log(`📊 Document statistics:`);
          // console.log(`   - Bibliography entries: ${totalBibEntries}`);
          // console.log(`   - Citation references: ${totalCitationRefs}`);
          
          $('ref[type="bibr"]').each((_, ref) => {
            const $ref = $(ref);
            const target = $ref.attr('target');
            
            if (target && target.startsWith('#')) {
              const bibId = target.substring(1);
              const bibInfo = bibliographyMap.get(bibId);
              
              if (bibInfo) {
                console.log(`🔍 Fallback: Processing citation "${$ref.text()}" with target ${target}`);
                
                // Get surrounding context from the parent paragraph/section
                const $parent = $ref.closest('p, div');
                let context = $parent.text().trim();
                
                // If context is too long, try to get a more focused excerpt
                const refText = $ref.text();
                const refIndex = context.indexOf(refText);
                
                if (refIndex !== -1 && context.length > 500) {
                  // Extract context with improved sentence boundaries
                  const contextRadius = 300;
                  const beforeStart = Math.max(0, refIndex - contextRadius);
                  const afterEnd = Math.min(context.length, refIndex + refText.length + contextRadius);
                  
                  let contextBefore = context.substring(beforeStart, refIndex);
                  let contextAfter = context.substring(refIndex + refText.length, afterEnd);
                  
                  // Try to find complete sentences
                  const sentenceStartPattern = /[.!?]\s+[A-Z]/g;
                  let match;
                  let lastSentenceStart = 0;
                  while ((match = sentenceStartPattern.exec(contextBefore)) !== null) {
                    lastSentenceStart = match.index + match[0].indexOf(match[0].match(/[A-Z]/)![0]);
                  }
                  if (lastSentenceStart > 0) {
                    contextBefore = contextBefore.substring(lastSentenceStart);
                  }
                  
                  const sentenceEndMatch = contextAfter.match(/[.!?]\s/);
                  if (sentenceEndMatch) {
                    const endPos = sentenceEndMatch.index! + 1;
                    contextAfter = contextAfter.substring(0, endPos);
                  }
                  
                  context = (contextBefore + refText + contextAfter).trim();
                }
                
                // console.log(`📝 Fallback context extracted (${context.length} chars): "${context}"`);

                citations.push({
                  ...bibInfo,
                  context: context,
                  contextBefore: '',
                  contextAfter: '',
                  section: 'Unknown'
                });
              }
            }
          });
          
          console.log(`📋 Extracted ${citations.length} citations via fallback method`);
        }
      } else {
        // Fallback: extract citations from entire document
        console.log('Extracting citations from entire document...');
        
        // First, count total bibliography entries and citation references
        const totalBibEntries = $('listBibl biblStruct').length;
        const totalCitationRefs = $('ref[type="bibr"]').length;
        // console.log(`📊 Document statistics:`);
        // console.log(`   - Bibliography entries: ${totalBibEntries}`);
        // console.log(`   - Citation references: ${totalCitationRefs}`);
        
        $('ref[type="bibr"]').each((_, ref) => {
          const $ref = $(ref);
          const target = $ref.attr('target');
          
          if (target && target.startsWith('#')) {
            const bibId = target.substring(1);
            let bibInfo = bibliographyMap.get(bibId);
            
            // 如果直接匹配失败，尝试模糊匹配
            if (!bibInfo) {
              for (const [id, info] of bibliographyMap.entries()) {
                if (id.includes(bibId) || bibId.includes(id)) {
                  bibInfo = info;
                  console.log(`⚠️  Fallback: Using fuzzy match: ${bibId} -> ${id}`);
                  break;
                }
              }
            }
            
            if (bibInfo) {
              // Get surrounding context from the entire document
              const $parent = $ref.closest('p, div');
              let context = $parent.text().trim();
              
              // 改进 context 提取：尝试获取更完整的句子
              if (context.length > 500) {
                const refText = $ref.text();
                const refIndex = context.indexOf(refText);
                if (refIndex !== -1) {
                  const contextRadius = 200;
                  const beforeStart = Math.max(0, refIndex - contextRadius);
                  const afterEnd = Math.min(context.length, refIndex + refText.length + contextRadius);
                  context = context.substring(beforeStart, afterEnd);
                }
              }
              
              citations.push({
                ...bibInfo,
                context: context.substring(0, 500), // 增加 context 长度限制
                contextBefore: '',
                contextAfter: '',
                section: 'Unknown'
              });
            } else {
              console.log(`⚠️  No bibliography info found for citation target: ${target}`);
            }
          }
        });
        
        console.log(`📋 Extracted ${citations.length} citations via fallback method`);
      }

      // Remove duplicates based on citation ID
      const uniqueCitations = citations.filter((citation, index, self) => 
        index === self.findIndex(c => c.id === citation.id)
      );    

      return {
        success: true,
        paperTitle,
        paperAuthors,
        paperAbstract,
        paperVenue,
        paperYear,
        paperCitationCount, // 新增：引用次數
        teiXml, // 新增：返回 TEI XML
        citations: uniqueCitations,
        totalSections: allSections,
        filteredSections,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Citation extraction failed:', errorMessage);
      return {
        success: false,
        citations: [],
        error: errorMessage
      };
    }
  }
}
