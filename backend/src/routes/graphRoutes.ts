/**
 * Paper Graph Routes
 * API 端點用於論文關係圖構建
 */

import { Router } from 'express';
import { PaperGraphBuilder } from '../services/PaperGraphBuilder';
import { ObsidianSyncService } from '../services/ObsidianSyncService';

const router = Router();
const graphBuilder = new PaperGraphBuilder();
const obsidianSync = new ObsidianSyncService();

/**
 * 測試工作流程
 */
router.post('/test-workflow', async (req, res) => {
  try {
    console.log('\n=== Graph Building Test Workflow ===');
    
    const result = await graphBuilder.testWorkflow();
    
    res.json(result);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Test workflow error:', errorMessage);
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

/**
 * 從論文 URL 列表構建關係圖
 */
router.post('/build-graph', async (req, res) => {
  try {
    const { urls, filterSections, expansionDepth = 0 } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of paper URLs'
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 papers allowed per request'
      });
    }

    console.log(`\n=== Building Graph for ${urls.length} Papers ===`);
    console.log('URLs:', urls);
    console.log('Filter sections:', filterSections);
    console.log('Expansion depth:', expansionDepth);

    // Use filtered citation extraction if filterSections is enabled, otherwise use the basic method
    const result = filterSections 
      ? await graphBuilder.buildGraphWithFilteredCitations(urls, expansionDepth)
      : await graphBuilder.buildGraphFromUrls(urls);
    
    if (result.success && result.graph) {
      // Transform PaperGraph to frontend GraphData format
      const graphData = {
        nodes: result.graph.nodes.map(node => ({
          id: node.id,
          label: node.title, // Add label field using title
          title: node.title,
          authors: node.authors,
          abstract: node.abstract || '', // Use actual abstract from GROBID
          introduction: '', // Empty for now, can be populated later
          url: '', // Empty for now, can be populated later
          tags: node.category ? [node.category] : [], // Use category as tag if available
          year: node.year || 'Unknown',
          venue: node.venue || '',
          conference: '',
          citationCount: node.citationCount || 0,
          paperCitationCount: node.paperCitationCount || node.citationCount || 0, // Add paperCitationCount
          doi: '',
          arxivId: ''
        })),
        edges: result.graph.edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          relationship: edge.relationship,
          strength: edge.strength,
          evidence: edge.evidence,
          description: edge.description
        }))
      };
      
      console.log(`🔍 [API RESPONSE DEBUG] Sending graphData with nodes:`, 
        graphData.nodes.map(node => ({
          id: node.id,
          title: node.title?.substring(0, 50) + '...',
          citationCount: node.citationCount,
          paperCitationCount: node.paperCitationCount
        }))
      );

      res.json({
        success: true,
        graphData: graphData,
        statistics: {
          totalNodes: graphData.nodes.length,
          totalEdges: graphData.edges.length,
          extractionType: 'standard'
        }
      });
    } else {
      res.json(result);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Graph building error:', errorMessage);
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

/**
 * 快速測試（使用預設論文）
 */
router.post('/quick-test', async (req, res) => {
  try {
    const { paperSet } = req.body;
    
    let testUrls: string[];
    
    switch (paperSet) {
      case 'transformer':
        testUrls = [
          'https://arxiv.org/abs/1706.03762', // Attention Is All You Need
          'https://arxiv.org/abs/2010.11929'  // Vision Transformer
        ];
        break;
      case 'nas':
        testUrls = [
          'https://arxiv.org/abs/1611.01578', // Neural Architecture Search
          'https://arxiv.org/abs/1806.09055'  // Efficient NAS
        ];
        break;
      default:
        testUrls = [
          'https://arxiv.org/abs/1706.03762', // Transformer
          'https://arxiv.org/abs/2010.11929'  // Vision Transformer
        ];
    }

    console.log(`\n=== Quick Test: ${paperSet || 'default'} ===`);
    console.log('Test URLs:', testUrls);

    const result = await graphBuilder.buildGraphFromUrls(testUrls);
    
    res.json(result);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Quick test error:', errorMessage);
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

/**
 * Build graph with filtered citation extraction from Introduction/Related Work sections
 */
router.post('/build-with-filtered-citations', async (req, res) => {
  try {
    const { urls, expansionDepth = 0 } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URLs array is required'
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 papers allowed per request'
      });
    }

    console.log('Building graph with filtered citations for URLs:', urls);
    console.log('Expansion depth:', expansionDepth);

    const builder = new PaperGraphBuilder();
    
    // Use the filtered citations method with optional expansion depth
    const result = await builder.buildGraphWithFilteredCitations(urls, expansionDepth);

    if (result.success && result.graph) {
      // Transform PaperGraph to frontend GraphData format
      const graphData = {
        nodes: result.graph.nodes.map(node => ({
          id: node.id,
          label: node.title, // Add label field using title
          title: node.title,
          authors: node.authors,
          abstract: node.abstract || '', // Use actual abstract from GROBID
          introduction: '', // Empty for now, can be populated later
          url: '', // Empty for now, can be populated later
          tags: node.category ? [node.category] : [], // Use category as tag if available
          year: node.year || 'Unknown',
          venue: node.venue || '',
          conference: '',
          citationCount: 0,
          doi: '',
          arxivId: ''
        })),
        edges: result.graph.edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          relationship: edge.relationship,
          strength: edge.strength,
          evidence: edge.evidence,
          description: edge.description
        }))
      };

      res.json({
        success: true,
        graphData: graphData,
        statistics: {
          totalNodes: graphData.nodes.length,
          totalEdges: graphData.edges.length,
          extractionType: 'filtered'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to build graph'
      });
    }
  } catch (error) {
    console.error('Graph building error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 同步 graph 到 Obsidian
 */
router.post('/sync-to-obsidian', async (req, res) => {
  try {
    const { graphData, graphName, vaultPath } = req.body;
    
    if (!graphData || !graphData.nodes || !graphData.edges) {
      return res.status(400).json({
        success: false,
        error: 'Invalid graph data provided'
      });
    }

    // 如果提供了 vault 路徑，使用它
    if (vaultPath) {
      obsidianSync.setVaultPath(vaultPath);
    }

    console.log(`\n=== Syncing Graph to Obsidian ===`);
    console.log(`Graph Name: ${graphName || 'Unnamed Graph'}`);
    console.log(`Vault Path: ${obsidianSync.getVaultPath()}`);
    console.log(`Papers: ${graphData.nodes.length}, Relationships: ${graphData.edges.length}`);

    const result = await obsidianSync.syncGraphToObsidian(
      graphData, 
      graphName || `Paper Graph ${new Date().toISOString().split('T')[0]}`
    );

    res.json(result);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Obsidian sync error:', errorMessage);
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

/**
 * 設置 Obsidian vault 路徑
 */
router.post('/set-obsidian-path', async (req, res) => {
  try {
    const { vaultPath } = req.body;
    
    if (!vaultPath) {
      return res.status(400).json({
        success: false,
        error: 'Vault path is required'
      });
    }

    obsidianSync.setVaultPath(vaultPath);
    
    res.json({
      success: true,
      message: 'Obsidian vault path updated successfully',
      vaultPath: obsidianSync.getVaultPath()
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Set Obsidian path error:', errorMessage);
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

/**
 * 獲取當前 Obsidian vault 路徑
 */
router.get('/obsidian-path', (req, res) => {
  res.json({
    success: true,
    vaultPath: obsidianSync.getVaultPath()
  });
});

export default router;
