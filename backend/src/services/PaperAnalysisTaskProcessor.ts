/**
 * Paper Analysis Task Processor
 * 处理论文分析的异步任务
 */

import { TaskProcessor, ProgressUpdate } from './TaskQueueService';
import { PaperGraphBuilder, GraphBuildResult } from './PaperGraphBuilder';
import { PaperMetadata } from './PaperRelationshipAnalyzer';
import { PaperCitationService } from './PaperCitationService';

export interface PaperAnalysisTaskInput {
  urls: string[];
  filterSections?: boolean;
  expansionDepth?: number;
}

export interface PaperAnalysisTaskOutput extends GraphBuildResult {
  taskId: string;
  originalPapers?: {
    urls: string[];
    priorWorks: Record<string, any[]>;
    derivativeWorks: Record<string, any[]>;
  };
}

/**
 * Create a task processor for paper graph building
 */
export function createPaperAnalysisProcessor(): TaskProcessor<
  PaperAnalysisTaskInput,
  PaperAnalysisTaskOutput
> {
  const graphBuilder = new PaperGraphBuilder();
  const citationService = new PaperCitationService();

  return async (taskId: string, input: PaperAnalysisTaskInput, updateProgress: (progress: number | ProgressUpdate) => void): Promise<PaperAnalysisTaskOutput> => {
    const { urls, filterSections, expansionDepth = 0 } = input;

    try {
      // Step 1: Initialize (0-5%)
      updateProgress({
        progress: 0,
        step: 'initializing',
        currentStep: 'Initializing analysis...',
        details: `Preparing to analyze ${urls.length} paper(s)`
      });
      console.log(`[Task ${taskId}] Starting paper extraction for ${urls.length} URLs`);

      // Step 2: Check services (5-10%)
      updateProgress({
        progress: 5,
        step: 'initializing',
        currentStep: 'Checking services...',
        details: 'Verifying GROBID and LLM availability'
      });

      let result: GraphBuildResult;

      // Create progress callback for detailed updates
      const progressCallback = (progressUpdate: ProgressUpdate) => {
        updateProgress(progressUpdate);
      };

      if (filterSections) {
        updateProgress({
          progress: 10,
          step: 'extracting',
          currentStep: 'Starting extraction with filtered citations...',
          details: `Processing ${urls.length} paper(s) with section filtering`
        });
        result = await graphBuilder.buildGraphWithFilteredCitations(urls, expansionDepth, progressCallback);
      } else {
        updateProgress({
          progress: 10,
          step: 'extracting',
          currentStep: 'Starting extraction...',
          details: `Processing ${urls.length} paper(s)`
        });
        result = await graphBuilder.buildGraphFromUrls(urls, progressCallback);
      }

      updateProgress({
        progress: 90,
        step: 'building',
        currentStep: 'Finalizing graph structure...',
        details: 'Preparing results'
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to build graph');
      }

      // Compute Prior Works and Derivative Works for original papers
      updateProgress({
        progress: 92,
        step: 'building',
        currentStep: 'Computing Prior Works and Derivative Works...',
        details: 'Analyzing citation relationships'
      });

      console.log(`[Task ${taskId}] Computing Prior & Derivative Works for ${urls.length} original papers`);
      const priorWorksMap: Record<string, any[]> = {};
      const derivativeWorksMap: Record<string, any[]> = {};
      
      // 并行计算所有原始论文的 prior 和 derivative works
      const worksPromises = urls.map(async (url: string, index: number) => {
        if (!url || !url.trim()) return;
        
        try {
          const [priorWorks, derivativeWorks] = await Promise.all([
            citationService.getPriorWorksFromUrl(url).catch(err => {
              console.error(`[Task ${taskId}] Error getting prior works for ${url}:`, err);
              return [];
            }),
            citationService.getDerivativeWorksFromUrl(url).catch(err => {
              console.error(`[Task ${taskId}] Error getting derivative works for ${url}:`, err);
              return [];
            })
          ]);
          
          priorWorksMap[url] = priorWorks;
          derivativeWorksMap[url] = derivativeWorks;
          console.log(`[Task ${taskId}] ✅ Paper ${index + 1}: ${priorWorks.length} prior works, ${derivativeWorks.length} derivative works`);
        } catch (error) {
          console.error(`[Task ${taskId}] Error processing works for ${url}:`, error);
          priorWorksMap[url] = [];
          derivativeWorksMap[url] = [];
        }
      });

      await Promise.all(worksPromises);

      // Transform result
      const output: PaperAnalysisTaskOutput = {
        ...result,
        taskId,
        originalPapers: {
          urls: urls.filter(u => u && u.trim()),
          priorWorks: priorWorksMap,
          derivativeWorks: derivativeWorksMap
        }
      };

      updateProgress({
        progress: 100,
        step: 'building',
        currentStep: 'Analysis complete!',
        details: `Successfully analyzed ${result.papers?.length || 0} paper(s)`
      });
      console.log(`[Task ${taskId}] Task completed successfully`);

      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Task ${taskId}] Task failed:`, errorMessage);
      throw error;
    }
  };
}

