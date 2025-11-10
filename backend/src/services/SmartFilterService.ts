/**
 * Smart Filter Service
 * 智能过滤服务 - 在调用 LLM 之前快速筛选可能有关系的论文对
 * 减少不必要的 LLM 调用，提高分析效率
 */

import { PaperMetadata } from './PaperRelationshipAnalyzer';

export interface FilterResult {
  shouldAnalyze: boolean;
  confidence: number; // 0.0-1.0，表示这个论文对值得分析的可能性
  reasons: string[]; // 过滤原因
}

export class SmartFilterService {
  // 配置参数
  private readonly MIN_CONFIDENCE = 0.3; // 最低置信度阈值
  private readonly KEYWORD_WEIGHT = 0.4; // 关键词匹配权重
  private readonly AUTHOR_WEIGHT = 0.3; // 作者匹配权重
  private readonly YEAR_WEIGHT = 0.1; // 年份相关性权重
  private readonly CITATION_WEIGHT = 0.2; // 引用关系权重

  /**
   * 智能过滤论文对
   * 返回是否应该进行深度 LLM 分析
   */
  filterPaperPair(
    sourcePaper: PaperMetadata,
    targetPaper: PaperMetadata
  ): FilterResult {
    const reasons: string[] = [];
    let confidence = 0;

    // 1. 检查直接引用关系（最高优先级）
    const citationMatch = this.checkCitationMatch(sourcePaper, targetPaper);
    if (citationMatch.found) {
      confidence += this.CITATION_WEIGHT;
      reasons.push(`Direct citation found: ${citationMatch.reason}`);
    }

    // 2. 关键词相似度分析
    const keywordScore = this.calculateKeywordSimilarity(
      sourcePaper,
      targetPaper
    );
    if (keywordScore > 0.2) {
      confidence += keywordScore * this.KEYWORD_WEIGHT;
      reasons.push(`Keyword similarity: ${(keywordScore * 100).toFixed(1)}%`);
    }

    // 3. 作者重叠检查
    const authorOverlap = this.calculateAuthorOverlap(
      sourcePaper.authors || [],
      targetPaper.authors || []
    );
    if (authorOverlap > 0) {
      confidence += Math.min(authorOverlap, 0.5) * this.AUTHOR_WEIGHT;
      reasons.push(`Author overlap: ${authorOverlap} common author(s)`);
    }

    // 4. 年份相关性（同一时期的研究更可能相关）
    const yearRelevance = this.calculateYearRelevance(
      sourcePaper.year,
      targetPaper.year
    );
    if (yearRelevance > 0.3) {
      confidence += yearRelevance * this.YEAR_WEIGHT;
      reasons.push(`Year relevance: ${(yearRelevance * 100).toFixed(1)}%`);
    }

    // 5. 标题相似度（快速检查）
    const titleSimilarity = this.calculateTitleSimilarity(
      sourcePaper.title,
      targetPaper.title
    );
    if (titleSimilarity > 0.5) {
      confidence += (titleSimilarity - 0.5) * 0.2; // 额外加分
      reasons.push(`Title similarity: ${(titleSimilarity * 100).toFixed(1)}%`);
    }

    // 6. 摘要关键词匹配
    const abstractMatch = this.checkAbstractKeywords(
      sourcePaper.abstract || '',
      targetPaper.abstract || ''
    );
    if (abstractMatch > 0.2) {
      confidence += abstractMatch * 0.15;
      reasons.push(`Abstract keyword match: ${(abstractMatch * 100).toFixed(1)}%`);
    }

    // 归一化置信度到 0-1
    confidence = Math.min(confidence, 1.0);

    return {
      shouldAnalyze: confidence >= this.MIN_CONFIDENCE,
      confidence,
      reasons: reasons.length > 0 ? reasons : ['No significant indicators found']
    };
  }

  /**
   * 检查直接引用关系
   */
  private checkCitationMatch(
    sourcePaper: PaperMetadata,
    targetPaper: PaperMetadata
  ): { found: boolean; reason: string } {
    if (!sourcePaper.citations || sourcePaper.citations.length === 0) {
      return { found: false, reason: '' };
    }

    // 检查 sourcePaper 是否引用了 targetPaper
    for (const citation of sourcePaper.citations) {
      if (this.isSimilarTitle(citation.title || '', targetPaper.title)) {
        return {
          found: true,
          reason: `Source cites target: "${citation.title}"`
        };
      }
    }

    return { found: false, reason: '' };
  }

  /**
   * 计算关键词相似度
   */
  private calculateKeywordSimilarity(
    paperA: PaperMetadata,
    paperB: PaperMetadata
  ): number {
    const keywordsA = this.extractKeywords(paperA.title + ' ' + (paperA.abstract || ''));
    const keywordsB = this.extractKeywords(paperB.title + ' ' + (paperB.abstract || ''));

    if (keywordsA.length === 0 || keywordsB.length === 0) {
      return 0;
    }

    // 计算交集
    const intersection = keywordsA.filter(word => keywordsB.includes(word));
    const union = new Set([...keywordsA, ...keywordsB]);

    // Jaccard 相似度
    return intersection.length / union.size;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
  }

  /**
   * 停用词列表
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'were',
      'are', 'the', 'and', 'for', 'not', 'but', 'can', 'may', 'more', 'most',
      'some', 'such', 'than', 'their', 'these', 'those', 'what', 'which',
      'when', 'where', 'while', 'would', 'could', 'should', 'about', 'after',
      'before', 'during', 'through', 'under', 'until', 'upon', 'within'
    ]);
    return stopWords.has(word);
  }

  /**
   * 计算作者重叠
   */
  private calculateAuthorOverlap(
    authorsA: string[],
    authorsB: string[]
  ): number {
    if (authorsA.length === 0 || authorsB.length === 0) {
      return 0;
    }

    // 标准化作者名称（小写，移除多余空格）
    const normalize = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedA = authorsA.map(normalize);
    const normalizedB = authorsB.map(normalize);

    // 计算重叠
    const overlap = normalizedA.filter(a => normalizedB.includes(a)).length;
    
    // 返回重叠比例（相对于较小的作者列表）
    return overlap / Math.min(normalizedA.length, normalizedB.length);
  }

  /**
   * 计算年份相关性
   */
  private calculateYearRelevance(yearA: string, yearB: string): number {
    const parseYear = (year: string): number | null => {
      const match = year.match(/\d{4}/);
      return match ? parseInt(match[0]) : null;
    };

    const y1 = parseYear(yearA);
    const y2 = parseYear(yearB);

    if (y1 === null || y2 === null) {
      return 0.5; // 未知年份，给中等相关性
    }

    const diff = Math.abs(y1 - y2);
    
    // 年份差距越小，相关性越高
    if (diff === 0) return 1.0;
    if (diff <= 1) return 0.8;
    if (diff <= 2) return 0.6;
    if (diff <= 5) return 0.4;
    if (diff <= 10) return 0.2;
    return 0.1;
  }

  /**
   * 计算标题相似度
   */
  private calculateTitleSimilarity(titleA: string, titleB: string): number {
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const t1 = normalize(titleA);
    const t2 = normalize(titleB);

    // 完全匹配
    if (t1 === t2) return 1.0;

    // 包含关系
    if (t1.includes(t2) || t2.includes(t1)) {
      const shorter = Math.min(t1.length, t2.length);
      const longer = Math.max(t1.length, t2.length);
      return shorter / longer;
    }

    // 编辑距离相似度
    const distance = this.levenshteinDistance(t1, t2);
    const maxLen = Math.max(t1.length, t2.length);
    return maxLen > 0 ? 1 - (distance / maxLen) : 0;
  }

  /**
   * 检查摘要关键词匹配
   */
  private checkAbstractKeywords(abstractA: string, abstractB: string): number {
    if (!abstractA || !abstractB) return 0;

    const keywordsA = this.extractKeywords(abstractA);
    const keywordsB = this.extractKeywords(abstractB);

    if (keywordsA.length === 0 || keywordsB.length === 0) {
      return 0;
    }

    const intersection = keywordsA.filter(word => keywordsB.includes(word));
    return intersection.length / Math.max(keywordsA.length, keywordsB.length);
  }

  /**
   * 改进的标题相似度检查（用于引用匹配）
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

    // 包含关系（考虑缩写情况）
    if (t1.includes(t2) || t2.includes(t1)) {
      const shorter = Math.min(t1.length, t2.length);
      const longer = Math.max(t1.length, t2.length);
      // 如果较短的标题至少是较长标题的 60%，认为是匹配
      return shorter / longer >= 0.6;
    }

    // 单词级别匹配
    const words1 = t1.split(' ').filter(w => w.length > 3);
    const words2 = t2.split(' ').filter(w => w.length > 3);

    if (words1.length === 0 || words2.length === 0) {
      return false;
    }

    // 计算共同单词比例
    const commonWords = words1.filter(w => words2.includes(w));
    const similarity = commonWords.length / Math.min(words1.length, words2.length);

    // 如果相似度 > 0.5，认为是匹配
    return similarity > 0.5;
  }

  /**
   * 计算编辑距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // 初始化矩阵
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // 填充矩阵
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,     // 删除
            matrix[i][j - 1] + 1,      // 插入
            matrix[i - 1][j - 1] + 1  // 替换
          );
        }
      }
    }

    return matrix[len2][len1];
  }

  /**
   * 批量过滤论文对
   * 返回需要分析的论文对列表
   */
  filterPaperPairs(
    papers: PaperMetadata[]
  ): Array<{ source: PaperMetadata; target: PaperMetadata; confidence: number }> {
    const filteredPairs: Array<{
      source: PaperMetadata;
      target: PaperMetadata;
      confidence: number;
    }> = [];

    console.log(`\n🔍 Smart Filtering: Analyzing ${papers.length} papers...`);
    let totalPairs = 0;
    let filteredCount = 0;

    for (let i = 0; i < papers.length; i++) {
      for (let j = i + 1; j < papers.length; j++) {
        totalPairs++;
        const result = this.filterPaperPair(papers[i], papers[j]);

        if (result.shouldAnalyze) {
          filteredPairs.push({
            source: papers[i],
            target: papers[j],
            confidence: result.confidence
          });
          filteredCount++;
        }
      }
    }

    console.log(`✅ Smart Filter Results:`);
    console.log(`   Total pairs: ${totalPairs}`);
    console.log(`   Filtered pairs: ${filteredPairs.length} (${((filteredPairs.length / totalPairs) * 100).toFixed(1)}%)`);
    console.log(`   Reduction: ${((1 - filteredPairs.length / totalPairs) * 100).toFixed(1)}%`);

    // 按置信度排序
    filteredPairs.sort((a, b) => b.confidence - a.confidence);

    return filteredPairs;
  }
}

