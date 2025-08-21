/**
 * Deep Paper Relationship Analysis Service
 * 深度分析論文A如何論述論文B的服務
 * 
 * 改進點：
 * 1. 多層次上下文提取（段落、章節、語義塊）
 * 2. 結構化論文信息抽取（方法、貢獻、局限性）
 * 3. 論述邏輯推理（支持、反駁、擴展、比較）
 * 4. 關係證據強度評估
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { PaperMetadata, RelationshipEdge } from './PaperRelationshipAnalyzer';

export interface DeepPaperContext {
  // 基本信息
  id: string;
  title: string;
  authors: string[];
  year: string;
  abstract: string;
  venue?: string;
  citationCount?: number; // 新增：引用次數
  
  // 結構化內容
  structuredContent: {
    introduction: string;
    relatedWork: string;
    methodology: string;
    contributions: string[];
    limitations: string[];
    conclusions: string;
  };
  
  // 引用信息
  citationAnalysis: Array<{
    citedPaperId: string;
    citedTitle: string;
    
    // 多層次上下文
    sentenceContext: string;      // 引用句子
    paragraphContext: string;     // 引用段落
    sectionContext: string;       // 引用章節
    
    // 語義位置
    section: string;              // 所在章節
    position: 'early' | 'middle' | 'late';  // 章節內位置
    
    // 論述類型
    discourseFunction: 'background' | 'comparison' | 'support' | 'critique' | 'extension' | 'methodology';
    
    // 引用密度
    citationDensity: number;      // 該段落引用密度
    coOccurringCitations: string[]; // 同時出現的其他引用
  }>;
}

export interface DeepRelationshipEdge extends RelationshipEdge {
  // 詳細分析結果
  analysisDetails: {
    // 論述維度
    discourseDimensions: {
      methodological: { strength: number; description: string };
      theoretical: { strength: number; description: string };
      empirical: { strength: number; description: string };
      comparative: { strength: number; description: string };
    };
    
    // 引用模式
    citationPattern: {
      frequency: number;           // 引用頻率
      distribution: string;        // 引用分布（集中/分散）
      prominence: number;          // 引用顯著性
      context_diversity: number;   // 上下文多樣性
    };
    
    // 語義關係
    semanticRelation: {
      agreement: number;           // 同意程度 (-1 到 1)
      novelty: number;            // 新穎性貢獻 (0 到 1)
      dependency: number;         // 依賴程度 (0 到 1)
      complementarity: number;    // 互補性 (0 到 1)
    };
    
    // 關鍵證據
    keyEvidence: Array<{
      text: string;
      section: string;
      importance: number;
      evidenceType: 'direct_quote' | 'paraphrase' | 'comparison' | 'critique' | 'extension';
    }>;
  };
}

export class DeepPaperRelationshipAnalyzer {
  private llmUrl: string;
  private llmModel: string;

  constructor() {
    this.llmUrl = process.env.LOCAL_LLM_URL || 'http://localhost:8000';
    this.llmModel = process.env.LOCAL_LLM_MODEL || 'Qwen/Qwen3-4B-Instruct-2507';
  }

  /**
   * 測試 LLM 連接
   */
  async testLLMConnection(): Promise<boolean> {
    try {
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
    } catch (error) {
      console.error('LLM connection test failed:', error);
      return false;
    }
  }

  /**
   * 從GROBID TEI XML中提取深度結構化內容
   */
  async extractDeepStructuredContent(teiXml: string, paperMetadata: PaperMetadata): Promise<DeepPaperContext> {
    const $ = cheerio.load(teiXml, { xmlMode: true });
    
    // 基本信息提取
    const paperTitle = $('title[level="a"]').first().text().trim() || paperMetadata.title;
    const paperAuthors = paperMetadata.authors || [];
    
    // 結構化內容提取
    const structuredContent = {
      introduction: this.extractSectionContent($, ['introduction', 'intro']),
      relatedWork: this.extractSectionContent($, ['related work', 'background', 'literature review', 'prior work']),
      methodology: this.extractSectionContent($, ['method', 'approach', 'methodology', 'framework', 'model']),
      contributions: await this.extractContributions($),
      limitations: await this.extractLimitations($),
      conclusions: this.extractSectionContent($, ['conclusion', 'conclusions', 'summary'])
    };

    // 深度引用分析
    const citationAnalysis = await this.extractDeepCitationAnalysis($, paperMetadata.citations);
    
    console.log(`🔍 [DEEP ANALYZER DEBUG] Creating DeepPaperContext:`, {
      citationCount: paperMetadata.citationCount,
      citationCountType: typeof paperMetadata.citationCount,
      title: paperTitle?.substring(0, 50) + '...',
      venue: paperMetadata.venue
    });

    const deepContext = {
      id: paperMetadata.id,
      title: paperTitle,
      authors: paperAuthors,
      year: paperMetadata.year,
      abstract: paperMetadata.abstract || '',
      venue: paperMetadata.venue,
      citationCount: paperMetadata.citationCount, // 新增：引用次數
      structuredContent,
      citationAnalysis
    };
    
    console.log(`🔍 [DEEP ANALYZER DEBUG] Final DeepPaperContext citationCount:`, {
      citationCount: deepContext.citationCount,
      citationCountType: typeof deepContext.citationCount
    });
    
    return deepContext;
  }

  /**
   * 提取特定章節內容
   */
  private extractSectionContent($: cheerio.CheerioAPI, sectionKeywords: string[]): string {
    let content = '';
    
    // 嘗試多種章節匹配策略
    for (const keyword of sectionKeywords) {
      // 精確匹配
      const exactMatch = $(`div[type="section"] head`).filter((_, el) => {
        return $(el).text().trim().toLowerCase() === keyword.toLowerCase();
      });
      
      if (exactMatch.length > 0) {
        const section = exactMatch.first().parent();
        content = section.clone().children('head').remove().end().text().trim();
        if (content.length > 100) break; // 找到有效內容就停止
      }
      
      // 模糊匹配
      if (!content) {
        const fuzzyMatch = $(`div[type="section"] head`).filter((_, el) => {
          return $(el).text().trim().toLowerCase().includes(keyword.toLowerCase());
        });
        
        if (fuzzyMatch.length > 0) {
          const section = fuzzyMatch.first().parent();
          content = section.clone().children('head').remove().end().text().trim();
          if (content.length > 100) break;
        }
      }
    }
    
    return content;
  }

  /**
   * 使用LLM提取論文貢獻
   */
  private async extractContributions($: cheerio.CheerioAPI): Promise<string[]> {
    // 從多個可能的章節提取貢獻相關內容
    const candidateSections = [
      this.extractSectionContent($, ['contribution', 'contributions']),
      this.extractSectionContent($, ['introduction', 'intro']),
      this.extractSectionContent($, ['abstract']),
      this.extractSectionContent($, ['conclusion', 'conclusions'])
    ].filter(text => text.length > 50);

    if (candidateSections.length === 0) return [];

    try {
      const prompt = `
Extract the main contributions of this research paper from the following sections:

${candidateSections.map((text, i) => `**Section ${i + 1}:**\n${text.substring(0, 1000)}`).join('\n\n')}

Please list 3-5 main contributions in the following JSON format:
{
  "contributions": [
    "First main contribution...",
    "Second main contribution...",
    ...
  ]
}

Focus on novel methods, theoretical insights, empirical findings, or practical applications.`;

      const response = await this.callLLMWithRetry([
        {
          role: 'system',
          content: 'You are an expert academic researcher. Extract key contributions from research papers accurately and concisely.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      const result = this.parseJsonResponse(response.data.choices[0].message.content);
      return result?.contributions || [];
      
    } catch (error) {
      console.error('Failed to extract contributions:', error);
      return [];
    }
  }

  /**
   * 使用LLM提取論文局限性
   */
  private async extractLimitations($: cheerio.CheerioAPI): Promise<string[]> {
    const candidateSections = [
      this.extractSectionContent($, ['limitation', 'limitations']),
      this.extractSectionContent($, ['discussion']),
      this.extractSectionContent($, ['conclusion', 'conclusions']),
      this.extractSectionContent($, ['future work', 'future research'])
    ].filter(text => text.length > 50);

    if (candidateSections.length === 0) return [];

    try {
      const prompt = `
Identify the limitations, challenges, or areas for improvement mentioned in this research paper:

${candidateSections.map((text, i) => `**Section ${i + 1}:**\n${text.substring(0, 1000)}`).join('\n\n')}

Please list the main limitations in the following JSON format:
{
  "limitations": [
    "First limitation...",
    "Second limitation...",
    ...
  ]
}

Focus on methodological limitations, dataset constraints, scope restrictions, or acknowledged weaknesses.`;

      const response = await this.callLLMWithRetry([
        {
          role: 'system',
          content: 'You are an expert academic researcher. Identify research limitations accurately and objectively.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      const result = this.parseJsonResponse(response.data.choices[0].message.content);
      return result?.limitations || [];
      
    } catch (error) {
      console.error('Failed to extract limitations:', error);
      return [];
    }
  }

  /**
   * 深度引用分析
   */
  private async extractDeepCitationAnalysis(
    $: cheerio.CheerioAPI,
    citations: PaperMetadata['citations']
  ): Promise<DeepPaperContext['citationAnalysis']> {
    const analysisResults: DeepPaperContext['citationAnalysis'] = [];

    for (const citation of citations) {
      // 找到引用位置
      const citationRefs = $(`ref[target="#${citation.id}"]`);
      
      for (let i = 0; i < citationRefs.length; i++) {
        const $ref = citationRefs.eq(i);
        
        // 多層次上下文提取
        const sentenceContext = this.extractSentenceContext($ref);
        const paragraphContext = this.extractParagraphContext($ref);
        const sectionContext = this.extractSectionContext($ref);
        
        // 語義位置分析
        const section = this.getContainingSection($ref);
        const position = this.analyzePositionInSection($ref);
        
        // 論述功能分析
        const discourseFunction = await this.analyzeDiscourseFunction(
          sentenceContext,
          paragraphContext,
          citation.title || ''
        );
        
        // 引用密度計算
        const citationDensity = this.calculateCitationDensity($ref);
        const coOccurringCitations = this.findCoOccurringCitations($ref);

        analysisResults.push({
          citedPaperId: citation.id,
          citedTitle: citation.title || 'Unknown',
          sentenceContext,
          paragraphContext,
          sectionContext,
          section,
          position,
          discourseFunction,
          citationDensity,
          coOccurringCitations
        });
      }
    }

    return analysisResults;
  }

  /**
   * 提取句子級上下文
   */
  private extractSentenceContext($ref: cheerio.Cheerio<any>): string {
    const sentence = $ref.closest('s');
    if (sentence.length > 0) {
      return sentence.text().trim();
    }
    
    // 備用：找到包含引用的完整句子
    const paragraph = $ref.closest('p');
    const fullText = paragraph.text();
    const refText = $ref.text();
    const refIndex = fullText.indexOf(refText);
    
    if (refIndex !== -1) {
      // 找到句子邊界
      const beforeText = fullText.substring(0, refIndex);
      const afterText = fullText.substring(refIndex + refText.length);
      
      const sentenceStart = Math.max(
        beforeText.lastIndexOf('. ') + 2,
        beforeText.lastIndexOf('! ') + 2,
        beforeText.lastIndexOf('? ') + 2,
        0
      );
      
      const sentenceEnd = Math.min(
        afterText.indexOf('. ') !== -1 ? refIndex + refText.length + afterText.indexOf('. ') + 1 : fullText.length,
        afterText.indexOf('! ') !== -1 ? refIndex + refText.length + afterText.indexOf('! ') + 1 : fullText.length,
        afterText.indexOf('? ') !== -1 ? refIndex + refText.length + afterText.indexOf('? ') + 1 : fullText.length
      );
      
      return fullText.substring(sentenceStart, sentenceEnd).trim();
    }
    
    return $ref.text();
  }

  /**
   * 提取段落級上下文
   */
  private extractParagraphContext($ref: cheerio.Cheerio<any>): string {
    const paragraph = $ref.closest('p');
    return paragraph.text().trim();
  }

  /**
   * 提取章節級上下文
   */
  private extractSectionContext($ref: cheerio.Cheerio<any>): string {
    const section = $ref.closest('div[type="section"]');
    return section.text().trim().substring(0, 2000); // 限制長度
  }

  /**
   * 獲取包含章節名稱
   */
  private getContainingSection($ref: cheerio.Cheerio<any>): string {
    const section = $ref.closest('div[type="section"]');
    const head = section.find('head').first();
    return head.text().trim() || 'Unknown Section';
  }

  /**
   * 分析在章節中的位置
   */
  private analyzePositionInSection($ref: cheerio.Cheerio<any>): 'early' | 'middle' | 'late' {
    const section = $ref.closest('div[type="section"]');
    const allParagraphs = section.find('p');
    const currentParagraph = $ref.closest('p');
    
    const paragraphIndex = allParagraphs.index(currentParagraph);
    const totalParagraphs = allParagraphs.length;
    
    if (paragraphIndex < totalParagraphs * 0.3) return 'early';
    if (paragraphIndex > totalParagraphs * 0.7) return 'late';
    return 'middle';
  }

  /**
   * 使用LLM分析論述功能
   */
  private async analyzeDiscourseFunction(
    sentence: string,
    paragraph: string,
    citedTitle: string
  ): Promise<DeepPaperContext['citationAnalysis'][0]['discourseFunction']> {
    try {
      const prompt = `
Analyze the discourse function of this citation in academic writing:

**Cited Paper**: ${citedTitle}

**Citation Sentence**: ${sentence}

**Paragraph Context**: ${paragraph.substring(0, 500)}

Determine the primary discourse function from these categories:
- background: Providing background/context information
- comparison: Comparing with current work
- support: Supporting current claims/arguments
- critique: Criticizing or identifying limitations
- extension: Extending or building upon the cited work
- methodology: Referencing methods or techniques

Respond with only the category name (e.g., "support", "comparison", etc.).`;

      const response = await this.callLLMWithRetry([
        {
          role: 'system',
          content: 'You are an expert in academic discourse analysis. Classify citation functions accurately based on context.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      const result = response.data.choices[0].message.content.trim().toLowerCase();
      const validFunctions: DeepPaperContext['citationAnalysis'][0]['discourseFunction'][] = 
        ['background', 'comparison', 'support', 'critique', 'extension', 'methodology'];
      
      return validFunctions.find(fn => result.includes(fn)) || 'background';
      
    } catch (error) {
      console.error('Failed to analyze discourse function:', error);
      return 'background';
    }
  }

  /**
   * 計算引用密度
   */
  private calculateCitationDensity($ref: cheerio.Cheerio<any>): number {
    const paragraph = $ref.closest('p');
    const citations = paragraph.find('ref[type="bibr"]');
    const words = paragraph.text().split(/\s+/).length;
    
    return citations.length / Math.max(words, 1) * 100; // 每100詞的引用數
  }

  /**
   * 找到同時出現的其他引用
   */
  private findCoOccurringCitations($ref: cheerio.Cheerio<any>): string[] {
    const paragraph = $ref.closest('p');
    const otherCitations = paragraph.find('ref[type="bibr"]');
    const currentTarget = $ref.attr('target');
    
    const coOccurring: string[] = [];
    otherCitations.each((_, el) => {
      const cheerioEl = paragraph.find(el);
      const target = cheerioEl.attr('target');
      if (target && target !== currentTarget) {
        coOccurring.push(target.substring(1)); // 移除 # 符號
      }
    });
    
    return [...new Set(coOccurring)]; // 去重
  }

  /**
   * 深度關係分析
   */
  async analyzeDeepRelationship(
    sourcePaper: DeepPaperContext,
    targetPaper: DeepPaperContext
  ): Promise<DeepRelationshipEdge | null> {
    // 找到相關的引用分析
    const relevantCitations = sourcePaper.citationAnalysis.filter(
      citation => citation.citedPaperId === targetPaper.id || 
                  this.isSimilarTitle(citation.citedTitle, targetPaper.title)
    );

    if (relevantCitations.length === 0) {
      return null;
    }

    try {
      // 構建深度分析提示
      const analysisPrompt = this.buildDeepAnalysisPrompt(
        sourcePaper, 
        targetPaper, 
        relevantCitations
      );

      const response = await this.callLLMWithRetry([
        {
          role: 'system',
          content: `You are an expert academic analyst specializing in scholarly discourse and citation analysis. 
          Your task is to perform deep relationship analysis between academic papers, considering methodological, 
          theoretical, empirical, and comparative dimensions.`
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ]);

      const analysis = response.data.choices[0].message.content;
      return this.parseDeepAnalysisResult(analysis, sourcePaper, targetPaper, relevantCitations);

    } catch (error) {
      console.error('Deep relationship analysis failed:', error);
      return null;
    }
  }

  /**
   * 構建深度分析提示
   */
  private buildDeepAnalysisPrompt(
    sourcePaper: DeepPaperContext,
    targetPaper: DeepPaperContext,
    citations: DeepPaperContext['citationAnalysis']
  ): string {
    return `
Perform deep relationship analysis between two academic papers:

**Source Paper**: "${sourcePaper.title}" (${sourcePaper.year})
- Authors: ${sourcePaper.authors.join(', ')}
- Abstract: ${sourcePaper.abstract.substring(0, 300)}...
- Main Contributions: ${sourcePaper.structuredContent.contributions.join('; ')}
- Limitations: ${sourcePaper.structuredContent.limitations.join('; ')}

**Target Paper**: "${targetPaper.title}" (${targetPaper.year})
- Authors: ${targetPaper.authors.join(', ')}
- Abstract: ${targetPaper.abstract.substring(0, 300)}...

**Citation Analysis**:
${citations.map((c, i) => `
Citation ${i + 1}:
- Section: ${c.section}
- Position: ${c.position}
- Function: ${c.discourseFunction}
- Sentence: "${c.sentenceContext}"
- Paragraph Context: "${c.paragraphContext.substring(0, 200)}..."
- Co-occurring Citations: ${c.coOccurringCitations.join(', ') || 'None'}
`).join('\n')}

**Analysis Required**:
Provide a comprehensive JSON analysis with the following structure:

{
  "relationship_type": "builds_on|extends|applies|compares|surveys|critiques",
  "strength": 0.0-1.0,
  "evidence": "Brief description of key evidence",
  "description": "Detailed relationship description",
  
  "discourse_dimensions": {
    "methodological": {"strength": 0.0-1.0, "description": "How methodologically related"},
    "theoretical": {"strength": 0.0-1.0, "description": "How theoretically related"},
    "empirical": {"strength": 0.0-1.0, "description": "How empirically related"},
    "comparative": {"strength": 0.0-1.0, "description": "How comparative analysis is done"}
  },
  
  "citation_pattern": {
    "frequency": ${citations.length},
    "distribution": "concentrated|distributed",
    "prominence": 0.0-1.0,
    "context_diversity": 0.0-1.0
  },
  
  "semantic_relation": {
    "agreement": -1.0-1.0,
    "novelty": 0.0-1.0,
    "dependency": 0.0-1.0,
    "complementarity": 0.0-1.0
  },
  
  "key_evidence": [
    {
      "text": "Important quote or paraphrase",
      "section": "Section name",
      "importance": 0.0-1.0,
      "evidence_type": "direct_quote|paraphrase|comparison|critique|extension"
    }
  ]
}

Focus on providing accurate numerical assessments and detailed qualitative descriptions.`;
  }

  /**
   * 解析深度分析結果
   */
  private parseDeepAnalysisResult(
    analysis: string,
    sourcePaper: DeepPaperContext,
    targetPaper: DeepPaperContext,
    citations: DeepPaperContext['citationAnalysis']
  ): DeepRelationshipEdge | null {
    try {
      const result = this.parseJsonResponse(analysis);
      if (!result) return null;

      const basicEdge: RelationshipEdge = {
        source: sourcePaper.id,
        target: targetPaper.id,
        relationship: result.relationship_type || 'builds_on',
        strength: result.strength || 0.5,
        evidence: result.evidence || 'Citation analysis',
        description: result.description || `${sourcePaper.title} cites ${targetPaper.title}`
      };

      const deepEdge: DeepRelationshipEdge = {
        ...basicEdge,
        analysisDetails: {
          discourseDimensions: result.discourse_dimensions || {
            methodological: { strength: 0.5, description: 'Unknown' },
            theoretical: { strength: 0.5, description: 'Unknown' },
            empirical: { strength: 0.5, description: 'Unknown' },
            comparative: { strength: 0.5, description: 'Unknown' }
          },
          citationPattern: result.citation_pattern || {
            frequency: citations.length,
            distribution: 'distributed',
            prominence: 0.5,
            context_diversity: 0.5
          },
          semanticRelation: result.semantic_relation || {
            agreement: 0.5,
            novelty: 0.5,
            dependency: 0.5,
            complementarity: 0.5
          },
          keyEvidence: result.key_evidence || []
        }
      };

      return deepEdge;

    } catch (error) {
      console.error('Failed to parse deep analysis result:', error);
      return null;
    }
  }

  // 輔助方法
  private async callLLMWithRetry(
    messages: Array<{role: string, content: string}>,
    maxRetries: number = 2
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await axios.post(`${this.llmUrl}/v1/chat/completions`, {
          model: this.llmModel,
          messages,
          max_tokens: 2000,
          temperature: 0.1 // 較低溫度確保一致性
        }, {
          timeout: 60000 // 增加超時時間
        });

        if (response.status === 200 && response.data?.choices?.length > 0) {
          return response;
        }
        
        throw new Error(`LLM returned invalid response: ${response.status}`);
      } catch (error) {
        console.warn(`LLM call attempt ${attempt}/${maxRetries + 1} failed:`, error instanceof Error ? error.message : error);
        
        if (attempt <= maxRetries) {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          console.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private parseJsonResponse(text: string): any {
    try {
      // 嘗試提取JSON部分
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      return null;
    }
  }

  private isSimilarTitle(title1: string, title2: string): boolean {
    const normalize = (str: string) => str.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const normalized1 = normalize(title1);
    const normalized2 = normalize(title2);
    
    // 簡單的相似度檢查
    const words1 = normalized1.split(' ');
    const words2 = normalized2.split(' ');
    
    const intersection = words1.filter(word => 
      word.length > 3 && words2.includes(word)
    );
    
    return intersection.length >= Math.min(words1.length, words2.length) * 0.5;
  }
}
