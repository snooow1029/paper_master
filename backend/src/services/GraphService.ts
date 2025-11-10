import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { Paper } from '../entities/Paper';
import { PaperRelation } from '../entities/PaperRelation';
import { AppDataSource } from '../config/database';

interface GraphNode {
  id: string;
  label: string;
  title: string;
  authors: string[];
  abstract: string;
  introduction: string;
  url: string;
  tags: string[];
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  description: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class GraphService {
  private genAI: GoogleGenerativeAI | null;
  private llmType: string;
  private localLlmUrl: string;
  private localLlmModel: string;
  private geminiModel: string;
  private relationRepository = AppDataSource.getRepository(PaperRelation);

  constructor() {
    this.llmType = process.env.LLM_TYPE || 'disabled';
    this.localLlmUrl = process.env.LOCAL_LLM_URL || 'http://localhost:8000';
    this.localLlmModel = process.env.LOCAL_LLM_MODEL || 'meta-llama/Llama-2-7b-chat-hf';
    this.geminiModel = process.env.GEMINI_MODEL || 'gemini-pro';
    
    if (this.llmType === 'gemini' || this.llmType === 'openai') {
      const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
      if (apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey !== 'your_openai_api_key_here') {
        this.genAI = new GoogleGenerativeAI(apiKey);
        console.log(`Using Google Gemini API (${this.geminiModel}) for relationship analysis`);
      } else {
        this.genAI = null;
        console.warn('Gemini API key not configured. Falling back to basic analysis.');
      }
    } else if (this.llmType === 'local') {
      this.genAI = null;
      console.log(`Using local LLM at ${this.localLlmUrl} with model ${this.localLlmModel}`);
    } else {
      this.genAI = null;
      console.log('LLM disabled. Using basic keyword-based analysis.');
    }
  }

  async generateRelations(papers: Paper[]): Promise<PaperRelation[]> {
    const relations: PaperRelation[] = [];

    // Generate relations between all pairs of papers
    for (let i = 0; i < papers.length; i++) {
      for (let j = i + 1; j < papers.length; j++) {
        const paperA = papers[i];
        const paperB = papers[j];

        try {
          const relation = await this.analyzeRelationship(paperA, paperB);
          if (relation) {
            const savedRelation = await this.relationRepository.save(relation);
            relations.push(savedRelation);
          }
        } catch (error) {
          console.error(`Error analyzing relationship between papers ${paperA.id} and ${paperB.id}:`, error);
        }
      }
    }

    return relations;
  }

  private async analyzeRelationship(paperA: Paper, paperB: Paper): Promise<Partial<PaperRelation> | null> {
    try {
      if ((this.llmType === 'gemini' || this.llmType === 'openai') && this.genAI) {
        return await this.analyzeWithGemini(paperA, paperB);
      } else if (this.llmType === 'local') {
        return await this.analyzeWithLocalLLM(paperA, paperB);
      } else {
        return this.createBasicRelationship(paperA, paperB);
      }
    } catch (error) {
      console.error('Error in relationship analysis:', error);
      // Fallback to basic relationship
      return this.createBasicRelationship(paperA, paperB);
    }
  }

  private async analyzeWithGemini(paperA: Paper, paperB: Paper): Promise<Partial<PaperRelation> | null> {
    const prompt = this.createAnalysisPrompt(paperA, paperB);

    const model = this.genAI!.getGenerativeModel({ 
      model: this.geminiModel,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
      },
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    if (!content) {
      return null;
    }

    return this.parseAnalysisResult(content, paperA, paperB);
  }

  private async analyzeWithLocalLLM(paperA: Paper, paperB: Paper): Promise<Partial<PaperRelation> | null> {
    try {
      const prompt = this.createAnalysisPrompt(paperA, paperB);

      // 使用 VLLM 的 OpenAI 兼容 API
      const response = await axios.post(`${this.localLlmUrl}/v1/chat/completions`, {
        model: this.localLlmModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert academic researcher analyzing relationships between research papers. Always respond with valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout
      });

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        console.warn('No content received from local LLM');
        return this.createBasicRelationship(paperA, paperB);
      }

      return this.parseAnalysisResult(content, paperA, paperB);
    } catch (error) {
      console.error('Error calling local LLM:', error);
      // Fallback to basic analysis
      return this.createBasicRelationship(paperA, paperB);
    }
  }

  private createAnalysisPrompt(paperA: Paper, paperB: Paper): string {
    return `
Analyze the relationship between these two academic papers and determine if there's a connection:

Paper A:
Title: ${paperA.title}
Authors: ${paperA.authors.join(', ')}
Abstract: ${paperA.abstract}

Paper B:
Title: ${paperB.title}
Authors: ${paperB.authors.join(', ')}
Abstract: ${paperB.abstract}

Please analyze if these papers have any of the following relationships:
1. Citation relationship (one cites the other)
2. Methodological relationship (same or similar methods)
3. Theoretical foundation (builds upon same theory)
4. Problem domain (addresses similar problems)
5. Temporal progression (later work builds on earlier)

If there is a relationship, provide:
1. Relationship type (one of the above)
2. Brief description (1-2 sentences)
3. Confidence score (0.0-1.0)
4. Direction (A->B, B->A, or bidirectional)

Respond in JSON format:
{
  "hasRelationship": boolean,
  "relationship": "string",
  "description": "string",
  "confidence": number,
  "direction": "A->B" | "B->A" | "bidirectional"
}

If no significant relationship exists, set hasRelationship to false.
`;
  }

  private parseAnalysisResult(content: string, paperA: Paper, paperB: Paper): Partial<PaperRelation> | null {
    try {
      // 嘗試從回應中提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      const analysis = JSON.parse(jsonStr);
      
      if (!analysis.hasRelationship) {
        return null;
      }

      const relation: Partial<PaperRelation> = {
        fromPaper: analysis.direction === 'B->A' ? paperB : paperA,
        toPaper: analysis.direction === 'B->A' ? paperA : paperB,
        relationship: analysis.relationship,
        description: analysis.description,
        confidence: analysis.confidence,
        weight: Math.max(1, Math.round(analysis.confidence * 10)),
      };

      return relation;
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      console.error('Raw content:', content);
      return this.createBasicRelationship(paperA, paperB);
    }
  }

  private createBasicRelationship(paperA: Paper, paperB: Paper): Partial<PaperRelation> | null {
    // Simple keyword-based relationship detection
    const wordsA = this.extractKeywords(paperA.title + ' ' + paperA.abstract);
    const wordsB = this.extractKeywords(paperB.title + ' ' + paperB.abstract);
    
    const commonWords = wordsA.filter(word => wordsB.includes(word));
    const similarity = commonWords.length / Math.max(wordsA.length, wordsB.length);
    
    if (similarity > 0.1) { // Threshold for relationship
      return {
        fromPaper: paperA,
        toPaper: paperB,
        relationship: 'domain',
        description: `These papers share common themes: ${commonWords.slice(0, 3).join(', ')}`,
        confidence: similarity,
        weight: Math.max(1, Math.round(similarity * 10)),
      };
    }
    
    return null;
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'were', 'are'].includes(word));
  }

  async convertToGraphData(papers: Paper[], relations: PaperRelation[]): Promise<GraphData> {
    const nodes: GraphNode[] = papers.map(paper => ({
      id: paper.id,
      label: this.truncateText(paper.title, 50),
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      introduction: paper.introduction || '',
      url: paper.url,
      tags: paper.tags,
    }));

    const edges: GraphEdge[] = relations.map(relation => ({
      id: relation.id,
      from: relation.fromPaper.id,
      to: relation.toPaper.id,
      label: relation.relationship,
      description: relation.description,
      weight: relation.weight,
    }));

    return { nodes, edges };
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}
