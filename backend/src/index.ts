/**
 * Server startup script with better error handling
 * This ensures the server starts even if some services are unavailable
 */

import 'reflect-metadata';
import dotenv from 'dotenv';

// 確保 .env 文件正確加載
dotenv.config({ path: '.env' });

// Import debug utilities
import { logStartupInfo, debugEnvironment } from './debug';

import express from 'express';
import cors from 'cors';
import { AppDataSource } from './config/database';
import passport from './config/passport';
import paperRoutes from './routes/paperRoutes';
import testRoutes from './routes/testRoutes';
import grobidTestRoutes from './routes/grobidTestRoutes';
import graphRoutes from './routes/graphRoutes';
import enhancedGraphRoutes from './routes/enhancedGraphRoutes';
import referenceGraphRoutes from './routes/referenceGraphRoutes';
import taskQueueRoutes from './routes/taskQueueRoutes';
import citationRoutes from './routes/citationRoutes';
import authRoutes from './routes/authRoutes';
import sessionRoutes from './routes/sessionRoutes';
import analysisRoutes from './routes/analysisRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// 在啟動時顯示配置
const llmType = process.env.LLM_TYPE || 'disabled';
const llmUrl = process.env.LOCAL_LLM_URL || 'http://localhost:8000';
const llmModel = process.env.LOCAL_LLM_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';

// Log detailed startup information
logStartupInfo();

console.log('='.repeat(60));
console.log('Paper Master Backend Starting...');
console.log('='.repeat(60));
console.log(`Port: ${PORT}`);
console.log(`LLM Type: ${llmType}`);
console.log(`LLM URL: ${llmUrl}`);
console.log(`LLM Model: ${llmModel}`);
console.log(`GROBID URL: ${process.env.GROBID_URL || 'Not set'}`);
console.log(`Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
console.log('='.repeat(60));

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Passport (for OAuth flow only, no session needed)
app.use(passport.initialize());

// Routes
app.use('/api/papers', paperRoutes);
app.use('/api/test', testRoutes);
app.use('/api/grobid', grobidTestRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/enhanced-graph', enhancedGraphRoutes);
app.use('/api/reference-graph', referenceGraphRoutes);
app.use('/api/tasks', taskQueueRoutes);
app.use('/api/citations', citationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/analyses', analysisRoutes);

// Health check - 必須在數據庫初始化之前可用
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = AppDataSource.isInitialized;
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      port: PORT
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Paper Master API',
    version: '1.0.0',
    health: '/api/health',
    debug: '/api/debug'
  });
});

// Debug endpoint - 用於調試部署問題
app.get('/api/debug', async (req, res) => {
  try {
    const debugInfo = await debugEnvironment();
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Error handling
app.use(errorHandler);

// 啟動服務器（不等待數據庫）
function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`✅ Health check: http://0.0.0.0:${PORT}/api/health`);
    console.log('='.repeat(60));
  });
}

// 嘗試初始化數據庫，但不阻塞服務器啟動
AppDataSource.initialize()
  .then(() => {
    console.log('✅ Database connected successfully');
    startServer();
  })
  .catch((error) => {
    console.error('⚠️  Database connection failed:', error instanceof Error ? error.message : error);
    console.error('⚠️  Starting server without database - some features will be unavailable');
    startServer();
  });

// 處理未捕獲的錯誤
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // 不要退出，讓服務繼續運行
});

