/**
 * Paper Graph Routes
 * API 端點用於論文關係圖構建
 */

import { Router } from 'express';
import { PaperGraphBuilder } from '../services/PaperGraphBuilder';
import { ObsidianSyncService } from '../services/ObsidianSyncService';
import { PaperCitationService } from '../services/PaperCitationService';

const router = Router();
const graphBuilder = new PaperGraphBuilder();
const obsidianSync = new ObsidianSyncService();
const citationService = new PaperCitationService();

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
      // 创建 URL 映射以便查找
      const urlMap = new Map<string, string>();
      if (result.papers) {
        result.papers.forEach((paper, index) => {
          if (paper.url && urls[index]) {
            urlMap.set(paper.id, paper.url);
          }
        });
      }

      const graphData = {
        nodes: result.graph.nodes.map(node => {
          // 尝试从 URL 映射中查找，或使用节点自带的 URL
          const nodeUrl = node.url || urlMap.get(node.id) || '';
          // 从 URL 提取 arxivId（如果还没有）
          const nodeArxivId = node.arxivId || (nodeUrl.match(/arxiv\.org\/(?:abs|pdf)\/([^\/\?]+)/i)?.[1]?.replace(/\.pdf$/, ''));

          return {
          id: node.id,
          label: node.title, // Add label field using title
          title: node.title,
          authors: node.authors,
          abstract: node.abstract || '', // Use actual abstract from GROBID
          introduction: '', // Empty for now, can be populated later
            url: nodeUrl, // 使用保存的 URL 或从映射中获取
          tags: node.category ? [node.category] : [], // Use category as tag if available
          year: node.year || 'Unknown',
          venue: node.venue || '',
          conference: '',
            citationCount: node.citationCount ?? null,
            paperCitationCount: node.paperCitationCount ?? node.citationCount ?? null, // 避免因未获取到而误显示为0
          doi: '',
            arxivId: nodeArxivId || ''
          };
        }),
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

      // 使用 PaperCitationService 获取 Prior Works 和 Derivative Works
      console.log('\n=== Fetching Prior & Derivative Works via PaperCitationService ===');
      const priorWorksMap: Record<string, any[]> = {};
      const derivativeWorksMap: Record<string, any[]> = {};
      
      // 并行获取所有论文的 prior 和 derivative works
      const fetchPromises = urls.map(async (url: string) => {
        if (!url || !url.trim()) {
          priorWorksMap[url] = [];
          derivativeWorksMap[url] = [];
          return;
        }
        
        try {
          console.log(`🔍 Fetching prior and derivative works for: ${url}`);
          
          // 获取 prior works
          const priorWorks = await citationService.getPriorWorksFromUrl(url);
          priorWorksMap[url] = priorWorks.map(work => ({
            id: work.id || work.url || `prior_${work.title?.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            title: work.title || 'Unknown Title',
            authors: work.authors || [],
            year: work.year || 'Unknown',
            abstract: work.abstract || '',
            url: work.url || '',
            citationCount: work.citationCount ?? null, // 使用 null 而不是 0
            arxivId: work.arxivId || ''
          }));
          
          // 获取 derivative works
          const derivativeWorks = await citationService.getDerivativeWorksFromUrl(url);
          derivativeWorksMap[url] = derivativeWorks.map(work => ({
            id: work.id || work.url || `derivative_${work.title?.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            title: work.title || 'Unknown Title',
            authors: work.authors || [],
            year: work.year || 'Unknown',
            abstract: work.abstract || '',
            url: work.url || '',
            citationCount: work.citationCount ?? null, // 使用 null 而不是 0
            arxivId: work.arxivId || ''
          }));
          
          console.log(`✅ Paper "${url}":`);
          console.log(`   📚 Prior Works: ${priorWorks.length}`);
          console.log(`   🔗 Derivative Works: ${derivativeWorks.length}`);
        } catch (error) {
          console.error(`❌ Failed to fetch works for ${url}:`, error);
          priorWorksMap[url] = [];
          derivativeWorksMap[url] = [];
        }
      });
      
      await Promise.all(fetchPromises);

      res.json({
        success: true,
        graphData: graphData,
        statistics: {
          totalNodes: graphData.nodes.length,
          totalEdges: graphData.edges.length,
          extractionType: 'standard'
        },
        // 添加原始论文的 prior 和 derivative works
        originalPapers: {
          urls: urls.filter(u => u && u.trim()),
          priorWorks: priorWorksMap,
          derivativeWorks: derivativeWorksMap
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
        nodes: result.graph.nodes.map(node => {
          // 从节点中获取 URL 和 arxivId（如果有的话）
          const nodeUrl = node.url || '';
          const nodeArxivId = node.arxivId || (nodeUrl.match(/arxiv\.org\/(?:abs|pdf)\/([^\/\?]+)/i)?.[1]?.replace(/\.pdf$/, ''));

          return {
          id: node.id,
          label: node.title, // Add label field using title
          title: node.title,
          authors: node.authors,
          abstract: node.abstract || '', // Use actual abstract from GROBID
          introduction: '', // Empty for now, can be populated later
            url: nodeUrl, // 使用节点中的 URL
          tags: node.category ? [node.category] : [], // Use category as tag if available
          year: node.year || 'Unknown',
          venue: node.venue || '',
          conference: '',
          citationCount: 0,
          doi: '',
            arxivId: nodeArxivId || ''
          };
        }),
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
