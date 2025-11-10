/**
 * Reference-Based Graph Routes
 * 基于引用列表的图构建路由
 */

import { Router, Request, Response } from 'express';
import { ReferenceBasedGraphBuilder } from '../services/ReferenceBasedGraphBuilder';

const router = Router();
const graphBuilder = new ReferenceBasedGraphBuilder();

/**
 * 从单篇论文构建引用关系图（新流程）
 * POST /api/reference-graph/build-from-paper
 * 
 * Body: {
 *   paperUrl: string
 * }
 */
router.post('/build-from-paper', async (req: Request, res: Response) => {
  try {
    const { paperUrl } = req.body;

    if (!paperUrl || typeof paperUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'paperUrl is required and must be a string'
      });
    }

    console.log(`🚀 Building reference-based graph from paper: ${paperUrl}`);
    const startTime = Date.now();

    const result = await graphBuilder.buildGraphFromPaper(paperUrl);

    const duration = Date.now() - startTime;

    if (result.success) {
      res.json({
        success: true,
        graph: result.graph,
        papers: result.papers,
        stats: result.stats,
        processingTime: duration,
        message: `Successfully built graph with ${result.graph?.nodes.length || 0} nodes and ${result.graph?.edges.length || 0} relationships`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        processingTime: duration
      });
    }

  } catch (error) {
    console.error('Reference graph building failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Failed to build reference-based graph. Check GROBID and LLM services.'
    });
  }
});

/**
 * 从多篇论文批量构建引用关系图
 * POST /api/reference-graph/build-from-papers
 * 
 * Body: {
 *   paperUrls: string[]
 * }
 */
router.post('/build-from-papers', async (req: Request, res: Response) => {
  try {
    const { paperUrls } = req.body;

    if (!paperUrls || !Array.isArray(paperUrls) || paperUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'paperUrls is required and must be a non-empty array'
      });
    }

    if (paperUrls.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 20 papers allowed for batch processing'
      });
    }

    console.log(`🚀 Building reference-based graph from ${paperUrls.length} papers`);
    const startTime = Date.now();

    const result = await graphBuilder.buildGraphFromPapers(paperUrls);

    const duration = Date.now() - startTime;

    if (result.success) {
      res.json({
        success: true,
        graph: result.graph,
        papers: result.papers,
        stats: result.stats,
        processingTime: duration,
        message: `Successfully built graph with ${result.graph?.nodes.length || 0} nodes and ${result.graph?.edges.length || 0} relationships from ${paperUrls.length} papers`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        processingTime: duration
      });
    }

  } catch (error) {
    console.error('Batch reference graph building failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Failed to build reference-based graph from multiple papers.'
    });
  }
});

/**
 * 测试服务状态
 * GET /api/reference-graph/status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      service: 'Reference-Based Graph Builder',
      status: 'operational',
      features: {
        singlePaper: true,
        batchProcessing: true,
        externalApiEnrichment: process.env.ENRICH_CITATIONS !== 'false',
        supportedFormats: ['arxiv.org/abs/', 'arxiv.org/pdf/', 'arxiv.org/html/']
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

