/**
 * Task Queue Service
 * 异步任务队列服务，用于处理长时间运行的论文分析任务
 */

import { EventEmitter } from 'events';

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface Task<T = any> {
  id: string;
  type: string;
  status: TaskStatus;
  progress: number; // 0-100
  progressInfo?: ProgressUpdate; // Structured progress information
  data?: T;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ProgressUpdate {
  progress: number; // 0-100
  step?: string; // 'initializing' | 'extracting' | 'analyzing' | 'building'
  currentStep?: string; // Human-readable current step
  details?: string; // Additional details
  metadata?: Record<string, any>; // Additional metadata
}

export interface TaskProcessor<TInput = any, TOutput = any> {
  (taskId: string, input: TInput, updateProgress: (progress: number | ProgressUpdate) => void): Promise<TOutput>;
}

export class TaskQueueService extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private processors: Map<string, TaskProcessor> = new Map();
  private processingTasks: Set<string> = new Set();
  private maxConcurrentTasks: number = 3;

  /**
   * Register a task processor
   */
  registerProcessor<TInput = any, TOutput = any>(
    taskType: string,
    processor: TaskProcessor<TInput, TOutput>
  ): void {
    this.processors.set(taskType, processor);
  }

  /**
   * Submit a new task
   */
  async submitTask<TInput = any, TOutput = any>(
    taskType: string,
    input: TInput,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.processors.has(taskType)) {
      throw new Error(`No processor registered for task type: ${taskType}`);
    }

    const taskId = this.generateTaskId();
    const task: Task<TInput> = {
      id: taskId,
      type: taskType,
      status: TaskStatus.PENDING,
      progress: 0,
      data: input,
      createdAt: new Date(),
      metadata,
    };

    this.tasks.set(taskId, task);
    this.emit('task:created', task);

    // Process task asynchronously
    this.processTask(taskId).catch((error) => {
      console.error(`Task ${taskId} failed:`, error);
    });

    return taskId;
  }

  /**
   * Get task status
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === TaskStatus.PENDING) {
      task.status = TaskStatus.CANCELLED;
      task.completedAt = new Date();
      this.emit('task:cancelled', task);
      return true;
    }

    return false;
  }

  /**
   * Process a task
   */
  private async processTask(taskId: string): Promise<void> {
    // Wait if too many tasks are processing
    while (this.processingTasks.size >= this.maxConcurrentTasks) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const task = this.tasks.get(taskId);
    if (!task || task.status !== TaskStatus.PENDING) {
      return;
    }

    const processor = this.processors.get(task.type);
    if (!processor) {
      task.status = TaskStatus.FAILED;
      task.error = `No processor found for task type: ${task.type}`;
      task.completedAt = new Date();
      this.emit('task:failed', task);
      return;
    }

    this.processingTasks.add(taskId);
    task.status = TaskStatus.PROCESSING;
    task.startedAt = new Date();
    this.emit('task:started', task);

    const updateProgress = (progress: number | ProgressUpdate) => {
      if (typeof progress === 'number') {
        task.progress = Math.max(0, Math.min(100, progress));
      } else {
        task.progress = Math.max(0, Math.min(100, progress.progress));
        task.progressInfo = progress;
      }
      this.emit('task:progress', task);
    };

    try {
      const result = await processor(taskId, task.data, updateProgress);
      
      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.data = result as any;
      task.completedAt = new Date();
      this.emit('task:completed', task);
    } catch (error) {
      task.status = TaskStatus.FAILED;
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.completedAt = new Date();
      this.emit('task:failed', task);
    } finally {
      this.processingTasks.delete(taskId);
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old completed/failed tasks (older than 24 hours)
   */
  cleanupOldTasks(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [taskId, task] of this.tasks.entries()) {
      if (
        (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) &&
        task.completedAt &&
        now - task.completedAt.getTime() > maxAge
      ) {
        this.tasks.delete(taskId);
      }
    }
  }

  /**
   * Get task statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const stats = {
      total: this.tasks.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case TaskStatus.PENDING:
          stats.pending++;
          break;
        case TaskStatus.PROCESSING:
          stats.processing++;
          break;
        case TaskStatus.COMPLETED:
          stats.completed++;
          break;
        case TaskStatus.FAILED:
          stats.failed++;
          break;
      }
    }

    return stats;
  }
}

// Singleton instance
export const taskQueueService = new TaskQueueService();

// Cleanup old tasks every hour
setInterval(() => {
  taskQueueService.cleanupOldTasks();
}, 60 * 60 * 1000);

