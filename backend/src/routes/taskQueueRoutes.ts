/**
 * Task Queue Routes
 * 异步任务队列 API 路由
 */

import { Router, Request, Response } from 'express';
import { taskQueueService, TaskStatus } from '../services/TaskQueueService';
import { createPaperAnalysisProcessor } from '../services/PaperAnalysisTaskProcessor';
import { PaperAnalysisTaskInput } from '../services/PaperAnalysisTaskProcessor';

const router = Router();

// 注册任务处理器
taskQueueService.registerProcessor('paper-analysis', createPaperAnalysisProcessor());

/**
 * 提交论文分析任务（异步）
 * POST /api/tasks/analyze-papers
 */
router.post('/analyze-papers', async (req: Request, res: Response) => {
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

    console.log(`\n=== Submitting Async Task: Paper Analysis ===`);
    console.log('URLs:', urls);
    console.log('Filter sections:', filterSections);
    console.log('Expansion depth:', expansionDepth);

    const taskInput: PaperAnalysisTaskInput = {
      urls,
      filterSections: filterSections || false,
      expansionDepth,
    };

    const taskId = await taskQueueService.submitTask('paper-analysis', taskInput, {
      urls,
      filterSections,
      expansionDepth,
    });

    res.json({
      success: true,
      taskId,
      status: 'pending',
      message: 'Task submitted successfully. Use the taskId to poll for status.',
      pollUrl: `/api/tasks/${taskId}/status`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Task submission error:', errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * 获取任务状态
 * GET /api/tasks/:taskId/status
 */
router.get('/:taskId/status', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = taskQueueService.getTask(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      task: {
        id: task.id,
        type: task.type,
        status: task.status,
        progress: task.progress,
        error: task.error,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        metadata: task.metadata,
        // 只有在完成时才返回结果
        result: task.status === TaskStatus.COMPLETED ? task.data : undefined
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * 获取任务结果（仅在任务完成时）
 * GET /api/tasks/:taskId/result
 */
router.get('/:taskId/result', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = taskQueueService.getTask(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    if (task.status !== TaskStatus.COMPLETED) {
      return res.status(400).json({
        success: false,
        error: `Task is not completed yet. Current status: ${task.status}`,
        status: task.status,
        progress: task.progress
      });
    }

    res.json({
      success: true,
      result: task.data
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * 取消任务
 * POST /api/tasks/:taskId/cancel
 */
router.post('/:taskId/cancel', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const cancelled = taskQueueService.cancelTask(taskId);

    if (!cancelled) {
      return res.status(400).json({
        success: false,
        error: 'Task cannot be cancelled (may not exist or already processing)'
      });
    }

    res.json({
      success: true,
      message: 'Task cancelled successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * 获取所有任务列表
 * GET /api/tasks
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const tasks = taskQueueService.getAllTasks();
    const stats = taskQueueService.getStats();

    res.json({
      success: true,
      tasks: tasks.map(task => ({
        id: task.id,
        type: task.type,
        status: task.status,
        progress: task.progress,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        metadata: task.metadata,
      })),
      stats
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * SSE 流式获取任务进度
 * GET /api/tasks/:taskId/stream
 */
router.get('/:taskId/stream', (req: Request, res: Response) => {
  const { taskId } = req.params;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`);

  // Check if task exists
  const task = taskQueueService.getTask(taskId);
  if (!task) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Task not found' })}\n\n`);
    res.end();
    return;
  }

  // Send current status immediately
  res.write(`data: ${JSON.stringify({
    type: 'progress',
    progress: task.progress,
    progressInfo: task.progressInfo,
    status: task.status
  })}\n\n`);

  // Listen for progress updates
  const progressHandler = (updatedTask: any) => {
    if (updatedTask.id === taskId) {
      const data = {
        type: 'progress',
        progress: updatedTask.progress,
        progressInfo: updatedTask.progressInfo,
        status: updatedTask.status
      };
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const completedHandler = (completedTask: any) => {
    if (completedTask.id === taskId) {
      res.write(`data: ${JSON.stringify({
        type: 'completed',
        progress: 100,
        result: completedTask.data
      })}\n\n`);
      cleanup();
    }
  };

  const failedHandler = (failedTask: any) => {
    if (failedTask.id === taskId) {
      res.write(`data: ${JSON.stringify({
        type: 'failed',
        error: failedTask.error
      })}\n\n`);
      cleanup();
    }
  };

  const cleanup = () => {
    taskQueueService.removeListener('task:progress', progressHandler);
    taskQueueService.removeListener('task:completed', completedHandler);
    taskQueueService.removeListener('task:failed', failedHandler);
    res.end();
  };

  // Register event listeners
  taskQueueService.on('task:progress', progressHandler);
  taskQueueService.on('task:completed', completedHandler);
  taskQueueService.on('task:failed', failedHandler);

  // Handle client disconnect
  req.on('close', () => {
    cleanup();
  });
});

export default router;

