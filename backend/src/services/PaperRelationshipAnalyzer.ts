/**
 * Paper Relationship Analysis Service
 * 使用 LLM 分析論文之間的承接關係
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { SmartFilterService } from './SmartFilterService';

export interface PaperMetadata {
  id: string;
  title: string;
  authors: string[];
  year: string;
  abstract?: string;
  venue?: string;
  citationCount?: number; // 新增：引用次數
  paperCitationCount?: number; // 直接的 paperCitationCount 字段
  citations: Array<{
    id: string;
    title?: string;
    authors?: string[];
    year?: string;
    context: string;
    contextBefore: string;
    contextAfter: string;
  }>;
}

export interface RelationshipEdge {
  source: string; // 源論文 ID
  target: string; // 目標論文 ID
  relationship: 'builds_on' | 'extends' | 'applies' | 'compares' | 'surveys' | 'critiques';
  strength: number; // 關係強度 0-1
  evidence: string; // 關係證據
  description: string; // 關係描述
}

export interface PaperGraph {
  nodes: Array<{
    id: string;
    title: string;
    authors: string[];
    year: string;
    abstract?: string;
    venue?: string;
    category?: string;
    citationCount?: number; // 新增：引用次數
    paperCitationCount?: number; // 新增：直接的 paperCitationCount 字段
  }>;
  edges: RelationshipEdge[];
}

export class PaperRelationshipAnalyzer {
  private genAI: GoogleGenerativeAI | null;
  private llmType: string;
  private llmUrl: string;
  private llmModel: string;
  private geminiModel: string;
  private smartFilter: SmartFilterService;
  private useSmartFilter: boolean;

  constructor() {
    this.llmType = process.env.LLM_TYPE || 'gemini';
    this.llmUrl = process.env.LOCAL_LLM_URL || 'http://localhost:8000';
    this.llmModel = process.env.LOCAL_LLM_MODEL || 'Qwen/Qwen3-4B-Instruct-2507';
    this.geminiModel = process.env.GEMINI_MODEL || 'gemini-pro';
    this.smartFilter = new SmartFilterService();
    this.useSmartFilter = process.env.USE_SMART_FILTER !== 'false'; // 默认启用
    
    if (this.llmType === 'gemini' || this.llmType === 'openai') {
      const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
      if (apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey !== 'your_openai_api_key_here') {
        this.genAI = new GoogleGenerativeAI(apiKey);
        console.log(`Using Google Gemini API (${this.geminiModel}) for relationship analysis`);
      } else {
        this.genAI = null;
        console.warn('Gemini API key not configured. Falling back to local LLM.');
      }
    } else {
      this.genAI = null;
      console.log(`Using local LLM at ${this.llmUrl} with model ${this.llmModel}`);
    }
    
    if (this.useSmartFilter) {
      console.log('✅ Smart Filter enabled - will pre-filter paper pairs before LLM analysis');
    }
  }

  // 取得論文縮寫（如SRSA、GPT-4），優先用label，否則取標題首字母
  private getPaperShortLabel(paper: PaperMetadata): string {
    // @ts-ignore: label可能存在於GraphNode型別
    if ((paper as any).label) return (paper as any).label;
    const words = paper.title.split(/\s+/);
    // 使用標題的第一個單字作為代稱
    return words[0] || paper.title.slice(0, 8);
  }

  /**
   * 測試 LLM 連接
   */
  async testLLMConnection(): Promise<boolean> {
    try {
      if ((this.llmType === 'gemini' || this.llmType === 'openai') && this.genAI) {
        const model = this.genAI.getGenerativeModel({ model: this.geminiModel });
        const result = await model.generateContent('Hello, are you working correctly?');
        const response = await result.response;
        return !!response.text();
      } else {
        const response = await axios.post(`${this.llmUrl}/v1/chat/completions`, {
          model: this.llmModel,
          messages: [
            {
              role: 'user',
              content: 'Hello, are you working correctly?'
            }
          ],
          max_tokens: 50,
          temperature: 0.3
        }, {
          timeout: 10000
        });

        return response.status === 200 && response.data?.choices?.length > 0;
      }
    } catch (error) {
      console.error('LLM connection test failed:', error);
      return false;
    }
  }

  /**
   * 帶重試機制的 LLM 調用
   */
  private async callLLMWithRetry(
    messages: Array<{role: string, content: string}>,
    maxRetries: number = 2
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        if ((this.llmType === 'gemini' || this.llmType === 'openai') && this.genAI) {
          // 使用 Gemini API
          const model = this.genAI.getGenerativeModel({ 
            model: this.geminiModel,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1000,
            },
          });
          
          // 将 messages 转换为 prompt
          const systemMessage = messages.find(m => m.role === 'system');
          const userMessages = messages.filter(m => m.role === 'user');
          let prompt = '';
          if (systemMessage) {
            prompt = `${systemMessage.content}\n\n${userMessages.map(m => m.content).join('\n\n')}`;
          } else {
            prompt = userMessages.map(m => m.content).join('\n\n');
          }
          
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const content = response.text();
          
          // 返回兼容格式
          return {
            data: {
              choices: [{
                message: {
                  content: content
                }
              }]
            }
          };
        } else {
          // 使用本地 LLM
          const response = await axios.post(`${this.llmUrl}/v1/chat/completions`, {
            model: this.llmModel,
            messages,
            max_tokens: 1000,
            temperature: 0.3
          }, {
            timeout: 30000 // 30秒超時
          });

          if (response.status === 200 && response.data?.choices?.length > 0) {
            return response;
          }
          
          throw new Error(`LLM returned invalid response: ${response.status}`);
        }
      } catch (error) {
        console.warn(`LLM call attempt ${attempt}/${maxRetries + 1} failed:`, error instanceof Error ? error.message : error);
        
        if (attempt <= maxRetries) {
          // 指數退避策略
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * 分析兩篇論文之間的關係
   */
  async analyzePairwiseRelationship(
    sourcePaper: PaperMetadata,
    targetPaper: PaperMetadata
  ): Promise<RelationshipEdge | null> {
    try {
      console.log('\n🔍 === ANALYZING PAPER RELATIONSHIP ===');
      console.log(`📄 Source Paper: ${sourcePaper.title?.substring(0, 80)}...`);
      console.log(`📄 Target Paper: ${targetPaper.title?.substring(0, 80)}...`);
      
      // 找到源論文中引用目標論文的上下文
      const relevantCitations = sourcePaper.citations.filter(citation => 
        citation.title && targetPaper.title && 
        this.isSimilarTitle(citation.title, targetPaper.title)
      );

      console.log(`🔗 Found ${relevantCitations.length} relevant citations`);

      if (relevantCitations.length === 0) {
        console.log('❌ No direct citation relationship found');
        return null; // 沒有直接引用關係
      }

      const citationContexts = relevantCitations.map(c => c.context).join('\n\n');
      
      console.log('\n📊 GROBID EXTRACTED CITATION CONTEXTS:');
      console.log('=' .repeat(80));
      relevantCitations.forEach((citation, index) => {
        console.log(`\n🔸 Citation ${index + 1}:`);
        console.log(`Title match: "${citation.title}"`);
        console.log(`Context (${citation.context?.length || 0} chars):`);
        console.log(citation.context || 'No context');
        console.log('-'.repeat(60));
      });

      const prompt = this.buildRelationshipAnalysisPrompt(
        sourcePaper,
        targetPaper,
        citationContexts
      );

      console.log('\n🤖 LLM PROMPT:');
      console.log('=' .repeat(80));
      console.log(prompt);
      console.log('=' .repeat(80));

      const response = await this.callLLMWithRetry([
        {
          role: 'system',
          content: `You are an expert academic researcher skilled in literature reviews and citation analysis. Your task is to analyze the relationship between two academic papers based on citation context. Provide clear, concise analysis in English with structured JSON output.`
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      const analysis = response.data.choices[0].message.content;
      
      console.log('\n🤖 LLM RESPONSE:');
      console.log('=' .repeat(80));
      console.log(analysis);
      console.log('=' .repeat(80));
      
      const parsedResult = this.parseRelationshipAnalysis(analysis, sourcePaper.id, targetPaper.id, citationContexts);
      
      console.log('\n📊 PARSED RELATIONSHIP:');
      console.log('=' .repeat(80));
      console.log(JSON.stringify(parsedResult, null, 2));
      console.log('=' .repeat(80));
      
      return parsedResult;

    } catch (error) {
      console.error('❌ Relationship analysis failed:', error);
      return null;
    }
  }

  /**
   * 分析多篇論文的關係圖
   */
  async buildRelationshipGraph(papers: PaperMetadata[]): Promise<PaperGraph> {
    console.log(`\n=== Building Relationship Graph for ${papers.length} Papers ===`);
    
    const nodes = papers.map(paper => ({
      id: paper.id,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      abstract: paper.abstract,
      venue: paper.venue,
      citationCount: paper.citationCount, // 新增：引用次數
      paperCitationCount: paper.paperCitationCount, // 新增：直接的 paperCitationCount 字段
    }));
    
    console.log(`🔍 [RELATIONSHIP ANALYZER DEBUG] Created nodes with citations:`, 
      nodes.map(node => ({
        id: node.id,
        title: node.title?.substring(0, 50) + '...',
        citationCount: node.citationCount,
        paperCitationCount: node.paperCitationCount
      }))
    );

    // 使用智能过滤筛选论文对
    let paperPairs: Array<{source: PaperMetadata, target: PaperMetadata, index: number, confidence?: number}> = [];
    
    if (this.useSmartFilter) {
      console.log(`\n🔍 Applying Smart Filter to ${papers.length} papers...`);
      const filteredPairs = this.smartFilter.filterPaperPairs(papers);
      
      paperPairs = filteredPairs.map((pair, idx) => ({
        source: pair.source,
        target: pair.target,
        index: idx,
        confidence: pair.confidence
      }));
      
      console.log(`✅ Smart Filter selected ${paperPairs.length} pairs for LLM analysis`);
    } else {
      // 传统方式：生成所有论文对
      let pairIndex = 0;
      for (let i = 0; i < papers.length; i++) {
        for (let j = 0; j < papers.length; j++) {
          if (i === j) continue;
          paperPairs.push({
            source: papers[i], 
            target: papers[j],
            index: pairIndex++
          });
        }
      }
      console.log(`Total pairs to analyze: ${paperPairs.length}`);
    }

    // 使用並行處理，但限制併發數量以避免 LLM 服務器過載
    const maxConcurrency = process.env.LLM_MAX_CONCURRENCY ? 
      parseInt(process.env.LLM_MAX_CONCURRENCY) : 3;
    
    console.log(`Using ${maxConcurrency} concurrent LLM requests`);
    
    const edges: RelationshipEdge[] = [];
    const batches: Array<Array<{source: PaperMetadata, target: PaperMetadata, index: number}>> = [];
    
    // 將論文對分批處理
    for (let i = 0; i < paperPairs.length; i += maxConcurrency) {
      batches.push(paperPairs.slice(i, i + maxConcurrency));
    }

    let completedPairs = 0;
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (pair) => {
        const startTime = Date.now();
        console.log(`[${pair.index + 1}/${paperPairs.length}] Analyzing: ${pair.source.title.slice(0, 50)}... -> ${pair.target.title.slice(0, 50)}...`);
        
        try {
          const relationship = await this.analyzePairwiseRelationship(pair.source, pair.target);
          const duration = Date.now() - startTime;
          
          if (relationship) {
            console.log(`✅ [${pair.index + 1}] Found ${relationship.relationship} (strength: ${relationship.strength.toFixed(2)}) - ${duration}ms`);
            return relationship;
          } else {
            console.log(`⚪ [${pair.index + 1}] No significant relationship found - ${duration}ms`);
            return null;
          }
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`❌ [${pair.index + 1}] Analysis failed - ${duration}ms:`, error);
          return null;
        }
      });

      // 等待當前批次完成
      const batchResults = await Promise.all(batchPromises);
      
      // 收集有效的關係
      for (const result of batchResults) {
        if (result) {
          edges.push(result);
        }
      }
      
      completedPairs += batch.length;
      console.log(`Progress: ${completedPairs}/${paperPairs.length} pairs completed (${Math.round(completedPairs/paperPairs.length*100)}%)`);
      
      // 批次間短暫暫停，避免過載 LLM 服務器
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.sleep(500);
      }
    }

    console.log(`\n🎉 === RELATIONSHIP GRAPH CONSTRUCTION COMPLETED ===`);
    console.log(`📊 Final Graph Statistics:`);
    console.log(`   Nodes: ${nodes.length} papers`);
    console.log(`   Edges: ${edges.length} relationships`);
    console.log(`   Analysis Success Rate: ${Math.round(edges.length/paperPairs.length*100)}%`);
    
    console.log(`\n🔗 DISCOVERED RELATIONSHIPS:`);
    edges.forEach((edge, index) => {
      const sourceTitle = nodes.find(n => n.id === edge.source)?.title || 'Unknown';
      const targetTitle = nodes.find(n => n.id === edge.target)?.title || 'Unknown';
      console.log(`\n${index + 1}. ${sourceTitle.substring(0, 60)}...`);
      console.log(`   ${edge.relationship} (${edge.strength.toFixed(2)}) →`);
      console.log(`   ${targetTitle.substring(0, 60)}...`);
      console.log(`   📝 ${edge.description}`);
      console.log(`   🎯 Evidence: ${edge.evidence.substring(0, 150)}${edge.evidence.length > 150 ? '...' : ''}`);
    });
    
    console.log(`\n🏗️ HOW LLM OUTPUT IS USED:`);
    console.log(`1. 📄 Grobid extracts citation contexts from papers`);
    console.log(`2. 🤖 LLM analyzes relationships based on contexts`);
    console.log(`3. 📊 Parsed results become graph edges with:`);
    console.log(`   - Relationship type (builds_on, extends, applies, etc.)`);
    console.log(`   - Strength score (0.0-1.0) for edge thickness/opacity`);
    console.log(`   - Evidence quotes for edge tooltip/details`);
    console.log(`   - Description for human-readable explanation`);
    console.log(`4. 🎨 Frontend renders interactive graph visualization`);

    return { nodes, edges };
  }

  /**
   * 構建關係分析提示詞
   */
  private buildRelationshipAnalysisPrompt(
    sourcePaper: PaperMetadata,
    targetPaper: PaperMetadata,
    citationContext: string
  ): string {
    const sourceShort = this.getPaperShortLabel(sourcePaper);
    const targetShort = this.getPaperShortLabel(targetPaper);
    // 顯示context前後字數
    const contextLen = citationContext.length;
    let contextInfo = `(${contextLen} chars)`;
    return `You are an expert academic researcher skilled in literature reviews. Your task is to summarize the relationship between two research papers based on a specific citation context.

**Citing Paper (${sourceShort}):**
- Title: "${sourcePaper.title}"

**Cited Paper (${targetShort}):**
- Title: "${targetPaper.title}"

**Citation Context from ${sourceShort}:**
"""
${citationContext}
""" ${contextInfo}

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
  "evidence": "exact quote from citation context that supports your analysis - ensure the quote is a complete sentence or meaningful phrase",
  "description": "concise description of why ${sourceShort} cites ${targetShort}"
}

**Important**: When providing the "evidence" field, make sure to:
- Include complete sentences or meaningful phrases from the citation context
- Do not cut off sentences in the middle
- If the context is long, select the most relevant complete sentence(s)
- Preserve the original wording exactly as it appears in the context`;
  }

  /**
   * 檢查並修復 evidence 文本的完整性
   */
  private fixIncompleteEvidence(evidence: string, originalContext: string): string {
    if (!evidence || !originalContext) return evidence;

    // 檢查是否以句號、問號、驚嘆號結尾
    const endsWithPunctuation = /[.!?]$/.test(evidence.trim());
    
    // 如果不是以標點符號結尾，嘗試在原始context中找到完整句子
    if (!endsWithPunctuation) {
      // 在原始context中查找包含這段evidence的位置
      const evidenceIndex = originalContext.indexOf(evidence);
      if (evidenceIndex !== -1) {
        // 從evidence開始位置往後找到第一個句號、問號或驚嘆號
        const afterEvidence = originalContext.slice(evidenceIndex + evidence.length);
        const nextPunctuationMatch = afterEvidence.match(/^[^.!?]*[.!?]/);
        
        if (nextPunctuationMatch) {
          return evidence + nextPunctuationMatch[0];
        }
      }
      
      // 如果找不到，嘗試往前找完整句子的開始
      if (evidenceIndex !== -1) {
        const beforeStart = Math.max(0, evidenceIndex - 100); // 往前找100字符
        const contextBefore = originalContext.slice(beforeStart, evidenceIndex + evidence.length + 100);
        
        // 尋找包含evidence的完整句子
        const sentences = contextBefore.split(/[.!?]+/).filter(s => s.trim().length > 0);
        for (const sentence of sentences) {
          if (sentence.includes(evidence.slice(0, 20))) { // 檢查是否包含evidence的前20字符
            return sentence.trim() + '.';
          }
        }
      }
    }
    
    return evidence;
  }

  /**

  /**
   * 解析 LLM 的關係分析結果
   */
  private parseRelationshipAnalysis(
    analysis: string,
    sourceId: string,
    targetId: string,
    originalContext?: string
  ): RelationshipEdge | null {
    try {
      console.log('\n🔧 PARSING LLM RESPONSE:');
      console.log('Raw analysis length:', analysis.length);
      
      // 嘗試提取 JSON
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('❌ No JSON found in LLM response');
        console.log('Response content:', analysis);
        return null;
      }

      console.log('✅ JSON extracted successfully');
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
      
      // 修復不完整的 evidence 文本
      let evidence = parsed.evidence || '';
      if (originalContext) {
        const originalEvidence = evidence;
        evidence = this.fixIncompleteEvidence(evidence, originalContext);
        if (originalEvidence !== evidence) {
          console.log('🔧 Evidence fixed:');
          console.log('  Original:', originalEvidence);
          console.log('  Fixed:', evidence);
        }
      }
      
      const result = {
        source: sourceId,
        target: targetId,
        relationship: parsed.relationship || 'builds_on',
        strength: Math.max(0, Math.min(1, parsed.strength || 0.5)),
        evidence: evidence,
        description: parsed.description || ''
      };
      
      console.log('\n✅ FINAL PARSED RESULT:');
      console.log('🔗 Relationship:', result.relationship);
      console.log('💪 Strength:', result.strength);
      console.log('📝 Description:', result.description);
      console.log('🎯 Evidence:', result.evidence.substring(0, 100) + (result.evidence.length > 100 ? '...' : ''));
      
      return result;
    } catch (error) {
      console.error('❌ Failed to parse relationship analysis:', error);
      console.log('Raw analysis causing error:', analysis);
      return null;
    }
  }

  /**
   * 檢查兩個標題是否相似（改進的相似度檢查）
   */
  private isSimilarTitle(title1: string, title2: string): boolean {
    if (!title1 || !title2) return false;
    
    const normalize = (s: string) => s.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const t1 = normalize(title1);
    const t2 = normalize(title2);
    
    // 完全匹配
    if (t1 === t2) return true;
    
    // 包含檢查（考慮縮寫情況）
    if (t1.includes(t2) || t2.includes(t1)) {
      const shorter = Math.min(t1.length, t2.length);
      const longer = Math.max(t1.length, t2.length);
      // 如果較短的標題至少是較長標題的 60%，認為是匹配
      if (shorter / longer >= 0.6) return true;
    }
    
    // 單詞級別匹配（改進）
    const words1 = t1.split(' ').filter(w => w.length > 2);
    const words2 = t2.split(' ').filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) {
      // 如果單詞提取失敗，使用編輯距離
      const similarity = this.calculateSimilarity(t1, t2);
      return similarity > 0.75; // 降低閾值以提高召回率
    }
    
    // 計算共同單詞比例
    const commonWords = words1.filter(w => words2.includes(w));
    const wordSimilarity = commonWords.length / Math.min(words1.length, words2.length);
    
    // 如果單詞相似度 > 0.5，認為是匹配
    if (wordSimilarity > 0.5) return true;
    
    // 最後使用編輯距離作為備選
    const similarity = this.calculateSimilarity(t1, t2);
    return similarity > 0.75; // 降低閾值以提高召回率
  }

  /**
   * 計算字符串相似度
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * 計算編輯距離
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * 暫停執行
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
