/**
 * Test routes for GROBID functionality
 */

import { Router } from 'express';
import { AdvancedCitationService } from '../services/AdvancedCitationService';

const router = Router();
const grobidService = new AdvancedCitationService();

/**
 * Test GROBID connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    const isConnected = await grobidService.testGrobidConnection();
    res.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'GROBID is available' : 'GROBID is not available'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      connected: false,
      error: errorMessage
    });
  }
});

/**
 * Test PDF download from arXiv
 */
router.post('/test-pdf-download', async (req, res) => {
  try {
    const { arxivUrl } = req.body;
    
    if (!arxivUrl) {
      return res.status(400).json({
        success: false,
        error: 'arXiv URL is required'
      });
    }

    const pdfBuffer = await grobidService.testPdfDownload(arxivUrl);
    
    if (!pdfBuffer) {
      return res.status(500).json({
        success: false,
        downloaded: false,
        error: 'Failed to download PDF'
      });
    }
    
    res.json({
      success: true,
      downloaded: true,
      message: `PDF downloaded successfully (${pdfBuffer.length} bytes)`,
      size: pdfBuffer.length
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      downloaded: false,
      error: errorMessage
    });
  }
});

/**
 * Test complete GROBID workflow
 */
router.post('/test-workflow', async (req, res) => {
  try {
    const { arxivUrl } = req.body;
    
    if (!arxivUrl) {
      return res.status(400).json({
        success: false,
        error: 'arXiv URL is required'
      });
    }

    console.log(`Testing complete GROBID workflow for: ${arxivUrl}`);
    const results = await grobidService.testCompleteWorkflow(arxivUrl);
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * Test with predefined sample papers
 */
router.get('/test-sample-papers', async (req, res) => {
  try {
    const samplePapers = [
      'https://arxiv.org/abs/1706.03762', // Attention Is All You Need
      'https://arxiv.org/abs/1810.04805', // BERT  
      'https://arxiv.org/abs/2005.14165'  // GPT-3
    ];

    console.log(`\n=== Testing GROBID with Sample Papers ===`);
    
    const results = [];
    
    for (const paperUrl of samplePapers) {
      console.log(`\nTesting: ${paperUrl}`);
      
      try {
        const result = await grobidService.testCompleteWorkflow(paperUrl);
        results.push({
          url: paperUrl,
          success: true,
          result
        });
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          url: paperUrl,
          success: false,
          error: errorMessage
        });
      }
    }

    res.json({
      message: 'Sample papers testing completed',
      results
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Extract citations with context from a paper
 * Supports both filtered and unfiltered extraction
 */
router.post('/extract-citations', async (req, res) => {
  try {
    const { url, arxivUrl, filterSections } = req.body;
    
    // Support both 'url' and 'arxivUrl' parameter names
    const paperUrl = url || arxivUrl;
    
    if (!paperUrl) {
      return res.status(400).json({
        success: false,
        error: 'Paper URL is required (use "url" or "arxivUrl" parameter)'
      });
    }

    console.log(`\n=== Citation Extraction Request ===`);
    console.log(`URL: ${paperUrl}`);
    console.log(`Filter sections: ${filterSections || false}`);

    // Use filtered extraction if filterSections is enabled
    let result;
    if (filterSections) {
      result = await grobidService.extractCitationsWithContextFiltered(paperUrl);
    } else {
      result = await grobidService.extractCitationsWithContext(paperUrl);
    }
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        citations: [],
        error: result.error || 'Failed to extract citations'
      });
    }
    
    // Build response based on the method used
    const response: any = {
      success: true,
      citations: result.citations || [],
      paperTitle: result.paperTitle,
      count: result.citations?.length || 0
    };
    
    // Add additional fields if available (from filtered extraction)
    if (filterSections && 'paperAuthors' in result) {
      response.paperAuthors = (result as any).paperAuthors;
      response.paperYear = (result as any).paperYear;
      response.paperAbstract = (result as any).paperAbstract;
      response.totalSections = (result as any).totalSections;
      response.filteredSections = (result as any).filteredSections;
    }
    
    res.json(response);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Citation extraction endpoint error:', errorMessage);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      success: false, 
      citations: [],
      error: errorMessage 
    });
  }
});

export default router;
