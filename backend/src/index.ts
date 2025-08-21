import 'reflect-metadata';
import dotenv from 'dotenv';

// 確保 .env 文件正確加載
dotenv.config({ path: '.env' });

import express from 'express';
import cors from 'cors';
import { AppDataSource } from './config/database';
import paperRoutes from './routes/paperRoutes';
import testRoutes from './routes/testRoutes';
import grobidTestRoutes from './routes/grobidTestRoutes';
import graphRoutes from './routes/graphRoutes';
import enhancedGraphRoutes from './routes/enhancedGraphRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 5001;

// 在啟動時顯示 LLM 配置
const llmType = process.env.LLM_TYPE || 'disabled';
const llmUrl = process.env.LOCAL_LLM_URL || 'http://localhost:8000';
const llmModel = process.env.LOCAL_LLM_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';

console.log(`Using ${llmType} LLM at ${llmUrl} with model ${llmModel}`);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/papers', paperRoutes);
app.use('/api/test', testRoutes);
app.use('/api/grobid', grobidTestRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/enhanced-graph', enhancedGraphRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Initialize database and start server
AppDataSource.initialize()
  .then(() => {
    console.log('Database connected successfully');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });

