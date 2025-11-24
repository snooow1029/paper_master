/**
 * Paper Analysis Task Processor
 * 处理论文分析的异步任务
 */

import { TaskProcessor } from './TaskQueueService';
import { PaperGraphBuilder, GraphBuildResult } from './PaperGraphBuilder';
import { PaperMetadata } from './PaperRelationshipAnalyzer';

export interface PaperAnalysisTaskInput {
  urls: string[];
  filterSections?: boolean;
  expansionDepth?: number;
}

export interface PaperAnalysisTaskOutput extends GraphBuildResult {
  taskId: string;
}

/**
 * Create a task processor for paper graph building
 */
export function createPaperAnalysisProcessor(): TaskProcessor<
  PaperAnalysisTaskInput,
  PaperAnalysisTaskOutput
> {
  const graphBuilder = new PaperGraphBuilder();

  return async (taskId: string, input: PaperAnalysisTaskInput, updateProgress: (progress: number) => void): Promise<PaperAnalysisTaskOutput> => {
    const { urls, filterSections, expansionDepth = 0 } = input;

    try {
      // Step 1: Extract papers (0-40%)
      updateProgress(10);
      console.log(`[Task ${taskId}] Starting paper extraction for ${urls.length} URLs`);

      let result: GraphBuildResult;

      if (filterSections) {
        updateProgress(20);
        result = await graphBuilder.buildGraphWithFilteredCitations(urls, expansionDepth);
      } else {
        updateProgress(20);
        result = await graphBuilder.buildGraphFromUrls(urls);
      }

      updateProgress(50);

      if (!result.success) {
        throw new Error(result.error || 'Failed to build graph');
      }

      // Transform result
      const output: PaperAnalysisTaskOutput = {
        ...result,
        taskId,
      };

      updateProgress(100);
      console.log(`[Task ${taskId}] Task completed successfully`);

      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Task ${taskId}] Task failed:`, errorMessage);
      throw error;
    }
  };
}

