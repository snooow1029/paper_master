import { Router } from 'express';
import { AdvancedCitationService } from '../services/AdvancedCitationService';
import { Request, Response } from 'express';
import axios from 'axios';
import { debugLLMContent } from '../controllers/debugController';

const router = Router();

// Test filtered citation extraction
router.post('/test-filtered-citations', async (req, res) => {
  try {
    const { url } = req.body;
    const testUrl = url || 'https://arxiv.org/abs/1706.03762'; // Transformer paper
    
    console.log('Testing filtered citation extraction with URL:', testUrl);
    
    const grobidService = new AdvancedCitationService();
    const result = await grobidService.extractCitationsWithContextFiltered(testUrl);
    
    res.json({
      success: result.success,
      paperTitle: result.paperTitle,
      totalSections: result.totalSections,
      filteredSections: result.filteredSections,
      citationCount: result.citations?.length || 0,
      citations: result.citations?.slice(0, 5), // 只返回前5個避免響應過大
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test LLM connection
router.get('/test-llm', async (req: Request, res: Response) => {
  try {
    const localLlmUrl = process.env.LOCAL_LLM_URL || 'http://localhost:8000';
    const localLlmModel = process.env.LOCAL_LLM_MODEL || 'Qwen/Qwen3-4B-Instruct-2507';

    console.log(`Testing local LLM at ${localLlmUrl}`);

    const response = await axios.post(`${localLlmUrl}/v1/chat/completions`, {
      model: localLlmModel,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Respond with a simple JSON object.'
        },
        {
          role: 'user',
          content: 'Say hello and confirm you are working. Respond in JSON format: {"status": "working", "message": "your message"}'
        }
      ],
      temperature: 0.3,
      max_tokens: 100,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const content = response.data?.choices?.[0]?.message?.content;
    
    res.json({
      success: true,
      llm_response: content,
      llm_url: localLlmUrl,
      model: localLlmModel
    });
  } catch (error) {
    console.error('Error testing LLM:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      llm_url: process.env.LOCAL_LLM_URL,
      model: process.env.LOCAL_LLM_MODEL
    });
  }
});

// Debug LLM content route
router.post('/debug-llm-content', debugLLMContent);

export default router;
