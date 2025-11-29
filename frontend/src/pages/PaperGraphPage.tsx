import React, { useState, useEffect, useRef } from 'react';
import GraphVisualization from '../components/GraphVisualization';
import AnalysisProgress from '../components/AnalysisProgress';
import { GraphData } from '../types/graph';
import '../styles/theme.css';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  FilterList as FilterListIcon,
  NetworkCheck as NetworkCheckIcon,
  Description as DescriptionIcon,
  Sync as SyncIcon,
  BarChart as BarChartIcon,
  MenuBook as MenuBookIcon,
  Link as LinkIcon,
  AutoAwesome as AutoAwesomeIcon,
  Psychology as PsychologyIcon,
  Hub as HubIcon,
  CenterFocusStrong as CenterFocusStrongIcon,
  Layers as LayersIcon,
  Lightbulb as LightbulbIcon,
  Book as BookIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

// Use relative path if VITE_API_BASE_URL is not set (development proxy)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : 'http://localhost:8080');

interface Citation {
  title: string;
  authors?: string[];
  venue?: string;
  year?: string;
  arxivId?: string;
  url?: string;
  doi?: string;
  relevanceScore?: number;
}



const PaperGraphPage: React.FC = () => {
  // Core state
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  
  // Progress state
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState<{
    progress: number;
    step?: string;
    currentStep?: string;
    details?: string;
  } | undefined>(undefined);
  
  // SSE connection ref
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // 保存用户输入的原始论文 URLs（用于 Prior/Derivative Works）
  const [_originalPaperUrls, setOriginalPaperUrls] = useState<string[]>([]);
  
  // 多模式切换状态（类似 Connected Papers）
  type ViewMode = 'graph' | 'prior-works' | 'derivative-works';
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  
  // Prior Works 和 Derivative Works 数据（从分析结果中获取）
  const [_priorWorksData, setPriorWorksData] = useState<Record<string, any[]>>({});
  const [_derivativeWorksData, setDerivativeWorksData] = useState<Record<string, any[]>>({});
  
  // 合并后的 Prior/Derivative Works 列表（所有原始论文的合并）
  const [allPriorWorks, setAllPriorWorks] = useState<any[]>([]);
  const [allDerivativeWorks, setAllDerivativeWorks] = useState<any[]>([]);
  
  // Prior Works 排序状态
  type SortField = 'title' | 'lastAuthor' | 'year' | 'citation' | 'strength';
  type SortDirection = 'asc' | 'desc';
  const [priorWorksSortField, setPriorWorksSortField] = useState<SortField>('strength');
  const [priorWorksSortDirection, setPriorWorksSortDirection] = useState<SortDirection>('desc');
  
  // Prior Works Author 显示模式：first 或 last
  const [showFirstAuthor, setShowFirstAuthor] = useState(false);
  
  // Derivative Works 排序状态
  type DerivativeSortField = 'title' | 'lastAuthor' | 'year' | 'citation' | 'strength';
  const [derivativeWorksSortField, setDerivativeWorksSortField] = useState<DerivativeSortField>('strength');
  const [derivativeWorksSortDirection, setDerivativeWorksSortDirection] = useState<SortDirection>('desc');
  
  // Derivative Works Author 显示模式：first 或 last
  const [showDerivativeFirstAuthor, setShowDerivativeFirstAuthor] = useState(false);

  // Configuration state
  const [urls, setUrls] = useState<string[]>(['', '']);
  const [filterSections, setFilterSections] = useState(true);
  const [expansionDepth, setExpansionDepth] = useState(0);

  // Citation Extractor state
  const [showCitationExtractor, setShowCitationExtractor] = useState(false);
  const [citationUrl, setCitationUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [citationResults, setCitationResults] = useState<string | null>(null);
  const [showAllCitations, setShowAllCitations] = useState(false);

  // Obsidian Sync state
  const [showObsidianSync, setShowObsidianSync] = useState(false);
  const [obsidianPath, setObsidianPath] = useState('');
  const [obsidianSubfolder, setObsidianSubfolder] = useState('');

  // 这些状态变量已不再使用（功能已移到顶部标签页）
  // 保留用于向后兼容，可以稍后删除

  // Panel collapse state
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
  
  // Overall bottom section collapse state
  // Guide section - 改為可摺疊的側邊欄，而不是底部固定區域
  const [showGuideSidebar, setShowGuideSidebar] = useState(false);

  // URL management
  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const addUrl = () => {
    setUrls([...urls, '']);
  };

  const removeUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const exampleUrls = [
    'https://arxiv.org/abs/1706.03762',
    'https://arxiv.org/abs/1810.04805',
    'https://arxiv.org/abs/2204.02311'
  ];

  const fillExampleUrls = () => {
    setUrls([...exampleUrls]);
  };

  // 為圖數據補充citation count
  const enhanceWithCitationCounts = async (graphData: any, urls: string[]) => {
    console.log('🔍 Enhancing graph data with citation counts...');
    
    try {
      // 為每個URL調用深度分析API獲取citation count
      const citationMap = new Map();
      
      for (const url of urls) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/enhanced-graph/build`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              papers: [url]
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.graph && result.graph.nodes.length > 0) {
              const node = result.graph.nodes[0];
              // 使用title來匹配nodes
              citationMap.set(node.title.toLowerCase(), node.citationCount || 0);
              console.log(`📊 Citation count for "${node.title}": ${node.citationCount}`);
            }
          }
        } catch (err) {
          console.warn('Failed to get citation count for:', url, err);
        }
      }
      
      // 為原本的nodes補充citation count
      const enhancedNodes = graphData.nodes.map((node: any) => {
        const citationCount = citationMap.get(node.title.toLowerCase());
        return {
          ...node,
          citationCount: citationCount !== undefined ? citationCount : undefined
        };
      });
      
      console.log('✅ Enhanced nodes with citation counts:', enhancedNodes.map((n: any) => ({
        title: n.title,
        citationCount: n.citationCount
      })));
      
      return {
        ...graphData,
        nodes: enhancedNodes
      };
      
    } catch (error) {
      console.warn('Failed to enhance with citation counts:', error);
      return graphData; // 返回原始數據作為fallback
    }
  };

  void enhanceWithCitationCounts;

  // Cleanup SSE connection
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Main analysis function
  const handleAnalyze = async () => {
    const validUrls = urls.filter(url => url.trim());
    if (validUrls.length === 0) {
      setError('Please enter at least one valid URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setProgressInfo(undefined);

    // Close existing SSE connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Step 1: Submit task
      const submitResponse = await fetch(`${API_BASE_URL}/api/tasks/analyze-papers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: validUrls,
          filterSections,
          expansionDepth
        })
      });

      if (!submitResponse.ok) {
        throw new Error(`Failed to submit task: ${submitResponse.statusText}`);
      }

      const submitResult = await submitResponse.json();
      if (!submitResult.success || !submitResult.taskId) {
        throw new Error('Failed to create analysis task');
      }

      const taskId = submitResult.taskId;

      // Step 2: Connect to SSE stream
      const eventSource = new EventSource(`${API_BASE_URL}/api/tasks/${taskId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.log('Connected to progress stream');
          } else if (data.type === 'progress') {
            setProgress(data.progress || 0);
            setProgressInfo(data.progressInfo || {
              progress: data.progress || 0,
              currentStep: 'Processing...'
            });
          } else if (data.type === 'completed') {
            // Task completed, fetch result
            eventSource.close();
            eventSourceRef.current = null;
            
            fetch(`${API_BASE_URL}/api/tasks/${taskId}/result`)
              .then(res => {
                if (!res.ok) {
                  throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
              })
              .then(result => {
                console.log('📥 Fetched task result:', result);
                
                // 後端可能直接返回 result，或者包裝在 result.result 中
                const analysisResult = result.result || result;
                
                console.log('📥 Analysis result structure:', {
                  hasResult: !!result.result,
                  hasAnalysisResult: !!analysisResult,
                  analysisResultKeys: analysisResult ? Object.keys(analysisResult) : [],
                  originalPapers: analysisResult?.originalPapers,
                  hasOriginalPapers: !!analysisResult?.originalPapers,
                  originalPapersKeys: analysisResult?.originalPapers ? Object.keys(analysisResult.originalPapers) : []
                });
                
                // 檢查 graphData 或 graph 是否存在（後端可能使用不同的字段名）
                // 優先檢查 graphData，如果沒有則檢查 graph
                let graphData = analysisResult?.graphData || result.graphData;
                if (!graphData) {
                  // 後端可能使用 'graph' 而不是 'graphData'
                  graphData = analysisResult?.graph || result.graph;
                  if (graphData) {
                    console.log('📊 Found graph data under "graph" field, converting to graphData');
                  }
                }
                
                if (graphData) {
                  console.log('✅ Found graph data, processing result...');
                  // 確保傳遞完整的 analysisResult，包含 graphData 和 originalPapers
                  const finalResult = {
                    ...analysisResult,
                    graphData: graphData, // 統一使用 graphData 字段名
                    success: result.success !== false && analysisResult?.success !== false,
                    originalPapers: analysisResult?.originalPapers || result.originalPapers || {}
                  };
                  
                  console.log('📦 Final result structure:', {
                    hasGraphData: !!finalResult.graphData,
                    hasOriginalPapers: !!finalResult.originalPapers,
                    originalPapers: finalResult.originalPapers,
                    priorWorks: finalResult.originalPapers?.priorWorks,
                    derivativeWorks: finalResult.originalPapers?.derivativeWorks
                  });
                  
                  handleAnalysisResult(finalResult, validUrls);
                } else {
                  const errorMsg = result.error || analysisResult?.error || 'No graph data found in result';
                  console.error('❌ Result indicates failure:', errorMsg);
                  console.error('❌ Available keys in result:', result.result ? Object.keys(result.result) : Object.keys(result));
                  throw new Error(errorMsg);
                }
              })
              .catch(err => {
                console.error('❌ Error fetching result:', err);
                setError(err.message || 'Analysis failed');
                setIsLoading(false);
                setProgress(0);
                setProgressInfo(undefined);
              });
          } else if (data.type === 'failed') {
            eventSource.close();
            eventSourceRef.current = null;
            setError(data.error || 'Analysis failed');
            setIsLoading(false);
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        eventSourceRef.current = null;
        setError('Connection to server lost');
        setIsLoading(false);
      };

    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsLoading(false);
      setProgress(0);
      setProgressInfo(undefined);
    }
  };

  // Handle analysis result (extracted from original code)
  const handleAnalysisResult = (result: any, validUrls: string[]) => {
    console.log('📊 Received analysis result:', result);
    
    // 更健壯的錯誤處理
    if (!result) {
      console.error('❌ Result is null or undefined');
      throw new Error('No result received from server');
    }
    
    // 檢查是否有錯誤信息
    if (result.error) {
      console.error('❌ Result contains error:', result.error);
      throw new Error(result.error || 'Analysis failed');
    }
    
    // 如果 success 明確為 false，拋出錯誤
    if (result.success === false) {
      console.error('❌ Analysis failed:', result.error || 'Unknown error');
      throw new Error(result.error || 'Analysis failed');
    }
    
    // 檢查 graphData 是否存在
    if (!result.graphData) {
      console.error('❌ No graphData in result:', result);
      throw new Error('No graph data received from server');
    }
    
    // 處理成功的結果
    if (result.graphData) {
      console.log('📊 Processing graph data:', result.graphData);
      
      // Transform result to match expected format
      const transformedResult = {
        success: result.success,
        graphData: result.graphData,
        originalPapers: result.originalPapers || {}
      };
      
      // 保存原始论文 URLs
      setOriginalPaperUrls(validUrls);
      
      // 保存 Prior Works 和 Derivative Works 数据
      console.log('📚 Checking originalPapers:', {
        hasOriginalPapers: !!transformedResult.originalPapers,
        originalPapers: transformedResult.originalPapers,
        priorWorks: transformedResult.originalPapers?.priorWorks,
        derivativeWorks: transformedResult.originalPapers?.derivativeWorks,
        priorWorksKeys: transformedResult.originalPapers?.priorWorks ? Object.keys(transformedResult.originalPapers.priorWorks) : [],
        derivativeWorksKeys: transformedResult.originalPapers?.derivativeWorks ? Object.keys(transformedResult.originalPapers.derivativeWorks) : []
      });
      
      if (transformedResult.originalPapers && 
          (transformedResult.originalPapers.priorWorks || transformedResult.originalPapers.derivativeWorks)) {
        console.log('📚 Received Prior/Derivative Works data:', transformedResult.originalPapers);
        setPriorWorksData(transformedResult.originalPapers.priorWorks || {});
        setDerivativeWorksData(transformedResult.originalPapers.derivativeWorks || {});
        
        // 合并所有原始论文的 Prior Works（去重并计算统计信息）
        const mergedPriorWorks: Map<string, any> = new Map();
        Object.values(transformedResult.originalPapers.priorWorks || {}).flat().forEach((work: any) => {
          const key = work.id || work.title;
          if (!mergedPriorWorks.has(key)) {
            mergedPriorWorks.set(key, work);
          } else {
            const existing = mergedPriorWorks.get(key);
            mergedPriorWorks.set(key, {
              ...existing,
              ...work,
              authors: work.authors?.length > existing.authors?.length ? work.authors : existing.authors
            });
          }
        });
        
        // 计算每个 prior work 的 graph citations 和 strength
        const priorWorksWithStats = Array.from(mergedPriorWorks.values()).map((work: any) => {
          const matchingNodes = transformedResult.graphData.nodes.filter((node: any) => {
            const nodeTitle = (node.title || '').toLowerCase().trim();
            const workTitle = (work.title || '').toLowerCase().trim();
            return nodeTitle === workTitle || 
                   nodeTitle.includes(workTitle.substring(0, 30)) || 
                   workTitle.includes(nodeTitle.substring(0, 30));
          });
          
          let citationCount = work.citationCount;
          if ((citationCount === undefined || citationCount === null) && matchingNodes.length > 0) {
            const firstMatchingNode = matchingNodes[0];
            if (firstMatchingNode.citationCount !== undefined && firstMatchingNode.citationCount !== null) {
              citationCount = firstMatchingNode.citationCount;
            }
          }
          
          let graphCitations = 0;
          let totalStrength = 0;
          let strengthCount = 0;
          
          matchingNodes.forEach((matchingNode: any) => {
            const nodeId = matchingNode.id;
            const incomingEdges = transformedResult.graphData.edges.filter((edge: any) => {
              const targetId = typeof edge.target === 'string' ? edge.target : edge.target?.id;
              return targetId === nodeId;
            });
            graphCitations += incomingEdges.length;
            incomingEdges.forEach((edge: any) => {
              if (edge.strength !== undefined && edge.strength !== null) {
                totalStrength += edge.strength;
                strengthCount++;
              }
            });
          });
          
          const avgStrength = strengthCount > 0 ? totalStrength / strengthCount : 0;
          
          return {
            ...work,
            citationCount: citationCount || 0,
            graphCitations,
            avgStrength
          };
        });
        
        setAllPriorWorks(priorWorksWithStats);
      }
      
      // 處理 graphData（保留原有邏輯）
      setGraphData(transformedResult.graphData);
      console.log('✅ Graph data set successfully');
      
      setIsLoading(false);
      setProgress(100);
      setProgressInfo({
        progress: 100,
        step: 'building',
        currentStep: 'Analysis complete!',
        details: `Successfully analyzed ${transformedResult.graphData.nodes.length} papers`
      });
      
      // Clear progress after a short delay
      setTimeout(() => {
        setProgress(0);
        setProgressInfo(undefined);
      }, 2000);
    }
    // 注意：如果到達這裡，說明上面的檢查都通過了，應該不會執行到這裡
    // 但為了安全起見，我們還是保留這個 else 分支
  };
  
  // Old analysis function (kept for reference, but replaced by handleAnalyze)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error - Kept for reference only, not used
  const _oldHandleAnalyze = async () => {
    const validUrls = urls.filter(url => url.trim());
    if (validUrls.length === 0) {
      setError('Please enter at least one valid URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/graph/build-graph`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: validUrls,
          filterSections,
          expansionDepth
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.graphData) {
        console.log('📊 Original graph analysis result:', result.graphData);
        
        // 保存原始论文 URLs，用于 Prior/Derivative Works 功能
        setOriginalPaperUrls(validUrls);
        
        // 保存 Prior Works 和 Derivative Works 数据
        if (result.originalPapers) {
          console.log('📚 Received Prior/Derivative Works data:', result.originalPapers);
          setPriorWorksData(result.originalPapers.priorWorks || {});
          setDerivativeWorksData(result.originalPapers.derivativeWorks || {});
          
          // 合并所有原始论文的 Prior Works（去重并计算统计信息）
          const mergedPriorWorks: Map<string, any> = new Map();
          Object.values(result.originalPapers.priorWorks || {}).flat().forEach((work: any) => {
            const key = work.id || work.title;
            if (!mergedPriorWorks.has(key)) {
              mergedPriorWorks.set(key, work);
            } else {
              // 如果已存在，合并信息（保留更完整的数据）
              const existing = mergedPriorWorks.get(key);
              mergedPriorWorks.set(key, {
                ...existing,
                ...work,
                // 保留更多的作者信息
                authors: work.authors?.length > existing.authors?.length ? work.authors : existing.authors
              });
            }
          });
          
          // 计算每个 prior work 的 graph citations 和 strength
          const priorWorksWithStats = Array.from(mergedPriorWorks.values()).map((work: any) => {
            // 在图中查找匹配的节点（通过标题相似度匹配）
            const matchingNodes = result.graphData.nodes.filter((node: any) => {
              const nodeTitle = (node.title || '').toLowerCase().trim();
              const workTitle = (work.title || '').toLowerCase().trim();
              // 精确匹配或包含匹配
              return nodeTitle === workTitle || 
                     nodeTitle.includes(workTitle.substring(0, 30)) || 
                     workTitle.includes(nodeTitle.substring(0, 30));
            });
            
            // 从匹配的节点中获取 citationCount（如果 work 本身没有）
            let citationCount = work.citationCount;
            if ((citationCount === undefined || citationCount === null) && matchingNodes.length > 0) {
              // 尝试从第一个匹配的节点获取 citationCount
              const firstMatchingNode = matchingNodes[0];
              if (firstMatchingNode.citationCount !== undefined && firstMatchingNode.citationCount !== null) {
                citationCount = firstMatchingNode.citationCount;
                console.log(`📊 Using citationCount from graph node for "${work.title?.substring(0, 50)}...": ${citationCount}`);
              }
            }
            
            // 计算在图中被引用的次数（graph citations）
            // 统计有多少条边指向这些匹配的节点
            let graphCitations = 0;
            let totalStrength = 0;
            let strengthCount = 0;
            
            matchingNodes.forEach((matchingNode: any) => {
              const nodeId = matchingNode.id;
              
              // 查找指向这个节点的边（作为 target）
              const incomingEdges = result.graphData.edges.filter((edge: any) => {
                const targetId = typeof edge.target === 'string' ? edge.target : edge.target?.id;
                return targetId === nodeId;
              });
              
              graphCitations += incomingEdges.length;
              
              // 计算这些边的平均 strength
              incomingEdges.forEach((edge: any) => {
                if (edge.strength !== undefined && edge.strength !== null) {
                  totalStrength += edge.strength;
                  strengthCount++;
                }
              });
            });
            
            // 如果没有找到匹配的节点，尝试通过标题在 edges 的 evidence 中查找
            if (graphCitations === 0) {
              const workTitleLower = (work.title || '').toLowerCase();
              const relatedEdges = result.graphData.edges.filter((edge: any) => {
                const evidence = (edge.evidence || '').toLowerCase();
                const description = (edge.description || '').toLowerCase();
                return evidence.includes(workTitleLower.substring(0, 20)) || 
                       description.includes(workTitleLower.substring(0, 20));
              });
              
              graphCitations = relatedEdges.length;
              relatedEdges.forEach((edge: any) => {
                if (edge.strength !== undefined && edge.strength !== null) {
                  totalStrength += edge.strength;
                  strengthCount++;
                }
              });
            }
            
            // 计算 strength：基于在 graph 中被引用的次数（graphCitations）
            // strength = 标准化到 0-1 范围，使用对数缩放以获得更好的分布
            // 最大值设为 graph 中总节点数的某个比例（例如 30%），作为 1.0 的参考
            const maxExpectedCitations = Math.max(1, Math.ceil(result.graphData.nodes.length * 0.3));
            let calculatedStrength = 0;
            
            if (graphCitations > 0) {
              // 使用对数缩放：log(1 + citations) / log(1 + maxExpected)
              // 这样即使只有少量引用也能有非零的 strength，但不会过高
              calculatedStrength = Math.min(1.0, 
                Math.log(1 + graphCitations) / Math.log(1 + maxExpectedCitations)
              );
            }
            
            // 如果找到了 edges 且有 average edge strength，可以结合两者
            // 70% 权重给 graph citations，30% 权重给 edge strength
            const avgEdgeStrength = strengthCount > 0 ? totalStrength / strengthCount : 0;
            const finalStrength = calculatedStrength > 0 && avgEdgeStrength > 0
              ? calculatedStrength * 0.7 + avgEdgeStrength * 0.3
              : calculatedStrength || avgEdgeStrength;
            
            return {
              ...work,
              graphCitations: graphCitations,
              strength: finalStrength,
              // 使用从 graph 节点获取的 citationCount（如果有）
              citationCount: citationCount,
              totalCitations: citationCount || 0
            };
          });
          
          setAllPriorWorks(priorWorksWithStats);
          
          // 合并所有原始论文的 Derivative Works（去重），并计算 strength
          const mergedDerivativeWorks: Map<string, any> = new Map();
          Object.values(result.originalPapers.derivativeWorks || {}).flat().forEach((work: any) => {
            const key = work.id || work.title;
            if (!mergedDerivativeWorks.has(key)) {
              mergedDerivativeWorks.set(key, work);
            }
          });
          
          console.log(`📚 [FRONTEND] Processing ${mergedDerivativeWorks.size} derivative works. CitationCount summary:`, {
            total: mergedDerivativeWorks.size,
            withCitationCount: Array.from(mergedDerivativeWorks.values()).filter((w: any) => 
              w.citationCount !== undefined && w.citationCount !== null
            ).length,
            withoutCitationCount: Array.from(mergedDerivativeWorks.values()).filter((w: any) => 
              w.citationCount === undefined || w.citationCount === null
            ).length,
            sample: Array.from(mergedDerivativeWorks.values()).slice(0, 3).map((w: any) => ({
              title: w.title?.substring(0, 40),
              citationCount: w.citationCount
            }))
          });
          
          // 计算每个 derivative work 的 strength
          // Derivative works 是引用原始论文的论文，通常不在 graph 中
          // Strength 应该基于该 derivative work 的重要性，而不是它在 graph 中的连接情况
          const derivativeWorksWithStrength = Array.from(mergedDerivativeWorks.values()).map((work: any, index: number) => {
            const workId = work.id;
            
            // 在图中查找匹配的节点（通过 ID 或标题相似度匹配），用于获取 citationCount
            const matchingNodes = result.graphData.nodes.filter((node: any) => {
              const nodeId = node.id;
              const nodeTitle = (node.title || '').toLowerCase().trim();
              const workTitleTrimmed = (work.title || '').toLowerCase().trim();
              // 通过 ID 匹配或标题相似度匹配
              return nodeId === workId || 
                     nodeTitle === workTitleTrimmed ||
                     nodeTitle.includes(workTitleTrimmed.substring(0, 30)) || 
                     workTitleTrimmed.includes(nodeTitle.substring(0, 30));
            });
            
            // 从匹配的节点中获取 citationCount（如果 work 本身没有）
            let citationCount = work.citationCount;
            if ((citationCount === undefined || citationCount === null) && matchingNodes.length > 0) {
              // 尝试从第一个匹配的节点获取 citationCount
              const firstMatchingNode = matchingNodes[0];
              if (firstMatchingNode.citationCount !== undefined && firstMatchingNode.citationCount !== null) {
                citationCount = firstMatchingNode.citationCount;
                console.log(`📊 Using citationCount from graph node for derivative work "${work.title?.substring(0, 50)}...": ${citationCount}`);
              }
            }
            
            // 对于 derivative works，strength 应该基于：
            // 1. 它在 graph 中是否出现（如果出现，说明它也很重要）
            // 2. 它的 citationCount（引用次数越多，越重要）
            // 3. 它在 Semantic Scholar 返回结果中的位置（越靠前越重要）
            
            const graphNodeIds = new Set(result.graphData.nodes.map((n: any) => n.id));
            const isInGraph = graphNodeIds.has(workId);
            
            // 计算基于 citationCount 的 strength
            // 使用对数缩放，将 citationCount 映射到 0-1 范围
            let citationBasedStrength = 0;
            if (citationCount !== undefined && citationCount !== null && citationCount > 0) {
              // 找到所有 derivative works 中最大的 citationCount 作为参考
              const allCitationCounts = Array.from(mergedDerivativeWorks.values())
                .map((w: any) => w.citationCount || 0)
                .filter((count: number) => count > 0);
              
              if (allCitationCounts.length > 0) {
                const maxCitationCount = Math.max(...allCitationCounts);
                if (maxCitationCount > 0) {
                  // 使用对数缩放，使得即使 citationCount 差异很大，也能有合理的分布
                  citationBasedStrength = Math.min(1.0,
                    Math.log(1 + citationCount) / Math.log(1 + maxCitationCount)
                  );
                }
              }
            }
            
            // 如果 derivative work 也在 graph 中，给它额外的权重
            const graphPresenceBonus = isInGraph ? 0.3 : 0;
            
            // 基于在 Semantic Scholar 结果中的位置（如果可以根据顺序推断）
            // 由于我们没有明确的排名信息，可以基于它在数组中的顺序
            // 越早出现的 derivative works（从不同原始论文获取的），可能越相关
            const totalDerivativeWorks = mergedDerivativeWorks.size;
            const positionFactor = totalDerivativeWorks > 1 
              ? 1 - (index / (totalDerivativeWorks - 1)) * 0.2  // 第一个有 1.0，最后一个有 0.8
              : 1.0;
            
            // 最终 strength：结合 citationCount、graph 存在性和位置因素
            let finalStrength = citationBasedStrength * positionFactor + graphPresenceBonus;
            
            // 如果没有任何信息（citationCount 也没有），使用一个基于位置的最低 strength
            if (finalStrength === 0) {
              finalStrength = 0.3 * positionFactor; // 最低 0.24 (0.3 * 0.8) 到 0.3
            }
            
            // 确保 strength 在 0-1 范围内
            finalStrength = Math.max(0, Math.min(1.0, finalStrength));
            
            return {
              ...work,
              graphCitations: 0, // Derivative works 通常不在 graph 中，所以 graphCitations 为 0
              strength: finalStrength,
              // 使用从 graph 节点获取的 citationCount（如果有）
              citationCount: citationCount
            };
          });
          
          setAllDerivativeWorks(derivativeWorksWithStrength);
          
          console.log(`✅ Merged ${mergedPriorWorks.size} prior works and ${mergedDerivativeWorks.size} derivative works`);
        }
        
        // 添加詳細的節點數據調試日誌
        console.log('🔍 [FRONTEND DEBUG] Received nodes with citation data:',
          result.graphData.nodes.map((node: any) => ({
            id: node.id,
            title: node.title?.substring(0, 50) + '...',
            citationCount: node.citationCount,
            paperCitationCount: node.paperCitationCount
          }))
        );
        
        // 直接使用原始數據，暫時跳過增強功能
        setGraphData(result.graphData);
        console.log('✅ Graph data set successfully');
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Citation extraction
  const extractCitations = async () => {
    if (!citationUrl.trim()) return;

    setIsExtracting(true);
    setShowAllCitations(false); // Reset expand state when extracting new citations
    try {
      const response = await fetch(`${API_BASE_URL}/api/grobid/extract-citations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: citationUrl,
          filterSections
        })
      });

      if (!response.ok) {
        throw new Error('Citation extraction failed');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Citation extraction failed');
      }
      
      if (!data.citations || data.citations.length === 0) {
        setCitationResults('No citations found.');
      } else {
        // 统一格式：编号. 标题 (作者1, 作者2, ...) - 年份
        const formattedCitations = data.citations.map((c: Citation, index: number) => {
          const title = c.title || 'Unknown Title';
          const authors = c.authors && c.authors.length > 0 
            ? c.authors.join(', ') 
            : 'Unknown authors';
          const year = c.year || 'Unknown year';
          return `${index + 1}. ${title} (${authors}) - ${year}`;
        });
        setCitationResults(formattedCitations.join('\n'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Extraction failed';
      console.error('Citation extraction error:', err);
      setCitationResults(`Error: ${errorMessage}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // TODO: Obsidian sync functionality can be added later if needed

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#1e1e1e' }}>
      {/* Main Content Area - Uses flex-1 to automatically adjust height based on bottom section */}
      <div className={`flex-1 min-h-0 grid gap-1 overflow-hidden ${
        isConfigCollapsed 
          ? (showGuideSidebar ? 'grid-cols-[50px_1fr_350px]' : 'grid-cols-[50px_1fr]')
          : (showGuideSidebar ? 'grid-cols-[320px_1fr_350px]' : 'grid-cols-[320px_1fr]')
      }`}>
        
        {/* Left Column - Configuration */}
        <div className="h-full flex flex-col overflow-hidden min-w-0">
          {/* Analysis Configuration - Professional scrollable panel with Tailwind classes */}
          <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-5 shadow-xl 
                         bg-gradient-to-br from-obsidian-card to-obsidian-hover
                         border-r-2 border-obsidian-border 
                         rounded-tl-2xl rounded-bl-2xl
                         scrollbar-academic transition-all duration-300">
          {/* Header Section - Professional academic styling */}
          <div className="flex items-center justify-between mb-5 pb-3 border-b-2" style={{ borderColor: 'rgba(100, 200, 100, 0.3)' }}>
            {!isConfigCollapsed && (
              <h2 className="text-lg font-semibold tracking-wide" style={{ color: '#e8e8e8', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                Analysis Configuration
              </h2>
            )}
            <button
              onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
              className="ml-auto px-3 py-1.5 rounded-lg 
                         text-sm font-medium
                         style={{ backgroundColor: '#2d2d2d', color: '#64c864', border: '1px solid rgba(100, 200, 100, 0.2)' }}
                         onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                         onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                         transition-all duration-200 hover:shadow-md active:scale-95"
              title={isConfigCollapsed ? "Expand configuration panel" : "Collapse configuration panel"}
            >
              {isConfigCollapsed ? '▶' : '◀'}
            </button>
          </div>
          
          {!isConfigCollapsed && (
            <>
          {/* URL Input Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium" style={{ color: '#e8e8e8' }}>Paper URLs</h3>
              <button
                onClick={fillExampleUrls}
                className="px-2 py-1 text-xs rounded hover:opacity-90 transition-colors"
                style={{
                  backgroundColor: '#2d2d2d',
                  color: '#64c864',
                  border: '1px solid rgba(100, 200, 100, 0.2)'
                }}
              >
                <EditIcon className="w-3 h-3 mr-1" /> Examples
              </button>
            </div>
            
            {urls.map((url, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <div className="flex-1 relative">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    placeholder={`Paper ${index + 1} URL`}
                    className="form-input w-full text-sm focus:outline-none"
                    style={{
                      borderColor: 'rgba(100, 200, 100, 0.2)',
                      backgroundColor: '#252525',
                      color: '#e8e8e8'
                    }}
                  />
                </div>
                {urls.length > 2 && (
                  <button
                    onClick={() => removeUrl(index)}
                    className="px-2 py-2 rounded text-xs hover:opacity-90"
                    title="Remove"
                    style={{
                      backgroundColor: '#2d2d2d',
                      color: '#e8e8e8',
                      border: '1px solid rgba(100, 200, 100, 0.2)'
                    }}
                  >
                    <DeleteIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            
            <button
              onClick={addUrl}
              className="w-full py-2 border border-dashed rounded text-sm transition-colors"
              style={{
                borderColor: 'rgba(100, 200, 100, 0.3)',
                color: '#b8b8b8',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
                e.currentTarget.style.color = '#64c864';
                e.currentTarget.style.backgroundColor = '#2d2d2d';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
                e.currentTarget.style.color = '#b8b8b8';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <AddIcon className="w-4 h-4 mr-1 inline" /> Add Paper
            </button>
          </div>

          {/* Filter Toggle */}
          <div className="mb-4 p-3 rounded border" style={{
            backgroundColor: '#252525',
            borderColor: 'rgba(100, 200, 100, 0.2)'
          }}>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="filterSections"
                checked={filterSections}
                onChange={(e) => setFilterSections(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: '#64c864' }}
              />
              <label htmlFor="filterSections" className="text-xs font-medium" style={{ 
                color: '#e8e8e8',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                <FilterListIcon className="w-4 h-4 mr-1 inline" /> Smart Section Filter
              </label>
            </div>
            <p className="text-xs mt-1" style={{ color: '#b8b8b8' }}>
              {filterSections 
                ? 'Analyze key sections only (recommended)'
                : 'Analyze all sections'
              }
            </p>
          </div>

          {/* Network Expansion Depth */}
          <div className="mb-4 p-3 rounded border" style={{
            backgroundColor: '#2d2d2d',
            borderColor: 'rgba(100, 200, 100, 0.3)'
          }}>
            <span className="text-xs font-medium block mb-2" style={{ 
              color: '#e8e8e8',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              <NetworkCheckIcon className="w-4 h-4 mr-1 inline" /> Network Depth
            </span>
            <div className="space-y-2">
              {[0, 1, 2].map((depth) => (
                <label key={depth} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="expansionDepth"
                    value={depth}
                    checked={expansionDepth === depth}
                    onChange={(e) => setExpansionDepth(parseInt(e.target.value))}
                    className="w-3 h-3"
                    style={{ accentColor: '#64c864' }}
                  />
                  <span className="text-xs" style={{ color: '#b8b8b8' }}>
                    {depth === 0 && 'Source only'}
                    {depth === 1 && '1 layer deep'}
                    {depth === 2 && '2 layers deep'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Citation Extractor Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowCitationExtractor(!showCitationExtractor)}
              className="flex items-center justify-between w-full p-3 border rounded text-sm transition-colors"
              style={{
                backgroundColor: '#2d2d2d',
                borderColor: 'rgba(100, 200, 100, 0.3)',
                color: '#e8e8e8',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#252525';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2d2d2d';
              }}
            >
              <span className="font-medium flex items-center gap-2">
                <DescriptionIcon className="w-4 h-4" /> Citation Extractor
              </span>
              {showCitationExtractor ? (
                <ExpandMoreIcon className="w-4 h-4" style={{ color: '#b8b8b8' }} />
              ) : (
                <ExpandLessIcon className="w-4 h-4 rotate-180" style={{ color: '#b8b8b8' }} />
              )}
            </button>

            {showCitationExtractor && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={citationUrl}
                    onChange={(e) => setCitationUrl(e.target.value)}
                    placeholder="Paper URL for citation extraction"
                    className="form-input flex-1 text-sm focus:outline-none"
                    style={{
                      borderColor: 'rgba(100, 200, 100, 0.3)',
                      backgroundColor: '#2d2d2d',
                      color: '#e8e8e8',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                  />
                  <button
                    onClick={extractCitations}
                    disabled={isExtracting || !citationUrl}
                    className="btn-primary px-3 py-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all duration-200"
                    style={{
                      background: isExtracting || !citationUrl 
                        ? '#252525' 
                        : 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)',
                      color: isExtracting || !citationUrl ? '#888888' : '#1e1e1e',
                      borderRadius: '8px',
                      border: isExtracting || !citationUrl ? '1px solid rgba(100, 200, 100, 0.2)' : 'none',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      minWidth: '90px',
                      cursor: isExtracting || !citationUrl ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      boxShadow: isExtracting || !citationUrl ? 'none' : '0 2px 8px rgba(100, 200, 100, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isExtracting && citationUrl) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(100, 200, 100, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isExtracting && citationUrl) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(100, 200, 100, 0.3)';
                      }
                    }}
                  >
                    {isExtracting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#1e1e1e' }}>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: '#1e1e1e' }}></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ color: '#F5F5DC' }}></path>
                        </svg>
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <span>Extract</span>
                    )}
                  </button>
                </div>
                
                {citationResults && (
                  <div className="max-h-40 overflow-y-auto p-3 rounded text-xs" style={{
                    backgroundColor: '#252525',
                    border: '1px solid rgba(100, 200, 100, 0.3)',
                    borderRadius: '8px'
                  }}>
                    <h4 className="font-semibold mb-2" style={{ 
                      color: '#e8e8e8',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>Extracted Citations ({citationResults.split('\n').length}):</h4>
                    <div className="space-y-1" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      {(() => {
                        const citationsList = citationResults.split('\n');
                        const displayCount = showAllCitations ? citationsList.length : Math.min(20, citationsList.length);
                        const remainingCount = citationsList.length - 20;
                        
                        return (
                          <>
                            {citationsList.slice(0, displayCount).map((citation, index) => (
                              <div key={index} style={{ color: '#707C5D', lineHeight: '1.4' }}>
                                {citation}
                              </div>
                            ))}
                            {remainingCount > 0 && !showAllCitations && (
                              <div 
                                style={{ 
                                  color: '#64c864', 
                                  fontWeight: '600',
                                  marginTop: '4px',
                                  cursor: 'pointer',
                                  textDecoration: 'underline'
                                }}
                                onClick={() => setShowAllCitations(true)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#4ade80';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#BDB4D3';
                                }}
                              >
                                ... and {remainingCount} more citations
                  </div>
                )}
                            {showAllCitations && remainingCount > 0 && (
                              <div 
                                style={{ 
                                  color: '#64c864', 
                                  fontWeight: '600',
                                  marginTop: '4px',
                                  cursor: 'pointer',
                                  textDecoration: 'underline'
                                }}
                                onClick={() => setShowAllCitations(false)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#4ade80';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#BDB4D3';
                                }}
                              >
                                Show less
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Obsidian Sync Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowObsidianSync(!showObsidianSync)}
              className="flex items-center justify-between w-full p-3 border rounded text-sm transition-colors"
              style={{
                backgroundColor: '#2d2d2d',
                borderColor: 'rgba(100, 200, 100, 0.3)',
                color: '#e8e8e8',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#252525';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2d2d2d';
              }}
            >
              <span className="font-medium flex items-center gap-2">
                <SyncIcon className="w-4 h-4" /> Obsidian Sync
              </span>
              {showObsidianSync ? (
                <ExpandMoreIcon className="w-4 h-4" style={{ color: '#b8b8b8' }} />
              ) : (
                <ExpandLessIcon className="w-4 h-4 rotate-180" style={{ color: '#b8b8b8' }} />
              )}
            </button>

            {showObsidianSync && (
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={obsidianPath}
                    onChange={(e) => setObsidianPath(e.target.value)}
                    placeholder="Obsidian vault path"
                    className="form-input w-full text-sm focus:outline-none"
                    style={{
                      borderColor: 'rgba(100, 200, 100, 0.3)',
                      backgroundColor: '#2d2d2d',
                      color: '#e8e8e8',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                  />
                  <input
                    type="text"
                    value={obsidianSubfolder}
                    onChange={(e) => setObsidianSubfolder(e.target.value)}
                    placeholder="Subfolder name (optional)"
                    className="form-input w-full text-sm focus:outline-none"
                    style={{
                      borderColor: 'rgba(100, 200, 100, 0.3)',
                      backgroundColor: '#2d2d2d',
                      color: '#e8e8e8',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={isLoading || urls.filter(u => u.trim()).length === 0}
            className="w-full px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            style={{
              background: isLoading || urls.filter(u => u.trim()).length === 0 
                ? '#252525' 
                : 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)',
              color: isLoading || urls.filter(u => u.trim()).length === 0 ? '#888888' : '#1e1e1e',
              opacity: isLoading || urls.filter(u => u.trim()).length === 0 ? 0.6 : 1,
              borderRadius: '8px',
              border: isLoading || urls.filter(u => u.trim()).length === 0 ? '1px solid rgba(100, 200, 100, 0.2)' : 'none',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              cursor: isLoading || urls.filter(u => u.trim()).length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              boxShadow: isLoading || urls.filter(u => u.trim()).length === 0 ? 'none' : '0 2px 8px rgba(100, 200, 100, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!isLoading && urls.filter(u => u.trim()).length > 0) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(100, 200, 100, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && urls.filter(u => u.trim()).length > 0) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(100, 200, 100, 0.3)';
              }
            }}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#1e1e1e' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: '#1e1e1e' }}></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ color: '#1e1e1e' }}></path>
                </svg>
                <span>Analyzing Papers...</span>
              </>
            ) : (
              <span>Start Analysis</span>
            )}
          </button>
          </>
          )}
          </div>
        </div>

        {/* Right Column - Main Content with Mode Switching */}
        <div className="h-full overflow-hidden relative flex flex-col" style={{ backgroundColor: '#1e1e1e' }}>
          {/* Guide Toggle Button - Fixed at top right */}
          <button
            onClick={() => setShowGuideSidebar(!showGuideSidebar)}
            className="absolute top-4 right-4 z-50 px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
            style={{
              backgroundColor: showGuideSidebar ? '#64c864' : '#2d2d2d',
              color: showGuideSidebar ? '#1e1e1e' : '#64c864',
              border: '1px solid rgba(100, 200, 100, 0.3)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: showGuideSidebar ? '0 2px 8px rgba(100, 200, 100, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!showGuideSidebar) {
                e.currentTarget.style.backgroundColor = '#252525';
                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showGuideSidebar) {
                e.currentTarget.style.backgroundColor = '#2d2d2d';
                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
              }
            }}
          >
            <BookIcon className="w-4 h-4" />
            <span>{showGuideSidebar ? 'Hide Guide' : 'Show Guide'}</span>
          </button>
        {/* Header with Mode Tabs */}
        {graphData && (
          <div className="border-b" style={{ 
            borderColor: 'rgba(100, 200, 100, 0.3)',
            background: 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)'
          }}>
            <div className="flex items-center justify-center border-b" style={{ borderColor: '#A39A86' }}>
              <button
                onClick={() => setViewMode('graph')}
                className="px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'graph' ? '#2d2d2d' : 'transparent',
                  color: viewMode === 'graph' ? '#64c864' : '#e8e8e8',
                  borderBottom: viewMode === 'graph' ? '2px solid rgba(100, 200, 100, 0.5)' : '2px solid transparent',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
                }}
              >
                <BarChartIcon className="w-4 h-4 mr-1 inline" /> Graph
              </button>
              <button
                onClick={() => setViewMode('prior-works')}
                className="px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'prior-works' ? '#2d2d2d' : 'transparent',
                  color: viewMode === 'prior-works' ? '#64c864' : '#e8e8e8',
                  borderBottom: viewMode === 'prior-works' ? '2px solid #BDB4D3' : '2px solid transparent',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              >
                <MenuBookIcon className="w-4 h-4 mr-1 inline" /> Prior Works ({allPriorWorks.length})
              </button>
              <button
                onClick={() => setViewMode('derivative-works')}
                className="px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'derivative-works' ? '#2d2d2d' : 'transparent',
                  color: viewMode === 'derivative-works' ? '#64c864' : '#e8e8e8',
                  borderBottom: viewMode === 'derivative-works' ? '2px solid #BDB4D3' : '2px solid transparent',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              >
                <LinkIcon className="w-4 h-4 mr-1 inline" /> Derivative Works ({allDerivativeWorks.length})
              </button>
            </div>
          </div>
        )}
        
        {/* Content Area - Switch based on view mode */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'graph' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Progress display - always show when loading, positioned appropriately */}
              {isLoading && (
                <div style={{
                  position: graphData ? 'absolute' : 'relative',
                  top: graphData ? '20px' : '20px',
                  left: graphData ? '20px' : '20px',
                  right: graphData ? '20px' : 'auto',
                  zIndex: graphData ? 1000 : 10,
                  width: graphData ? 'auto' : 'calc(100% - 40px)',
                  maxWidth: '500px',
                  margin: graphData ? '0' : '0'
                }}>
                  <AnalysisProgress
                    progress={progress}
                    progressInfo={progressInfo}
                    isOverlay={!!graphData} // Overlay mode if graph already exists
                  />
                </div>
              )}
              
              {/* Graph visualization */}
              {graphData ? (
                <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
                  <GraphVisualization 
                    data={graphData} 
                    onDataUpdate={setGraphData}
                    isLoading={isLoading}
                  />
                </div>
              ) : (
                /* Empty state when no graph and not loading */
                !isLoading && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#b8b8b8',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '18px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ marginBottom: '12px' }}>No graph data available</p>
                      <p style={{ fontSize: '14px', opacity: 0.7 }}>Click "Start Analysis" to begin</p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
          
          {viewMode === 'prior-works' && (
            <div className="h-full overflow-y-auto p-6" style={{ backgroundColor: '#1e1e1e' }}>
            <div className="mb-4">
                    <h2 className="text-xl font-bold mb-2" style={{ color: '#e8e8e8', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                      Prior Works
                    </h2>
                    <p className="text-sm mb-4" style={{ color: '#b8b8b8' }}>
                      These are papers that were most commonly cited by the papers in the graph.
                      This usually means that they are <strong>important seminal works</strong> for this field and it could be a good idea to get familiar with them.
                  </p>
                </div>
                  
                  {allPriorWorks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ backgroundColor: '#1e1e1e' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid rgba(100, 200, 100, 0.3)', backgroundColor: '#252525' }}>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-obsidian-hover transition-colors" 
                              style={{ color: '#e8e8e8' }}
                              onClick={() => {
                                if (priorWorksSortField === 'title') {
                                  setPriorWorksSortDirection(priorWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPriorWorksSortField('title');
                                  setPriorWorksSortDirection('asc');
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>Title</span>
                                <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9', marginLeft: '2px' }}>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'title' && priorWorksSortDirection === 'asc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'title' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▼
                                  </span>
                </div>
            </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold select-none" 
                              style={{ color: '#e8e8e8' }}
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="cursor-pointer hover:bg-obsidian-hover transition-colors px-1 py-1 rounded flex items-center gap-2"
                                  onClick={() => {
                                    if (priorWorksSortField === 'lastAuthor') {
                                      setPriorWorksSortDirection(priorWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                    } else {
                                      setPriorWorksSortField('lastAuthor');
                                      setPriorWorksSortDirection('asc');
                                    }
                                  }}
                                >
                                  <div style={{ lineHeight: '1.2' }}>
                                    <div>{showFirstAuthor ? 'First' : 'Last'}</div>
                                    <div style={{ marginLeft: showFirstAuthor ? '12px' : '8px' }}>author</div>
                                  </div>
                                  
                                  {/* Sort Indicator */}
                                  <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9' }}>
                                    <span 
                                      style={{ 
                                        opacity: priorWorksSortField === 'lastAuthor' && priorWorksSortDirection === 'asc' ? 1 : 0.3,
                                        color: '#e8e8e8'
                                      }}
                                    >
                                      ▲
                                    </span>
                                    <span 
                                      style={{ 
                                        opacity: priorWorksSortField === 'lastAuthor' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                        color: '#e8e8e8'
                                      }}
                                    >
                                      ▼
                                    </span>
            </div>
          </div>
                                
                                {/* Toggle Switch - White circle on left/right */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFirstAuthor(!showFirstAuthor);
                                  }}
                                  className="flex items-center justify-start rounded-full transition-all duration-200 relative"
                                  style={{
                                    width: '36px',
                                    height: '20px',
                                    backgroundColor: showFirstAuthor ? '#64c864' : '#2d2d2d',
                                    padding: '2px',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  title={showFirstAuthor ? 'Switch to Last author' : 'Switch to First author'}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = showFirstAuthor ? '#4ade80' : '#252525';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = showFirstAuthor ? '#64c864' : '#2d2d2d';
                                  }}
                                >
                                  <div 
                                    className="absolute rounded-full bg-white shadow-sm transition-all duration-200"
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      left: showFirstAuthor ? '18px' : '2px',
                                      top: '2px'
                                    }}
                                  />
                                </button>
        </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-obsidian-hover transition-colors" 
                              style={{ color: '#e8e8e8' }}
                              onClick={() => {
                                if (priorWorksSortField === 'year') {
                                  setPriorWorksSortDirection(priorWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPriorWorksSortField('year');
                                  setPriorWorksSortDirection('desc');
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>Year</span>
                                <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9', marginLeft: '2px' }}>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'year' && priorWorksSortDirection === 'asc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'year' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▼
                                  </span>
      </div>
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-obsidian-hover transition-colors" 
                              style={{ color: '#e8e8e8' }}
                              onClick={() => {
                                if (priorWorksSortField === 'citation') {
                                  setPriorWorksSortDirection(priorWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPriorWorksSortField('citation');
                                  setPriorWorksSortDirection('desc');
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>Citation</span>
                                <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9', marginLeft: '2px' }}>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'citation' && priorWorksSortDirection === 'asc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'citation' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▼
                                  </span>
                                </div>
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-obsidian-hover transition-colors" 
                              style={{ color: '#e8e8e8' }}
                              onClick={() => {
                                if (priorWorksSortField === 'strength') {
                                  setPriorWorksSortDirection(priorWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPriorWorksSortField('strength');
                                  setPriorWorksSortDirection('desc');
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>Strength</span>
                                <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9', marginLeft: '2px' }}>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'strength' && priorWorksSortDirection === 'asc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'strength' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▼
                                  </span>
                                </div>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...allPriorWorks]
                            .sort((a, b) => {
                              let aVal: any, bVal: any;
                              
                              switch (priorWorksSortField) {
                                case 'title':
                                  aVal = (a.title || '').toLowerCase();
                                  bVal = (b.title || '').toLowerCase();
                                  break;
                                case 'lastAuthor':
                                  const aAuthor = a.authors && a.authors.length > 0 
                                    ? (showFirstAuthor ? a.authors[0] : a.authors[a.authors.length - 1])
                                    : '';
                                  const bAuthor = b.authors && b.authors.length > 0 
                                    ? (showFirstAuthor ? b.authors[0] : b.authors[b.authors.length - 1])
                                    : '';
                                  aVal = aAuthor.toLowerCase();
                                  bVal = bAuthor.toLowerCase();
                                  break;
                                case 'year':
                                  aVal = parseInt(a.year || '0') || 0;
                                  bVal = parseInt(b.year || '0') || 0;
                                  break;
                                case 'citation':
                                  aVal = a.citationCount !== undefined ? a.citationCount : 0;
                                  bVal = b.citationCount !== undefined ? b.citationCount : 0;
                                  break;
                                case 'strength':
                                  aVal = a.strength || 0;
                                  bVal = b.strength || 0;
                                  break;
                                default:
                                  return 0;
                              }
                              
                              if (aVal < bVal) return priorWorksSortDirection === 'asc' ? -1 : 1;
                              if (aVal > bVal) return priorWorksSortDirection === 'asc' ? 1 : -1;
                              return 0;
                            })
                            .map((work, idx) => (
                            <tr 
                              key={work.id || idx}
                              className="hover:bg-obsidian-hover transition-colors"
                              style={{ borderBottom: '1px solid rgba(100, 200, 100, 0.1)' }}
                            >
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.title || 'Unknown Title'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.authors && work.authors.length > 0 
                                  ? (showFirstAuthor ? work.authors[0] : work.authors[work.authors.length - 1])
                                  : 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.year || 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.citationCount !== undefined ? work.citationCount.toLocaleString() : 'N/A'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.strength !== undefined ? work.strength.toFixed(3) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
        </div>
                  ) : (
                    <div className="text-center py-12" style={{ color: '#b8b8b8' }}>
                      <p>No prior works found.</p>
                </div>
              )}
            </div>
          )}
          
          {viewMode === 'derivative-works' && (
                <div className="h-full overflow-y-auto p-6" style={{ backgroundColor: '#1e1e1e' }}>
                  <div className="mb-4">
                    <h2 className="text-xl font-bold mb-2" style={{ color: '#e8e8e8', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                      Derivative Works
                    </h2>
                    <p className="text-sm mb-4" style={{ color: '#b8b8b8' }}>
                      These are papers that cited many of the papers in the graph.
                      This usually means that they are either <strong>surveys of the field or recent relevant works</strong> which were inspired by many papers in the graph.
                    </p>
            </div>
        
                  {allDerivativeWorks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ backgroundColor: '#1e1e1e' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid rgba(100, 200, 100, 0.3)', backgroundColor: '#252525' }}>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-obsidian-hover transition-colors" 
                              style={{ color: '#e8e8e8' }}
                              onClick={() => {
                                if (derivativeWorksSortField === 'title') {
                                  setDerivativeWorksSortDirection(derivativeWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setDerivativeWorksSortField('title');
                                  setDerivativeWorksSortDirection('asc');
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>Title</span>
                                <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9', marginLeft: '2px' }}>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'title' && derivativeWorksSortDirection === 'asc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'title' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▼
                                  </span>
          </div>
        </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold select-none" 
                              style={{ color: '#e8e8e8' }}
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="cursor-pointer hover:bg-obsidian-hover transition-colors px-1 py-1 rounded flex items-center gap-2"
                                  onClick={() => {
                                    if (derivativeWorksSortField === 'lastAuthor') {
                                      setDerivativeWorksSortDirection(derivativeWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                    } else {
                                      setDerivativeWorksSortField('lastAuthor');
                                      setDerivativeWorksSortDirection('asc');
                                    }
                                  }}
                                >
                                  <div style={{ lineHeight: '1.2' }}>
                                    <div>{showDerivativeFirstAuthor ? 'First' : 'Last'}</div>
                                    <div style={{ marginLeft: showDerivativeFirstAuthor ? '12px' : '8px' }}>author</div>
      </div>

                                  {/* Sort Indicator */}
                                  <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9' }}>
                                    <span 
                                      style={{ 
                                        opacity: derivativeWorksSortField === 'lastAuthor' && derivativeWorksSortDirection === 'asc' ? 1 : 0.3,
                                        color: '#e8e8e8'
                                      }}
                                    >
                                      ▲
                                    </span>
                                    <span 
                                      style={{ 
                                        opacity: derivativeWorksSortField === 'lastAuthor' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                        color: '#e8e8e8'
                                      }}
                                    >
                                      ▼
                                    </span>
                                  </div>
        </div>
        
                                {/* Toggle Switch - White circle on left/right */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDerivativeFirstAuthor(!showDerivativeFirstAuthor);
                                  }}
                                  className="flex items-center justify-start rounded-full transition-all duration-200 relative"
                                  style={{
                                    width: '36px',
                                    height: '20px',
                                    backgroundColor: showDerivativeFirstAuthor ? '#64c864' : '#2d2d2d',
                                    padding: '2px',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  title={showDerivativeFirstAuthor ? 'Switch to Last author' : 'Switch to First author'}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = showDerivativeFirstAuthor ? '#4ade80' : '#252525';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = showDerivativeFirstAuthor ? '#64c864' : '#2d2d2d';
                                  }}
                                >
                                  <div 
                                    className="absolute rounded-full bg-white shadow-sm transition-all duration-200"
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      left: showDerivativeFirstAuthor ? '18px' : '2px',
                                      top: '2px'
                                    }}
                                  />
                                </button>
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-obsidian-hover transition-colors" 
                              style={{ color: '#e8e8e8' }}
                              onClick={() => {
                                if (derivativeWorksSortField === 'year') {
                                  setDerivativeWorksSortDirection(derivativeWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setDerivativeWorksSortField('year');
                                  setDerivativeWorksSortDirection('desc');
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>Year</span>
                                <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9', marginLeft: '2px' }}>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'year' && derivativeWorksSortDirection === 'asc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'year' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▼
                                  </span>
                                </div>
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-obsidian-hover transition-colors" 
                              style={{ color: '#e8e8e8' }}
                              onClick={() => {
                                if (derivativeWorksSortField === 'citation') {
                                  setDerivativeWorksSortDirection(derivativeWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setDerivativeWorksSortField('citation');
                                  setDerivativeWorksSortDirection('desc');
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>Citation</span>
                                <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9', marginLeft: '2px' }}>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'citation' && derivativeWorksSortDirection === 'asc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'citation' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▼
                                  </span>
                                </div>
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-obsidian-hover transition-colors" 
                              style={{ color: '#e8e8e8' }}
                              onClick={() => {
                                if (derivativeWorksSortField === 'strength') {
                                  setDerivativeWorksSortDirection(derivativeWorksSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setDerivativeWorksSortField('strength');
                                  setDerivativeWorksSortDirection('desc');
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>Strength</span>
                                <div className="flex flex-col" style={{ fontSize: '9px', lineHeight: '0.9', marginLeft: '2px' }}>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'strength' && derivativeWorksSortDirection === 'asc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'strength' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#e8e8e8'
                                    }}
                                  >
                                    ▼
                                  </span>
                                </div>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...allDerivativeWorks]
                            .sort((a, b) => {
                              let aVal: any, bVal: any;
                              
                              switch (derivativeWorksSortField) {
                                case 'title':
                                  aVal = (a.title || '').toLowerCase();
                                  bVal = (b.title || '').toLowerCase();
                                  break;
                                case 'lastAuthor':
                                  const aAuthor = a.authors && a.authors.length > 0 
                                    ? (showDerivativeFirstAuthor ? a.authors[0] : a.authors[a.authors.length - 1])
                                    : '';
                                  const bAuthor = b.authors && b.authors.length > 0 
                                    ? (showDerivativeFirstAuthor ? b.authors[0] : b.authors[b.authors.length - 1])
                                    : '';
                                  aVal = aAuthor.toLowerCase();
                                  bVal = bAuthor.toLowerCase();
                                  break;
                                case 'year':
                                  aVal = parseInt(a.year || '0') || 0;
                                  bVal = parseInt(b.year || '0') || 0;
                                  break;
                                case 'citation':
                                  aVal = a.citationCount !== undefined ? a.citationCount : 0;
                                  bVal = b.citationCount !== undefined ? b.citationCount : 0;
                                  break;
                                case 'strength':
                                  aVal = a.strength || 0;
                                  bVal = b.strength || 0;
                                  break;
                                default:
                                  return 0;
                              }
                              
                              if (aVal < bVal) return derivativeWorksSortDirection === 'asc' ? -1 : 1;
                              if (aVal > bVal) return derivativeWorksSortDirection === 'asc' ? 1 : -1;
                              return 0;
                            })
                            .map((work, idx) => (
                            <tr 
                              key={work.id || idx}
                              className="hover:bg-obsidian-hover transition-colors"
                              style={{ borderBottom: '1px solid rgba(100, 200, 100, 0.1)' }}
                            >
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.title || 'Unknown Title'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.authors && work.authors.length > 0 
                                  ? (showDerivativeFirstAuthor ? work.authors[0] : work.authors[work.authors.length - 1])
                                  : 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.year || 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.citationCount !== undefined ? work.citationCount.toLocaleString() : 'N/A'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.strength !== undefined ? work.strength.toFixed(2) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12" style={{ color: '#b8b8b8' }}>
                      <p>No derivative works found. This might take some time to search.</p>
                    </div>
                  )}
                </div>
              )}
          
          {!graphData && !isLoading && (
            <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#1e1e1e' }}>
              <div className="text-center" style={{ color: '#b8b8b8' }}>
                <div className="w-20 h-20 mx-auto mb-4 border-4 border-dashed rounded-full flex items-center justify-center" style={{ borderColor: 'rgba(100, 200, 100, 0.3)' }}>
                  <BarChartIcon className="w-10 h-10" style={{ color: '#64c864' }} />
                </div>
                <p className="text-lg font-medium" style={{ 
                  color: '#e8e8e8',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>Interactive Graph Area</p>
                <p className="text-sm mt-2" style={{ color: '#b8b8b8' }}>Configure analysis parameters and click "Start Analysis" to visualize paper relationships</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guide Sidebar - Right side sliding panel */}
      {showGuideSidebar && (
        <div 
          className="h-full overflow-hidden border-l-2 transition-all duration-300 ease-in-out"
          style={{
            backgroundColor: '#252525',
            borderColor: 'rgba(100, 200, 100, 0.2)',
            width: '350px',
            minWidth: '350px'
          }}
        >
          <div className="h-full overflow-y-auto scrollbar-academic p-5">
            {/* Close Button */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b-2" style={{ borderColor: 'rgba(100, 200, 100, 0.3)' }}>
              <h2 
                className="text-lg font-semibold"
                style={{
                  color: '#e8e8e8',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              >
                Guide
              </h2>
              <button
                onClick={() => setShowGuideSidebar(false)}
                className="p-1 rounded transition-colors"
                style={{
                  color: '#b8b8b8',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2d2d2d';
                  e.currentTarget.style.color = '#64c864';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#b8b8b8';
                }}
              >
                <ExpandLessIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Guide Content - Single column scrollable */}
            <div className="space-y-4">
              {/* How to Use */}
              <div className="p-4 rounded-lg border" style={{
                backgroundColor: '#2d2d2d',
                borderColor: 'rgba(100, 200, 100, 0.3)'
              }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ 
                  color: '#e8e8e8',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  <BookIcon className="w-4 h-4" />
                  How to Use
                </h3>
                <ol className="text-xs space-y-2 list-decimal list-inside" style={{ color: '#b8b8b8' }}>
                  <li>Enter paper URLs in the left panel</li>
                  <li>Configure analysis parameters:
                    <ul className="ml-4 mt-1 list-disc list-inside space-y-1">
                      <li>Smart filter: Analyze key sections only</li>
                      <li>Network depth: How deep to explore</li>
                    </ul>
                  </li>
                  <li>Click "Start Analysis" to begin</li>
                  <li>Explore the interactive graph</li>
                  <li>Use advanced tools:
                    <ul className="ml-4 mt-1 list-disc list-inside space-y-1">
                      <li>Citation Extractor: Extract citations from papers</li>
                      <li>Obsidian Sync: Export to knowledge management</li>
                    </ul>
                  </li>
                </ol>
              </div>

              {/* Key Features */}
              <div className="p-4 rounded-lg border" style={{
                backgroundColor: '#2d2d2d',
                borderColor: 'rgba(100, 200, 100, 0.3)'
              }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ 
                  color: '#e8e8e8',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  <AutoAwesomeIcon className="w-4 h-4" />
                  Key Features
                </h3>
                <ul className="text-xs space-y-2" style={{ color: '#b8b8b8' }}>
                  <li className="flex items-start">
                    <PsychologyIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#64c864' }} />
                    <div><strong>AI-Powered Analysis:</strong> Intelligent extraction of academic relationships</div>
                  </li>
                  <li className="flex items-start">
                    <HubIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#64c864' }} />
                    <div><strong>Network Visualization:</strong> Interactive graph showing citation networks</div>
                  </li>
                  <li className="flex items-start">
                    <CenterFocusStrongIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#64c864' }} />
                    <div><strong>Smart Filtering:</strong> Focus on key sections for better insights</div>
                  </li>
                  <li className="flex items-start">
                    <LayersIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#64c864' }} />
                    <div><strong>Multi-Layer Expansion:</strong> Explore citation relationships at multiple depths</div>
                  </li>
                </ul>
              </div>

              {/* Tips */}
              <div className="p-4 rounded-lg border" style={{
                backgroundColor: '#2d2d2d',
                borderColor: 'rgba(100, 200, 100, 0.3)'
              }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ 
                  color: '#e8e8e8',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  <LightbulbIcon className="w-4 h-4" />
                  Tips & Best Practices
                </h3>
                <ul className="text-xs space-y-2" style={{ color: '#b8b8b8' }}>
                  <li>• Use arxiv.org URLs for best results</li>
                  <li>• Enable smart filtering to reduce noise</li>
                  <li>• Start with depth 1 for faster analysis</li>
                  <li>• Use citation extractor for manual verification</li>
                  <li>• Export to Obsidian for long-term knowledge management</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default PaperGraphPage;
