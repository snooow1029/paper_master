import { Request, Response } from 'express';
import { AdvancedCitationService } from '../services/AdvancedCitationService';
import { PaperRelationshipAnalyzer } from '../services/PaperRelationshipAnalyzer';

/**
 * 調試路由 - 顯示傳給 LLM 的完整內容
 */
export const debugLLMContent = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('\n=== DEBUG LLM Content ===');
    console.log('URL:', url);

    // Step 1: 使用 GROBID 提取論文內容
    const grobidService = new AdvancedCitationService();
    const extractedData = await grobidService.extractCitationsWithContext(url);

    if (!extractedData.success) {
      return res.status(500).json({ error: 'Failed to extract paper data' });
    }

    console.log('\n--- GROBID 提取的原始數據 ---');
    console.log('論文標題:', extractedData.paperTitle);
    console.log('引用數量:', extractedData.citations.length);

    // 顯示每個引用的上下文
    extractedData.citations.forEach((citation, index) => {
      console.log(`\n引用 ${index + 1}:`);
      console.log('- 標題:', citation.title);
      console.log('- 作者:', citation.authors?.join(', ') || 'N/A');
      console.log('- 年份:', citation.year || 'N/A');
      console.log('- 所在章節:', citation.section || 'N/A');
      console.log('- 引用前文:', citation.contextBefore);
      console.log('- 引用後文:', citation.contextAfter);
      console.log('- 完整上下文 (前200字):', citation.context.substring(0, 200) + '...');
      console.log('- 完整上下文長度:', citation.context.length, '字符');
    });

    // Step 2: 假設我們有兩篇論文，模擬 LLM 分析過程
    if (extractedData.citations.length > 0) {
      console.log('\n--- 模擬 LLM 分析提示詞 ---');
      
      const sourcePaper = {
        id: 'source_paper',
        title: extractedData.paperTitle,
        authors: ['Unknown Author'],
        year: '2024',
        abstract: 'Abstract not available',
        venue: 'Unknown',
        citations: extractedData.citations.map(c => ({
          title: c.title,
          context: c.context,
          contextBefore: c.contextBefore,
          contextAfter: c.contextAfter
        }))
      };

      const targetPaper = {
        id: 'target_paper',
        title: extractedData.citations[0].title || 'Unknown Title',
        authors: extractedData.citations[0].authors || ['Unknown Author'],
        year: extractedData.citations[0].year || 'Unknown',
        abstract: 'Abstract not available',
        venue: 'Unknown',
        citations: []
      };

      // 建立 LLM 分析器
      const analyzer = new PaperRelationshipAnalyzer();
      
      // 獲取第一個引用的完整上下文
      const firstCitation = extractedData.citations[0];
      const citationContext = firstCitation.context;

      console.log('\n=== 完整的 LLM 提示詞 ===');
      
      // 使用內部方法構建提示詞 (這裡需要訪問私有方法，所以我們重新實現)
      const sourceShort = (extractedData.paperTitle || 'Unknown Paper').substring(0, 50) + '...';
      const targetShort = (firstCitation.title || 'Unknown Title').substring(0, 50) + '...';
      const contextLen = citationContext.length;

      const prompt = `You are an expert academic researcher skilled in literature reviews. Your task is to summarize the relationship between two research papers based on a specific citation context.

**Citing Paper (${sourceShort}):**
- Title: "${extractedData.paperTitle || 'Unknown Paper'}"

**Cited Paper (${targetShort}):**
- Title: "${firstCitation.title || 'Unknown Title'}"

**Citation Context from ${sourceShort}:**
"""
${citationContext}
""" (${contextLen} chars)

**Your Instruction:**
Based ONLY on the "Citation Context" provided above, analyze how ${sourceShort} is citing ${targetShort} and provide:

1. **Relationship Type** - Choose one:
   - builds_on: ${sourceShort} directly builds upon ${targetShort}'s work
   - extends: ${sourceShort} extends or improves ${targetShort}'s methods
   - applies: ${sourceShort} applies ${targetShort}'s methods to new domains
   - compares: ${sourceShort} compares with ${targetShort}
   - critiques: ${sourceShort} points out limitations or criticizes ${targetShort}
   - references: ${sourceShort} simply references ${targetShort} for background/context

2. **Strength** - Rate from 0.0 to 1.0 how strongly ${sourceShort} relies on or connects to ${targetShort}

3. **Description** - Write a single, concise sentence that describes why ${sourceShort} is citing ${targetShort}

Please respond in JSON format:
{
  "relationship": "relationship_type",
  "strength": 0.8,
  "evidence": "exact quote from citation context that supports your analysis",
  "description": "concise description of why ${sourceShort} cites ${targetShort}"
}`;

      console.log(prompt);
      console.log('\n=== 提示詞統計 ===');
      console.log('提示詞總長度:', prompt.length, '字符');
      console.log('引用上下文長度:', citationContext.length, '字符');
      console.log('上下文占比:', Math.round(citationContext.length / prompt.length * 100), '%');
    }

    // 返回調試信息
    res.json({
      success: true,
      debug: {
        paperTitle: extractedData.paperTitle,
        citationCount: extractedData.citations.length,
        citations: extractedData.citations.map(c => ({
          title: c.title,
          authors: c.authors,
          year: c.year,
          section: c.section,
          contextLength: c.context.length,
          contextPreview: c.context.substring(0, 200) + '...',
          contextBefore: c.contextBefore,
          contextAfter: c.contextAfter
        })),
        totalContextLength: extractedData.citations.reduce((sum, c) => sum + c.context.length, 0),
        averageContextLength: extractedData.citations.length > 0 
          ? Math.round(extractedData.citations.reduce((sum, c) => sum + c.context.length, 0) / extractedData.citations.length)
          : 0
      }
    });

  } catch (error) {
    console.error('Debug LLM content failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
