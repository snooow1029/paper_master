/**
 * Citation Routes
 * Prior Works 和 Derivative Works API 路由
 */

import { Router, Request, Response } from 'express';
import { PaperCitationService } from '../services/PaperCitationService';

const router = Router();
const citationService = new PaperCitationService();

/**
 * 获取论文的 Prior Works（这篇论文引用的论文）
 * GET /api/citations/:paperId/prior-works
 */
router.get('/:paperId/prior-works', async (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    
    console.log(`\n=== Getting Prior Works for Paper: ${paperId} ===`);
    
    const priorWorks = await citationService.getPriorWorks(paperId);
    
    res.json({
      success: true,
      priorWorks,
      count: priorWorks.length
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting prior works:', errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * 获取论文的 Derivative Works（引用这篇论文的论文）
 * GET /api/citations/:paperId/derivative-works
 */
router.get('/:paperId/derivative-works', async (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    
    console.log(`\n=== Getting Derivative Works for Paper: ${paperId} ===`);
    
    const derivativeWorks = await citationService.getDerivativeWorks(paperId);
    
    res.json({
      success: true,
      derivativeWorks,
      count: derivativeWorks.length
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting derivative works:', errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * 根据论文 URL 获取 Prior Works
 * GET /api/citations/prior-works?url=<paper_url>
 */
router.get('/prior-works', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Paper URL is required (query parameter: url)'
      });
    }

    console.log(`\n=== Getting Prior Works from URL: ${url} ===`);
    
    const priorWorks = await citationService.getPriorWorksFromUrl(url);
    
    res.json({
      success: true,
      priorWorks,
      count: priorWorks.length,
      paperUrl: url
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting prior works from URL:', errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * 根据论文 URL 获取 Derivative Works
 * GET /api/citations/derivative-works?url=<paper_url>
 */
router.get('/derivative-works', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Paper URL is required (query parameter: url)'
      });
    }

    console.log(`\n=== Getting Derivative Works from URL: ${url} ===`);
    
    const derivativeWorks = await citationService.getDerivativeWorksFromUrl(url);
    
    res.json({
      success: true,
      derivativeWorks,
      count: derivativeWorks.length,
      paperUrl: url
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting derivative works from URL:', errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

export default router;

