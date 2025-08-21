/**
 * Mock Citation Service for testing citation network functionality
 * This provides fake but realistic citation data to avoid API rate limits during development
 */

import { Paper } from '../entities/Paper';

export class MockCitationService {
  private static mockCitationDatabase: { [key: string]: Partial<Paper>[] } = {
    // Mock citations for Transformer paper (Attention is All You Need)
    'attention is all you need': [
      {
        title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
        authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee', 'Kristina Toutanova'],
        abstract: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers.',
        url: 'https://arxiv.org/abs/1810.04805',
        arxivId: '1810.04805',
        publishedDate: '2018',
        tags: ['Mock', 'NLP', 'Transformer'],
        introduction: ''
      },
      {
        title: 'GPT-2: Language Models are Unsupervised Multitask Learners',
        authors: ['Alec Radford', 'Jeffrey Wu', 'Rewon Child', 'David Luan'],
        abstract: 'Natural language processing tasks, such as question answering, machine translation, reading comprehension, and summarization.',
        url: 'https://d4mucfpksywv.cloudfront.net/better-language-models/language_models_are_unsupervised_multitask_learners.pdf',
        publishedDate: '2019',
        tags: ['Mock', 'NLP', 'Language Model'],
        introduction: ''
      },
      {
        title: 'T5: Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer',
        authors: ['Colin Raffel', 'Noam Shazeer', 'Adam Roberts', 'Katherine Lee'],
        abstract: 'We explore the landscape of transfer learning techniques for NLP by introducing a unified framework.',
        url: 'https://arxiv.org/abs/1910.10683',
        arxivId: '1910.10683',
        publishedDate: '2019',
        tags: ['Mock', 'NLP', 'Transfer Learning'],
        introduction: ''
      }
    ],

    // Mock citations for BERT paper
    'bert: pre-training of deep bidirectional transformers for language understanding': [
      {
        title: 'RoBERTa: A Robustly Optimized BERT Pretraining Approach',
        authors: ['Yinhan Liu', 'Myle Ott', 'Naman Goyal', 'Jingfei Du'],
        abstract: 'Language model pretraining has led to significant performance gains but careful comparison between different approaches is challenging.',
        url: 'https://arxiv.org/abs/1907.11692',
        arxivId: '1907.11692',
        publishedDate: '2019',
        tags: ['Mock', 'NLP', 'BERT Variant'],
        introduction: ''
      },
      {
        title: 'ALBERT: A Lite BERT for Self-supervised Learning of Language Representations',
        authors: ['Zhenzhong Lan', 'Mingda Chen', 'Sebastian Goodman', 'Kevin Gimpel'],
        abstract: 'Increasing model size when pretraining natural language representations often results in improved performance.',
        url: 'https://arxiv.org/abs/1909.11942',
        arxivId: '1909.11942',
        publishedDate: '2019',
        tags: ['Mock', 'NLP', 'BERT Variant'],
        introduction: ''
      }
    ],

    // Mock citations for general transformer/NLP papers
    'default': [
      {
        title: 'The Annotated Transformer',
        authors: ['Alexander Rush'],
        abstract: 'The Transformer from "Attention is All You Need" has been on a lot of people\'s minds over the last year.',
        url: 'http://nlp.seas.harvard.edu/2018/04/03/attention.html',
        publishedDate: '2018',
        tags: ['Mock', 'Tutorial', 'Transformer'],
        introduction: ''
      },
      {
        title: 'Transformers: State-of-the-Art Natural Language Processing',
        authors: ['Thomas Wolf', 'Lysandre Debut', 'Victor Sanh', 'Julien Chaumond'],
        abstract: 'Recent progress in natural language processing has been driven by advances in both model architecture and methods for pretraining.',
        url: 'https://arxiv.org/abs/1910.03771',
        arxivId: '1910.03771',
        publishedDate: '2019',
        tags: ['Mock', 'NLP', 'Library'],
        introduction: ''
      }
    ]
  };

  /**
   * Get mock citations for a paper
   */
  static getMockCitations(paper: Paper): Partial<Paper>[] {
    const titleLower = paper.title.toLowerCase();
    
    // Try to find specific citations for this paper
    for (const [key, citations] of Object.entries(this.mockCitationDatabase)) {
      if (key !== 'default' && titleLower.includes(key)) {
        console.log(`Found ${citations.length} mock citations for: ${paper.title}`);
        return citations;
      }
    }
    
    // Return default citations if no specific ones found
    console.log(`Using default mock citations for: ${paper.title}`);
    return this.mockCitationDatabase.default;
  }

  /**
   * Check if mock citations are available for a paper
   */
  static hasMockCitations(paper: Paper): boolean {
    const titleLower = paper.title.toLowerCase();
    return Object.keys(this.mockCitationDatabase).some(key => 
      key === 'default' || titleLower.includes(key)
    );
  }

  /**
   * Get mock references (papers cited by the given paper)
   */
  static getMockReferences(paper: Paper): Partial<Paper>[] {
    // For simplicity, return a subset of citations as references
    const citations = this.getMockCitations(paper);
    return citations.slice(0, 2); // Return first 2 as references
  }
}
