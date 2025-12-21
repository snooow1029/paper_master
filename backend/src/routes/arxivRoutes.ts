/**
 * Arxiv Routes
 * 提供 arXiv 论文搜索 API
 */

import express from 'express';
import { ArxivService } from '../services/ArxivService';

const router = express.Router();
const arxivService = new ArxivService();

/**
 * POST /api/arxiv/search
 * 搜索 arXiv 论文
 * Body: { query: string, maxResults?: number }
 */
router.post('/search', async (req, res) => {
  try {
    const { query, maxResults, filters } = req.body;

    // Allow empty query if filters are provided
    if ((!query || typeof query !== 'string' || query.trim().length === 0) && 
        (!filters || Object.keys(filters).length === 0)) {
      return res.status(400).json({
        success: false,
        results: [],
        error: 'Search query or filters are required'
      });
    }

    const max = maxResults && typeof maxResults === 'number' && maxResults > 0 && maxResults <= 50
      ? maxResults
      : 10; // Default to 10, max 50

    // If query is already a constructed query string (contains +AND+ or field prefixes), use it directly
    // Otherwise, let the service handle query construction
    const searchQuery = query || 'all:*';

    console.log(`\n=== Arxiv Search Request ===`);
    console.log(`Query: ${searchQuery}`);
    console.log(`Filters:`, filters);
    console.log(`Max Results: ${max}`);

    const result = await arxivService.searchPapers(searchQuery, max);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Arxiv search endpoint error:', errorMessage);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({
      success: false,
      results: [],
      error: errorMessage
    });
  }
});

export default router;

