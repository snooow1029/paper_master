/**
 * Enhanced Graph Routes with Deep Paper Relationship Analysis
 * 使用深度論文關係分析的增強圖路由
 */

import { Router } from 'express';
import { EnhancedGraphService } from '../services/EnhancedGraphService';

const router = Router();
const enhancedGraphService = new EnhancedGraphService();

/**
 * 構建深度分析的論文關係圖
 * POST /api/enhanced-graph/build
 */
router.post('/build', async (req, res) => {
  try {
    const { papers } = req.body;
    
    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Papers array is required and must not be empty'
      });
    }

    if (papers.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 papers allowed for enhanced analysis due to computational complexity'
      });
    }

    console.log(`🚀 Starting enhanced graph building for ${papers.length} papers...`);
    const startTime = Date.now();

    const enhancedGraph = await enhancedGraphService.buildEnhancedGraph(papers);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Enhanced graph completed in ${duration}ms`);

    res.json({
      success: true,
      graph: enhancedGraph,
      processingTime: duration,
      message: `Successfully built enhanced graph with ${enhancedGraph.nodes.length} nodes and ${enhancedGraph.edges.length} relationships`
    });

  } catch (error) {
    console.error('Enhanced graph building failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Deep relationship analysis failed. This might be due to LLM service unavailability or paper processing issues.'
    });
  }
});

/**
 * 測試深度分析系統狀態
 * GET /api/enhanced-graph/status
 */
router.get('/status', async (req, res) => {
  try {
    console.log('🔍 Testing enhanced graph service status...');
    
    // 測試各個組件
    const testResults = {
      timestamp: new Date().toISOString(),
      services: {
        deepAnalyzer: false,
        citationService: false,
        llmConnection: false
      },
      systemInfo: {
        nodeEnv: process.env.NODE_ENV,
        llmUrl: process.env.LOCAL_LLM_URL || 'http://localhost:8000',
        llmModel: process.env.LOCAL_LLM_MODEL || 'Qwen/Qwen3-4B-Instruct-2507',
        grobidUrl: process.env.GROBID_URL || 'http://localhost:8070'
      }
    };

    try {
      // 測試深度分析器
      const deepAnalyzer = enhancedGraphService['deepAnalyzer'];
      if (deepAnalyzer && typeof deepAnalyzer.testLLMConnection === 'function') {
        testResults.services.llmConnection = await deepAnalyzer.testLLMConnection();
        testResults.services.deepAnalyzer = true;
      }
    } catch (error) {
      console.warn('Deep analyzer test failed:', error);
    }

    try {
      // 測試引用服務
      const citationService = enhancedGraphService['citationService'];
      if (citationService && typeof citationService.testGrobidConnection === 'function') {
        testResults.services.citationService = await citationService.testGrobidConnection();
      }
    } catch (error) {
      console.warn('Citation service test failed:', error);
    }

    const overallHealth = Object.values(testResults.services).every(status => status);

    res.json({
      success: true,
      status: overallHealth ? 'healthy' : 'degraded',
      testResults,
      recommendations: [
        !testResults.services.llmConnection && 'Check LLM service connection',
        !testResults.services.citationService && 'Check GROBID service connection',
        !testResults.services.deepAnalyzer && 'Deep analyzer initialization failed'
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('Status check failed:', error);
    
    res.status(500).json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Status check failed'
    });
  }
});

/**
 * 分析單一論文關係
 * POST /api/enhanced-graph/analyze-relationship
 */
router.post('/analyze-relationship', async (req, res) => {
  try {
    const { sourcePaper, targetPaper } = req.body;
    
    if (!sourcePaper || !targetPaper) {
      return res.status(400).json({
        success: false,
        error: 'Both sourcePaper and targetPaper URLs are required'
      });
    }

    console.log(`🔍 Analyzing relationship: ${sourcePaper} → ${targetPaper}`);
    
    // 使用增強服務分析單一關係
    const result = await enhancedGraphService.buildEnhancedGraph([sourcePaper, targetPaper]);
    
    // 找到兩篇論文間的關係
    const relationship = result.edges.find(edge => 
      (edge.source.includes(sourcePaper) && edge.target.includes(targetPaper)) ||
      (edge.target.includes(sourcePaper) && edge.source.includes(targetPaper))
    );

    res.json({
      success: true,
      relationship: relationship || null,
      sourceNode: result.nodes.find(n => n.id.includes(sourcePaper)),
      targetNode: result.nodes.find(n => n.id.includes(targetPaper)),
      message: relationship ? 
        `Found ${relationship.relationship} relationship with strength ${relationship.strength.toFixed(3)}` :
        'No significant relationship detected between the papers'
    });

  } catch (error) {
    console.error('Relationship analysis failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Relationship analysis failed'
    });
  }
});

/**
 * 獲取論文深度分析信息
 * POST /api/enhanced-graph/paper-analysis
 */
router.post('/paper-analysis', async (req, res) => {
  try {
    const { paperUrl } = req.body;
    
    if (!paperUrl) {
      return res.status(400).json({
        success: false,
        error: 'Paper URL is required'
      });
    }

    console.log(`🔍 Performing deep analysis for: ${paperUrl}`);
    
    // 構建只包含一篇論文的圖來獲取深度分析
    const result = await enhancedGraphService.buildEnhancedGraph([paperUrl]);
    
    if (result.nodes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paper could not be processed or analyzed'
      });
    }

    const paperNode = result.nodes[0];
    
    res.json({
      success: true,
      paper: {
        basicInfo: {
          title: paperNode.title,
          authors: paperNode.authors,
          year: paperNode.year,
          abstract: paperNode.abstract,
          venue: paperNode.venue,
          category: paperNode.category
        },
        deepAnalysis: paperNode.structuredAnalysis,
        citations: {
          count: result.edges.filter(e => e.source === paperNode.id).length,
          relationships: result.edges.filter(e => e.source === paperNode.id)
        }
      },
      message: `Successfully analyzed paper with ${paperNode.structuredAnalysis?.contributions.length || 0} contributions identified`
    });

  } catch (error) {
    console.error('Paper analysis failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Paper analysis failed'
    });
  }
});

export default router;
