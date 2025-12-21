import React, { useState, useEffect, useRef, useCallback } from 'react';
import GraphVisualization from '../components/GraphVisualization';
import AnalysisProgress from '../components/AnalysisProgress';
import ResizableSidebar from '../components/ResizableSidebar';
import { GraphData } from '../types/graph';
import { isAuthenticated } from '../utils/auth';
import { useLoadSession } from '../hooks/useLoadSession';
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
  AddCircleOutline as AddCircleOutlineIcon,
  Settings as SettingsIcon,
  FileCopy as CopyIcon,
} from '@mui/icons-material';

// Use relative path if VITE_API_BASE_URL is not set (development proxy)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : 'http://localhost:8080');




interface PaperGraphPageProps {
  setSessionHandler?: (handler: (sessionId: string, graphData: any) => void) => void;
}

const PaperGraphPage: React.FC<PaperGraphPageProps> = ({ setSessionHandler }) => {
  console.log('🎨 PaperGraphPage: Component mounted, setSessionHandler:', !!setSessionHandler);
  
  // Core state
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousNodeCountRef = useRef<number>(0);
  
  // Cleanup timeout on unmount and save pending changes
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, []);
  
  // 保存用户输入的原始论文 URLs（用于 Prior/Derivative Works）
  const [_originalPaperUrls, setOriginalPaperUrls] = useState<string[]>([]);
  
  // 多模式切换状态（类似 Connected Papers）
  type ViewMode = 'graph' | 'prior-works' | 'derivative-works' | 'citation-extractor';
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
  const [citationUrl, setCitationUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [citationResults, setCitationResults] = useState<string | null>(null);
  const [citationFormat, setCitationFormat] = useState<'apa' | 'ieee' | 'mla' | 'chicago' | 'plain'>('ieee');
  const [rawCitations, setRawCitations] = useState<Array<{ title?: string; authors?: string[]; year?: string; venue?: string }>>([]);

  // Helper function to robustly extract author names
  // Handles: array of strings, array of objects, single string with separators, newlines, etc.
  const normalizeAuthors = (authors: any): string[] => {
    if (!authors) return [];
    
    // If already an array
    if (Array.isArray(authors)) {
      const normalized: string[] = [];
      for (const author of authors) {
        if (typeof author === 'string') {
          // Check if this single element contains multiple authors separated by comma
          // e.g., "Author1, Author2, Author3" should be split
          const parts = author.split(/[,;\n]|(?:\s+and\s+)/i).map(s => s.trim()).filter(Boolean);
          normalized.push(...parts);
        } else if (author && typeof author === 'object' && author.name) {
          // Handle object format {name: "..."}
          normalized.push(author.name);
        } else if (author) {
          normalized.push(String(author));
        }
      }
      return normalized;
    }
    
    // If single string, split by separators
    if (typeof authors === 'string') {
      return authors.split(/[,;\n]|(?:\s+and\s+)/i).map(s => s.trim()).filter(Boolean);
    }
    
    return [];
  };

  // Get display author (first or last) from normalized author list
  const getDisplayAuthor = (authors: any, showFirst: boolean): string => {
    const normalized = normalizeAuthors(authors);
    
    // Debug logging (only for first few items to avoid spam)
    if (normalized.length > 0 && Math.random() < 0.05) {
      console.log('🔍 Author Debug:', {
        input: authors,
        normalized: normalized,
        first: normalized[0],
        last: normalized[normalized.length - 1],
        total: normalized.length
      });
    }
    
    if (normalized.length === 0) return 'Unknown';
    return showFirst ? normalized[0] : normalized[normalized.length - 1];
  };

  // Obsidian Sync state
  const [showObsidianSync, setShowObsidianSync] = useState(false);
  const [obsidianPath, setObsidianPath] = useState('');
  const [obsidianSubfolder, setObsidianSubfolder] = useState('');
  const [obsidianSyncMode, setObsidianSyncMode] = useState<'local' | 'zip' | 'rest'>('local');
  const [obsidianApiKey, setObsidianApiKey] = useState(() => {
    // Load API key from localStorage
    return localStorage.getItem('obsidian_api_key') || '';
  });
  const [obsidianApiUrl, setObsidianApiUrl] = useState('http://127.0.0.1:27123');
  const [isCheckingApi, setIsCheckingApi] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // 这些状态变量已不再使用（功能已移到顶部标签页）
  // 保留用于向后兼容，可以稍后删除

  // Panel collapse state
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
  
  // Sidebar width states
  const [_leftSidebarWidth, setLeftSidebarWidth] = useState(320);
  const [_rightSidebarWidth, setRightSidebarWidth] = useState(350);
  
  // Guide section - Right sidebar
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
              .then(async (result) => {
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
                  
                  await handleAnalysisResult(finalResult, validUrls);
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

  // Save analysis result to database if user is authenticated
  const saveAnalysisResult = async (result: any, validUrls: string[]) => {
    if (!isAuthenticated()) {
      console.log('User not authenticated, skipping save');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      // Extract graph data and papers from result
      const graphData = result.graphData || result.graph || { nodes: [], edges: [] };
      const papers = result.papers || result.originalPapers || [];

      // Prepare data for saving (use save-result endpoint to avoid re-analysis)
      const paperUrls = validUrls.length > 0 ? validUrls : papers.map((p: any) => p.url || p.id).filter(Boolean);
      
      if (paperUrls.length === 0 || !graphData.nodes || graphData.nodes.length === 0) {
        console.warn('No URLs or graph data to save');
        return;
      }

      // Extract original paper IDs from result.originalPapers
      // originalPapers can be either an array of IDs or an object with priorWorks/derivativeWorks
      let originalPaperIds: string[] = [];
      if (result.originalPapers) {
        if (Array.isArray(result.originalPapers)) {
          originalPaperIds = result.originalPapers;
        } else if (result.originalPapers.priorWorks || result.originalPapers.derivativeWorks) {
          // Extract IDs from priorWorks and derivativeWorks objects
          const priorWorkIds = Object.keys(result.originalPapers.priorWorks || {});
          const derivativeWorkIds = Object.keys(result.originalPapers.derivativeWorks || {});
          originalPaperIds = [...priorWorkIds, ...derivativeWorkIds];
        } else {
          // Try to find original papers from graphData nodes (first node is usually the source)
          originalPaperIds = graphData.nodes && graphData.nodes.length > 0 ? [graphData.nodes[0].id] : [];
        }
      } else if (graphData.nodes && graphData.nodes.length > 0) {
        // Fallback: use first node as original paper
        originalPaperIds = [graphData.nodes[0].id];
      }

      // Add originalPapers to graphData so backend can use it for title generation
      const graphDataWithOriginalPapers = {
        ...graphData,
        originalPapers: originalPaperIds,
      };

      // Extract originalPapers data (priorWorks and derivativeWorks) from result
      const originalPapersData = result.originalPapers && 
        (result.originalPapers.priorWorks || result.originalPapers.derivativeWorks) 
        ? {
            urls: result.originalPapers.urls || paperUrls,
            priorWorks: result.originalPapers.priorWorks,
            derivativeWorks: result.originalPapers.derivativeWorks
          }
        : undefined;

      // Use save-result endpoint to save without re-analyzing
      // Don't pass title, let backend generate it from source paper
      const saveResponse = await fetch(`${API_BASE_URL}/api/analyses/save-result`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: paperUrls,
          // title: undefined, // Let backend generate from source paper title
          graphData: graphDataWithOriginalPapers,
          papers: papers.length > 0 ? papers : undefined,
          originalPapers: originalPapersData, // Include priorWorks and derivativeWorks
        }),
      });

      if (saveResponse.ok) {
        const saveResult = await saveResponse.json();
        console.log('✅ Analysis saved to session:', saveResult.session.id);
        setCurrentSessionId(saveResult.session.id);
        // Trigger a custom event to notify HistorySidebar to reload
        window.dispatchEvent(new CustomEvent('sessionSaved', { 
          detail: { sessionId: saveResult.session.id } 
        }));
      } else {
        const errorText = await saveResponse.text();
        console.warn('Failed to save analysis:', errorText);
        throw new Error(`Failed to save analysis: ${errorText}`);
      }
    } catch (error) {
      console.error('Error saving analysis:', error);
      // Don't throw, just log - saving is optional
    }
  };

  // Update current session with edited graph data
  const updateCurrentSession = async (dataToSave?: GraphData) => {
    const data = dataToSave || graphData;
    if (!isAuthenticated() || !currentSessionId || !data) {
      console.log('Cannot update: not authenticated or no session or no graphData');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.warn('No auth token available');
        return;
      }

           if (data.edges && data.edges.length > 0) {
        console.log(`💾 Edges sample (first 3):`, data.edges.slice(0, 3).map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          from: e.from,
          to: e.to,
          label: e.label
        })));
      } else {
        console.log(`⚠️ WARNING: No edges to save!`);
      }

      // Prepare originalPapers data from current state
      const originalPapersData = {
        urls: _originalPaperUrls.length > 0 ? _originalPaperUrls : (data.nodes?.map((n: any) => n.url).filter(Boolean) || []),
        priorWorks: Object.keys(_priorWorksData).length > 0 ? _priorWorksData : undefined,
        derivativeWorks: Object.keys(_derivativeWorksData).length > 0 ? _derivativeWorksData : undefined,
      };

      const updateResponse = await fetch(`${API_BASE_URL}/api/sessions/${currentSessionId}/update-graph`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          graphData: data,
          originalPapers: (originalPapersData.priorWorks || originalPapersData.derivativeWorks) ? originalPapersData : undefined,
        }),
      });

      if (updateResponse.ok) {
        const result = await updateResponse.json();
        console.log('✅ Session graph updated:', result);
      } else {
        const errorText = await updateResponse.text();
        console.warn('Failed to update session:', errorText);
        console.log(`🔴 ========== UPDATE SESSION GRAPH FAILED ==========\n`);
      }
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };

  // Use hook to load session data when currentSessionId changes
  const { graphData: loadedGraphData, priorWorks: loadedPriorWorks, derivativeWorks: loadedDerivativeWorks, loading: sessionLoading } = useLoadSession(currentSessionId);

  // Update graphData when session is loaded via hook
  // IMPORTANT: Only load from hook if graphData is null/empty or we're explicitly loading a session
  // This prevents clearing graph data after analysis completes
  useEffect(() => {
    // Only load from hook if:
    // 1. We have loadedGraphData
    // 2. We have a currentSessionId (explicit session selection)
    // 3. AND (graphData is null OR we're switching to a different session)
    // DO NOT load if graphData exists and is marked as new analysis
    if (loadedGraphData && currentSessionId) {
      // Check if this is a new analysis result (should not be overwritten)
      const isNewAnalysis = (graphData as any)?.__isNewAnalysis === true;
      const isDifferentSession = graphData && (graphData as any).__sessionId && (graphData as any).__sessionId !== currentSessionId;
      const isEmpty = !graphData || graphData.nodes.length === 0;
      
      // Only load if: empty OR different session (explicit session switch)
      // DO NOT load if: it's a new analysis (just completed)
      const shouldLoad = isEmpty || (isDifferentSession && !isNewAnalysis);
      
      if (shouldLoad) {
        console.log(`\n🟣 ========== PAPERGRAPHPAGE RECEIVE DATA ==========`);
        console.log(`📥 Session ID: ${currentSessionId}`);
        console.log(`📥 Received graphData: ${loadedGraphData.nodes.length} nodes, ${loadedGraphData.edges.length} edges`);
        if (loadedGraphData.edges.length > 0) {
          console.log(`📥 Edges sample (first 3):`, loadedGraphData.edges.slice(0, 3).map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label
          })));
        } else {
          console.log(`⚠️ WARNING: No edges in loaded graphData!`);
        }

        // 检查是否有 prior/derivative works 数据（从 hook 返回的数据）
        console.log(`📚 Checking for prior/derivative works in loaded data:`, {
          hasLoadedPriorWorks: !!loadedPriorWorks && Object.keys(loadedPriorWorks).length > 0,
          hasLoadedDerivativeWorks: !!loadedDerivativeWorks && Object.keys(loadedDerivativeWorks).length > 0,
          loadedPriorWorksKeys: loadedPriorWorks ? Object.keys(loadedPriorWorks) : [],
          loadedDerivativeWorksKeys: loadedDerivativeWorks ? Object.keys(loadedDerivativeWorks) : [],
          loadedPriorWorksCount: loadedPriorWorks ? Object.values(loadedPriorWorks).flat().length : 0,
          loadedDerivativeWorksCount: loadedDerivativeWorks ? Object.values(loadedDerivativeWorks).flat().length : 0
        });
        
        // 优先使用 hook 返回的数据（更可靠）
        if (loadedPriorWorks && Object.keys(loadedPriorWorks).length > 0) {
          console.log(`📚 Using loadedPriorWorks from hook:`, loadedPriorWorks);
          setPriorWorksData(loadedPriorWorks);
          // 处理并设置 prior works（合并所有原始论文的 prior works）
          const mergedPriorWorks = new Map<string, any>();
          Object.values(loadedPriorWorks).flat().forEach((work: any) => {
            const key = work.id || work.title || `${work.title}_${work.year}`;
            if (!mergedPriorWorks.has(key)) {
              mergedPriorWorks.set(key, work);
            } else {
              // 如果已存在，合并数据（保留 citationCount 等）
              const existing = mergedPriorWorks.get(key);
              mergedPriorWorks.set(key, {
                ...existing,
                ...work,
                citationCount: work.citationCount ?? existing.citationCount,
                authors: work.authors?.length > existing.authors?.length ? work.authors : existing.authors
              });
            }
          });
          setAllPriorWorks(Array.from(mergedPriorWorks.values()));
          console.log(`✅ Loaded and merged ${mergedPriorWorks.size} prior works from history`);
        }
        
        if (loadedDerivativeWorks && Object.keys(loadedDerivativeWorks).length > 0) {
          console.log(`📚 Using loadedDerivativeWorks from hook:`, loadedDerivativeWorks);
          setDerivativeWorksData(loadedDerivativeWorks);
          // 处理并设置 derivative works（合并所有原始论文的 derivative works）
          const mergedDerivativeWorks = new Map<string, any>();
          Object.values(loadedDerivativeWorks).flat().forEach((work: any) => {
            const key = work.id || work.title || `${work.title}_${work.year}`;
            if (!mergedDerivativeWorks.has(key)) {
              mergedDerivativeWorks.set(key, work);
            } else {
              // 如果已存在，合并数据
              const existing = mergedDerivativeWorks.get(key);
              mergedDerivativeWorks.set(key, {
                ...existing,
                ...work,
                citationCount: work.citationCount ?? existing.citationCount,
                authors: work.authors?.length > existing.authors?.length ? work.authors : existing.authors
              });
            }
          });
          setAllDerivativeWorks(Array.from(mergedDerivativeWorks.values()));
          console.log(`✅ Loaded and merged ${mergedDerivativeWorks.size} derivative works from history`);
        }
        
        // Fallback: 如果没有从 hook 获取到，尝试从 graphData.originalPapers 获取
        if ((!loadedPriorWorks || Object.keys(loadedPriorWorks).length === 0) && 
            (!loadedDerivativeWorks || Object.keys(loadedDerivativeWorks).length === 0)) {
          const originalPapers = (loadedGraphData as any).originalPapers;
          if (originalPapers && (originalPapers.priorWorks || originalPapers.derivativeWorks)) {
            console.log(`📚 Fallback: Using originalPapers from graphData`);
            if (originalPapers.priorWorks) {
              setPriorWorksData(originalPapers.priorWorks);
              const mergedPriorWorks = new Map<string, any>();
              Object.values(originalPapers.priorWorks).flat().forEach((work: any) => {
                const key = work.id || work.title || `${work.title}_${work.year}`;
                if (!mergedPriorWorks.has(key)) {
                  mergedPriorWorks.set(key, work);
                }
              });
              setAllPriorWorks(Array.from(mergedPriorWorks.values()));
            }
            if (originalPapers.derivativeWorks) {
              setDerivativeWorksData(originalPapers.derivativeWorks);
              const mergedDerivativeWorks = new Map<string, any>();
              Object.values(originalPapers.derivativeWorks).flat().forEach((work: any) => {
                const key = work.id || work.title || `${work.title}_${work.year}`;
                if (!mergedDerivativeWorks.has(key)) {
                  mergedDerivativeWorks.set(key, work);
                }
              });
              setAllDerivativeWorks(Array.from(mergedDerivativeWorks.values()));
            }
          }
        }

        // Mark this graphData with the session ID to prevent accidental overwrites
        (loadedGraphData as any).__sessionId = currentSessionId;
        setGraphData(loadedGraphData);
        setViewMode('graph');
      } else {
        console.log(`⏭️  Skipping hook data load: graphData already exists and session matches`);
      }
    }
  }, [loadedGraphData, currentSessionId]);
  
  // Separate useEffect to ALWAYS load prior/derivative works when available from history
  // This ensures prior/derivative works are loaded even if graphData loading is skipped
  useEffect(() => {
    if (!currentSessionId) return;
    
    // Always load prior/derivative works if available from hook, regardless of graphData loading status
    if (loadedPriorWorks && Object.keys(loadedPriorWorks).length > 0) {
      console.log(`📚 [Separate useEffect] Loading prior works from history:`, {
        sessionId: currentSessionId,
        priorWorksKeys: Object.keys(loadedPriorWorks),
        totalCount: Object.values(loadedPriorWorks).flat().length
      });
      setPriorWorksData(loadedPriorWorks);
      // Merge all prior works from all original papers and calculate stats
      const mergedPriorWorks = new Map<string, any>();
      Object.values(loadedPriorWorks).flat().forEach((work: any) => {
        const key = work.id || work.title || `${work.title}_${work.year}`;
        if (!mergedPriorWorks.has(key)) {
          mergedPriorWorks.set(key, work);
        } else {
          // Merge if exists (keep best data)
          const existing = mergedPriorWorks.get(key);
          mergedPriorWorks.set(key, {
            ...existing,
            ...work,
            citationCount: work.citationCount ?? existing.citationCount,
            authors: work.authors?.length > existing.authors?.length ? work.authors : existing.authors,
            strength: work.strength ?? existing.strength
          });
        }
      });
      
      // Calculate stats (graphCitations, strength) for prior works using current graphData
      const priorWorksWithStats = Array.from(mergedPriorWorks.values()).map((work: any) => {
        // Try to find matching node in graph
        const matchingNodes = (graphData?.nodes || []).filter((node: any) => {
          const nodeTitle = (node.title || '').toLowerCase().trim();
          const workTitle = (work.title || '').toLowerCase().trim();
          return nodeTitle === workTitle || 
                 nodeTitle.includes(workTitle.substring(0, 30)) || 
                 workTitle.includes(nodeTitle.substring(0, 30));
        });
        
        // Get citationCount from work or matching node
        let citationCount = work.citationCount;
        if ((citationCount === undefined || citationCount === null) && matchingNodes.length > 0) {
          const firstMatchingNode = matchingNodes[0];
          citationCount = firstMatchingNode.citationCount ?? firstMatchingNode.paperCitationCount ?? null;
        }
        
        // Calculate graphCitations and strength from graph edges
        let graphCitations = 0;
        let totalStrength = 0;
        let strengthCount = 0;
        
        if (graphData?.edges && matchingNodes.length > 0) {
          matchingNodes.forEach((matchingNode: any) => {
            const nodeId = matchingNode.id;
            const incomingEdges = graphData.edges.filter((edge: any) => {
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
        }
        
        const avgStrength = strengthCount > 0 ? totalStrength / strengthCount : (work.strength ?? 0);
        
        // Calculate final strength with fallbacks
        let finalStrength = avgStrength;
        if (finalStrength <= 0 || finalStrength === undefined || finalStrength === null) {
          // Fallback 1: Use citationCount-based strength
          if (citationCount && citationCount > 0) {
            finalStrength = Math.min(1.0, 0.2 + (Math.log(1 + citationCount) / Math.log(1 + 100000)) * 0.8);
          }
          // Fallback 2: Use graphCitations-based strength
          else if (graphCitations > 0) {
            finalStrength = Math.min(1.0, 0.25 + (Math.log(1 + graphCitations) / Math.log(1 + 50)) * 0.75);
          }
          // Final fallback: minimum strength
          else {
            finalStrength = 0.25;
          }
        }
        
        return {
          ...work,
          citationCount: citationCount ?? null, // Use null instead of 0 for missing data
          graphCitations,
          strength: finalStrength,
          avgStrength: avgStrength > 0 ? avgStrength : finalStrength
        };
      });
      
      setAllPriorWorks(priorWorksWithStats);
      console.log(`✅ [Separate useEffect] Loaded ${priorWorksWithStats.length} prior works from history with stats`);
    } else if (loadedPriorWorks && Object.keys(loadedPriorWorks).length === 0) {
      // Clear prior works if hook returns empty object
      setPriorWorksData({});
      setAllPriorWorks([]);
    }
    
    if (loadedDerivativeWorks && Object.keys(loadedDerivativeWorks).length > 0) {
      console.log(`📚 [Separate useEffect] Loading derivative works from history:`, {
        sessionId: currentSessionId,
        derivativeWorksKeys: Object.keys(loadedDerivativeWorks),
        totalCount: Object.values(loadedDerivativeWorks).flat().length
      });
      setDerivativeWorksData(loadedDerivativeWorks);
      // Merge all derivative works from all original papers and calculate strength
      const mergedDerivativeWorks = new Map<string, any>();
      Object.values(loadedDerivativeWorks).flat().forEach((work: any) => {
        const key = work.id || work.title || `${work.title}_${work.year}`;
        if (!mergedDerivativeWorks.has(key)) {
          mergedDerivativeWorks.set(key, work);
        } else {
          // Merge if exists (keep best data)
          const existing = mergedDerivativeWorks.get(key);
          mergedDerivativeWorks.set(key, {
            ...existing,
            ...work,
            citationCount: work.citationCount ?? existing.citationCount,
            authors: work.authors?.length > existing.authors?.length ? work.authors : existing.authors,
            strength: work.strength ?? existing.strength
          });
        }
      });
      
      // Calculate strength for derivative works
      const derivativeWorksWithStrength = Array.from(mergedDerivativeWorks.values()).map((work: any, index: number) => {
        // Ensure citationCount is a number (backend should return 0 if not found)
        const citationCount = (work.citationCount !== undefined && work.citationCount !== null && typeof work.citationCount === 'number')
          ? work.citationCount
          : 0;
        
        let finalStrength = work.strength;
        
        // If strength is missing or invalid, calculate from citationCount
        if (!finalStrength || finalStrength <= 0 || typeof finalStrength !== 'number') {
          if (citationCount > 0) {
            // Use logarithmic scaling: 0.3 to 1.0 range
            finalStrength = Math.min(1.0, 0.3 + (Math.log(1 + citationCount) / Math.log(1 + 100000)) * 0.7);
          } else {
            // If citationCount is 0, use position-based minimum strength
            const totalWorks = mergedDerivativeWorks.size;
            const positionFactor = totalWorks > 1 ? 1 - (index / (totalWorks - 1)) * 0.15 : 1.0;
            finalStrength = 0.3 * positionFactor; // Range: 0.255 to 0.3
          }
        }
        
        // Ensure strength is in valid range
        finalStrength = Math.max(0.25, Math.min(1.0, finalStrength));
        
        return {
          ...work,
          citationCount: citationCount, // Always a number (0 if not found)
          graphCitations: 0, // Derivative works typically not in graph
          strength: finalStrength
        };
      });
      
      setAllDerivativeWorks(derivativeWorksWithStrength);
      console.log(`✅ [Separate useEffect] Loaded ${derivativeWorksWithStrength.length} derivative works from history with stats`);
    } else if (loadedDerivativeWorks && Object.keys(loadedDerivativeWorks).length === 0) {
      // Clear derivative works if hook returns empty object
      setDerivativeWorksData({});
      setAllDerivativeWorks([]);
    }
  }, [currentSessionId, loadedPriorWorks, loadedDerivativeWorks, graphData]);

  // Handle session selection from HistorySidebar
  const handleSessionSelect = useCallback((sessionId: string, graphData: any) => {
    console.log('📥 PaperGraphPage: Received session selection:', sessionId, graphData);
    if (!sessionId) {
      console.error('❌ PaperGraphPage: sessionId is undefined!');
      return;
    }
    // Set session ID - the hook will automatically load the sanitized data
    setCurrentSessionId(sessionId);
    // Also set graphData immediately if provided (for faster initial render)
    if (graphData && graphData.nodes) {
      setGraphData(graphData);
      setViewMode('graph');
      console.log('✅ PaperGraphPage: Loaded session immediately:', sessionId, 'with', graphData.nodes.length, 'nodes');
    }
  }, []);

  // Register session handler with parent component immediately on mount
  useEffect(() => {
    console.log('🔍 PaperGraphPage: useEffect triggered, setSessionHandler:', !!setSessionHandler, 'handleSessionSelect:', !!handleSessionSelect);
    if (setSessionHandler) {
      console.log('📤 PaperGraphPage: Registering session handler');
      // Use function form to ensure we get the latest handleSessionSelect
      setSessionHandler(() => {
        console.log('📞 PaperGraphPage: Handler function called');
        return handleSessionSelect;
      });
      // Return cleanup function to unregister
      return () => {
        console.log('📤 PaperGraphPage: Unregistering session handler');
        if (setSessionHandler) {
          setSessionHandler(() => undefined);
        }
      };
    } else {
      console.warn('⚠️ PaperGraphPage: setSessionHandler not provided');
    }
  }, [setSessionHandler, handleSessionSelect]);

  // Handle graph data updates from GraphVisualization
  const handleGraphDataUpdate = (updatedData: GraphData) => {
    const prevCount = previousNodeCountRef.current;
    const newCount = updatedData.nodes?.length ?? 0;

    // Update local state and track count for next comparison
    setGraphData(updatedData);
    previousNodeCountRef.current = newCount;
    
    if (isAuthenticated() && currentSessionId) {
      // If nodes were removed, save immediately to avoid resurrecting deleted nodes from history
      if (prevCount > newCount) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        updateCurrentSession(updatedData);
      }

      // Debounce additional saves for non-destructive edits
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        updateCurrentSession(updatedData);
        saveTimeoutRef.current = null;
      }, 2000);
    }
  };

  // Keep node count tracker in sync when graphData changes externally (e.g., loading sessions)
  useEffect(() => {
    previousNodeCountRef.current = graphData?.nodes?.length ?? 0;
  }, [graphData]);

  // Handle analysis result (extracted from original code)
  const handleAnalysisResult = async (result: any, validUrls: string[]) => {
    console.log('📊 Received analysis result:', result);
    
    // Save to database if authenticated
    await saveAnalysisResult(result, validUrls);
    
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
      console.log('📊 Processing graph data:', {
        nodes: result.graphData.nodes?.length || 0,
        edges: result.graphData.edges?.length || 0,
        hasNodes: !!result.graphData.nodes,
        hasEdges: !!result.graphData.edges,
        nodesType: Array.isArray(result.graphData.nodes) ? 'array' : typeof result.graphData.nodes,
        edgesType: Array.isArray(result.graphData.edges) ? 'array' : typeof result.graphData.edges,
        graphDataKeys: Object.keys(result.graphData)
      });
      
      // Ensure nodes and edges are arrays and not null/undefined
      const graphData = {
        ...result.graphData,
        nodes: Array.isArray(result.graphData.nodes) ? result.graphData.nodes : [],
        edges: Array.isArray(result.graphData.edges) ? result.graphData.edges : []
      };
      
      console.log('📊 Normalized graph data:', {
        nodes: graphData.nodes.length,
        edges: graphData.edges.length
      });
      
      // Transform result to match expected format
      const transformedResult = {
        success: result.success,
        graphData: graphData,
        originalPapers: result.originalPapers || {}
      };
      
      // 保存原始论文 URLs (if setOriginalPaperUrls exists)
      // Note: This variable may not be used, but kept for compatibility
      
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
        
        // 计算每个 prior work 的 graph citations、citationCount 与 strength（带回退策略）
        const priorWorksWithStats = Array.from(mergedPriorWorks.values()).map((work: any) => {
          const matchingNodes = transformedResult.graphData.nodes.filter((node: any) => {
            const nodeTitle = (node.title || '').toLowerCase().trim();
            const workTitle = (work.title || '').toLowerCase().trim();
            return nodeTitle === workTitle || 
                   nodeTitle.includes(workTitle.substring(0, 30)) || 
                   workTitle.includes(nodeTitle.substring(0, 30));
          });
          
          // 更稳健的 citationCount 获取：优先 work 自带，其次图节点的 citationCount / paperCitationCount
          // 但要注意：如果work.citationCount是undefined/null，说明后端没找到，我们不应该用图节点的值覆盖
          // 只有在work.citationCount确实是数字（包括0）时才使用work的值
          let citationCount = work.citationCount;
          if ((citationCount === undefined || citationCount === null) && matchingNodes.length > 0) {
            const firstMatchingNode = matchingNodes[0];
            // 优先使用paperCitationCount，因为它通常更准确
            if (firstMatchingNode.paperCitationCount !== undefined && firstMatchingNode.paperCitationCount !== null) {
              citationCount = firstMatchingNode.paperCitationCount;
            } else if (firstMatchingNode.citationCount !== undefined && firstMatchingNode.citationCount !== null) {
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

          // 基于 citationCount 的强度回退（对数缩放，范围 0.2~1.0）
          let citationStrength = 0;
          if (citationCount && citationCount > 0) {
            citationStrength = Math.min(
              1,
              0.2 + (Math.log(1 + citationCount) / Math.log(1 + 50000)) * 0.8
            );
          }

          // 基于 graphCitations 的回退（如果图里有入边）
          let graphCitationStrength = 0;
          if (graphCitations > 0) {
            graphCitationStrength = Math.min(
              1,
              0.25 + (Math.log(1 + graphCitations) / Math.log(1 + 30)) * 0.5
            );
          }

          // 取所有可用强度的最大值，若仍为 0，则给一个安全兜底值 0.25，避免显示 N/A
          const finalStrength = Math.max(avgStrength, citationStrength, graphCitationStrength, 0.25);
          
          return {
            ...work,
            // citationCount: 保留 undefined/null 表示未知，不再强制 0，便于前端显示 N/A
            citationCount: citationCount ?? null,
            graphCitations,
            strength: finalStrength,
            avgStrength: finalStrength
          };
        });
        
        setAllPriorWorks(priorWorksWithStats);
      }
      
      // 處理 graphData（保留原有邏輯）
      // Mark graphData to prevent it from being overwritten by session hook
      const finalGraphData = {
        ...transformedResult.graphData,
        __isNewAnalysis: true // Mark as new analysis to prevent hook from overwriting
      };
      setGraphData(finalGraphData);
      console.log('✅ Graph data set successfully:', {
        nodes: finalGraphData.nodes.length,
        edges: finalGraphData.edges.length,
        isNewAnalysis: true
      });
      
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
        // Mark graphData to prevent it from being overwritten by session hook
        const finalGraphData = {
          ...result.graphData,
          __isNewAnalysis: true // Mark as new analysis
        };
        setGraphData(finalGraphData);
        console.log('✅ Graph data set successfully:', {
          nodes: finalGraphData.nodes.length,
          edges: finalGraphData.edges.length,
          isNewAnalysis: true
        });
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Format citation according to style
  const formatCitation = (citation: { title?: string; authors?: string[]; year?: string; venue?: string }, _index: number, format: 'apa' | 'ieee' | 'mla' | 'chicago' | 'plain'): string => {
    const title = citation.title || 'Unknown Title';
    const authors = citation.authors || [];
    const year = citation.year || 'Unknown year';
    const venue = citation.venue || '';

    switch (format) {
      case 'apa':
        // APA: Author, A. A., & Author, B. B. (Year). Title of paper. Journal/Conference, Volume(Issue), pages.
        const apaAuthors = authors.length > 0
          ? authors.map((author) => {
              const parts = author.trim().split(/\s+/);
              if (parts.length >= 2) {
                const last = parts[parts.length - 1];
                const initials = parts.slice(0, -1).map((p: string) => p[0]?.toUpperCase() + '.').join(' ');
                return `${last}, ${initials}`;
              }
              return author;
            }).join(', & ')
          : 'Unknown authors';
        return `${apaAuthors} (${year}). ${title}${venue ? `. ${venue}` : ''}.`;
      
      case 'ieee':
        // IEEE: [1] A. A. Author and B. B. Author, "Title of paper," Journal/Conference, vol. X, no. Y, pp. ZZ-ZZ, Year.
        const ieeeAuthors = authors.length > 0
          ? authors.map((author) => {
              const parts = author.trim().split(/\s+/);
              if (parts.length >= 2) {
                const last = parts[parts.length - 1];
                const initials = parts.slice(0, -1).map((p: string) => p[0]?.toUpperCase() + '.').join(' ');
                return `${initials} ${last}`;
              }
              return author;
            }).join(' and ')
          : 'Unknown authors';
        return `${ieeeAuthors}, "${title}"${venue ? `, ${venue}` : ''}, ${year}.`;
      
      case 'mla':
        // MLA: Author, First Name Last Name, et al. "Title of Paper." Journal/Conference, vol. X, no. Y, Year, pp. ZZ-ZZ.
        const mlaAuthors = authors.length > 0
          ? authors.length === 1
            ? authors[0].trim()
            : authors.length === 2
            ? `${authors[0].trim()} and ${authors[1].trim()}`
            : `${authors[0].trim()}, et al.`
          : 'Unknown authors';
        return `${mlaAuthors}. "${title}."${venue ? ` ${venue},` : ''} ${year}.`;
      
      case 'chicago':
        // Chicago: Author, First Name Last Name. "Title of Paper." Journal/Conference (Year): pages.
        const chicagoAuthors = authors.length > 0
          ? authors.map((author, idx) => {
              if (idx === authors.length - 1 && authors.length > 1) {
                return `and ${author.trim()}`;
              }
              return author.trim();
            }).join(authors.length > 2 ? ', ' : ' ')
          : 'Unknown authors';
        return `${chicagoAuthors}. "${title}."${venue ? ` ${venue}` : ''} (${year}).`;
      
      case 'plain':
      default:
        // Plain: Number. Title (Authors) - Year
        const plainAuthors = authors.length > 0 ? authors.join(', ') : 'Unknown authors';
        return `${title} (${plainAuthors}) - ${year}`;
    }
  };

  // Citation extraction
  const extractCitations = async () => {
    if (!citationUrl.trim()) return;

    setIsExtracting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/grobid/extract-citations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: citationUrl,
          filterSections: false // Always extract all citations
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
        setRawCitations([]);
      } else {
        // Store raw citations
        setRawCitations(data.citations);
        
        // Format citations based on selected format
        const formattedCitations = data.citations.map((c: any, index: number) => 
          formatCitation({
            title: c.title,
            authors: c.authors,
            year: c.year,
            venue: c.venue
          }, index, citationFormat)
        );
        setCitationResults(formattedCitations.join('\n'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Extraction failed';
      console.error('Citation extraction error:', err);
      setCitationResults(`Error: ${errorMessage}`);
      setRawCitations([]);
    } finally {
      setIsExtracting(false);
    }
  };

  // Reformat citations when format changes
  useEffect(() => {
    if (rawCitations.length > 0) {
      const formattedCitations = rawCitations.map((c, index) => 
        formatCitation(c, index, citationFormat)
      );
      setCitationResults(formattedCitations.join('\n'));
    }
  }, [citationFormat, rawCitations]);

  // Check if Obsidian REST API is available
  const checkObsidianApi = async () => {
    setIsCheckingApi(true);
    try {
      // Ensure API URL is correct (remove trailing slash if present)
      const apiBaseUrl = obsidianApiUrl.trim().replace(/\/$/, '');
      
      if (!apiBaseUrl || !obsidianApiKey.trim()) {
        setApiAvailable(false);
        setIsCheckingApi(false);
        return;
      }
      
      // Try /vault/ with trailing slash (some APIs require it)
      const testUrl = `${apiBaseUrl}/vault/`;
      console.log(`Checking Obsidian API: ${testUrl}`);
      console.log(`API Key provided: ${obsidianApiKey ? 'Yes (' + obsidianApiKey.length + ' chars)' : 'No'}`);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${obsidianApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      
      setApiAvailable(response.ok);
      if (!response.ok) {
        console.error('Obsidian API check failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      } else {
        console.log('✅ Obsidian REST API is available');
      }
    } catch (error) {
      setApiAvailable(false);
      console.error('Obsidian REST API not available:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
    } finally {
      setIsCheckingApi(false);
    }
  };

  // Save API key to localStorage
  const saveApiKey = (key: string) => {
    setObsidianApiKey(key);
    localStorage.setItem('obsidian_api_key', key);
  };

  // Sync to Obsidian via REST API (browser-side)
  const syncToObsidianViaApi = async () => {
    if (!graphData) {
      setSyncStatus('❌ 沒有圖數據可同步');
      setTimeout(() => setSyncStatus(null), 3000);
      return;
    }

    if (!obsidianApiKey.trim()) {
      setSyncStatus('❌ 請輸入 Obsidian REST API Key');
      setTimeout(() => setSyncStatus(null), 3000);
      return;
    }

    // Validate API URL
    const apiBaseUrl = obsidianApiUrl.trim().replace(/\/$/, '');
    if (!apiBaseUrl || !apiBaseUrl.startsWith('http://127.0.0.1') && !apiBaseUrl.startsWith('http://localhost')) {
      setSyncStatus('❌ API URL 格式錯誤，應為 http://127.0.0.1:27123 或 http://localhost:27123');
      setTimeout(() => setSyncStatus(null), 5000);
      return;
    }

    console.log('🔗 Using Obsidian API URL:', apiBaseUrl);
    console.log('🔑 API Key length:', obsidianApiKey.length);

    setIsSyncing(true);
    setSyncStatus('正在通過 REST API 同步到 Obsidian...');

    try {
      // Generate markdown content for each paper
      const paperFolder = obsidianSubfolder.trim() 
        ? `Papers/${obsidianSubfolder.trim()}` 
        : 'Papers';
      const graphFolder = obsidianSubfolder.trim()
        ? `Paper_Graphs/${obsidianSubfolder.trim()}`
        : 'Paper_Graphs';

      let successCount = 0;
      let errorCount = 0;

      // Create individual paper files
      for (const node of graphData.nodes) {
        try {
          // Generate markdown content (simplified version)
          const paperContent = generatePaperMarkdown(node, graphData);
          const nodeTitle = node.title || node.label || String(node.id);
          const safeFileName = nodeTitle
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 80);

          // Ensure API URL is correct (remove trailing slash if present)
          const apiBaseUrl = obsidianApiUrl.trim().replace(/\/$/, '');
          // Obsidian REST API expects path without leading slash in vault endpoint
          const filePath = `${paperFolder}/${safeFileName}.md`;
          const fullUrl = `${apiBaseUrl}/vault/${filePath}`;
          
          console.log(`📝 Creating file via REST API: ${fullUrl}`);
          console.log(`📝 File path: ${filePath}`);
          console.log(`🔑 Using API Key: ${obsidianApiKey.substring(0, 10)}...`);
          
          const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${obsidianApiKey}`,
              'Content-Type': 'text/markdown',
            },
            body: paperContent,
          });

          if (response.ok) {
            successCount++;
            console.log(`✅ Successfully created: ${safeFileName}.md`);
          } else {
            errorCount++;
            const errorText = await response.text().catch(() => '');
            console.error(`❌ Failed to create ${safeFileName}.md:`, {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
              url: fullUrl
            });
          }
        } catch (error) {
          errorCount++;
          console.error(`Error creating paper ${node.title}:`, error);
        }
      }

      // Create overview file
      try {
        const overviewContent = generateGraphOverview(graphData, `Paper Graph ${new Date().toLocaleDateString()}`);
        const timestamp = new Date().toISOString().split('T')[0];
        const overviewFileName = `Paper_Graph_${timestamp}.md`;
        
        // Ensure API URL is correct (remove trailing slash if present)
        const apiBaseUrl = obsidianApiUrl.trim().replace(/\/$/, '');
        const overviewPath = `${graphFolder}/${overviewFileName}`;
        const overviewUrl = `${apiBaseUrl}/vault/${overviewPath}`;
        
        console.log(`📝 Creating overview file via REST API: ${overviewUrl}`);
        
        const overviewResponse = await fetch(overviewUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${obsidianApiKey}`,
            'Content-Type': 'text/markdown',
          },
          body: overviewContent,
        });
        
        if (overviewResponse.ok) {
          console.log(`✅ Successfully created overview file: ${overviewFileName}`);
        } else {
          const errorText = await overviewResponse.text().catch(() => '');
          console.error(`❌ Failed to create overview file:`, {
            status: overviewResponse.status,
            statusText: overviewResponse.statusText,
            error: errorText,
            url: overviewUrl
          });
        }
      } catch (error) {
        console.error('Error creating overview file:', error);
      }

      if (errorCount === 0) {
        setSyncStatus(`✅ 同步成功: ${successCount} 篇論文已寫入 Obsidian`);
      } else {
        setSyncStatus(`⚠️ 部分成功: ${successCount} 篇成功, ${errorCount} 篇失敗`);
      }
    } catch (error) {
      console.error('Obsidian REST API sync error:', error);
      setSyncStatus(`❌ 同步失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Helper function to generate paper markdown
  const generatePaperMarkdown = (node: any, graphData: any): string => {
    const nodeId = node.id;
    const incomingEdges = graphData.edges.filter((e: any) => {
      const targetId = typeof e.target === 'string' ? e.target : (e.target?.id || e.target);
      return targetId === nodeId;
    });
    const outgoingEdges = graphData.edges.filter((e: any) => {
      const sourceId = typeof e.source === 'string' ? e.source : (e.source?.id || e.source);
      return sourceId === nodeId;
    });

    const nodeTitle = node.title || node.label || String(node.id);
    const authors = node.authors?.length > 0 ? node.authors : ['Unknown'];
    const authorsYaml = authors.map((a: string) => `  - "${a}"`).join('\n');

    return `---
title: "${nodeTitle}"
year: ${node.year || 'Unknown'}
authors:
${authorsYaml}
tags: [Paper, Research]
url: "${node.url || ''}"
---

# ${nodeTitle}

## Abstract
${node.abstract || '無摘要資訊'}

---

## Relationships

### Cites (Outgoing Links)
${outgoingEdges.length > 0 ? outgoingEdges.map((edge: any) => {
  const targetId = typeof edge.target === 'string' ? edge.target : (edge.target?.id || edge.target);
  const targetNode = graphData.nodes.find((n: any) => n.id === targetId);
  const targetTitle = targetNode?.title || targetNode?.label || 'Unknown';
  const relationshipType = edge.relationship || 'references';
  const context = edge.evidence || 'Context not available';
  const explanation = edge.description || 'Relationship explanation not available';
  
  return `- **[[${targetTitle}]]**
  - type:: \`${relationshipType}\`
  - strength:: ${edge.strength || 0.5}
  - context:: "${context.replace(/"/g, '\\"')}"
  - explanation:: "${explanation.replace(/"/g, '\\"')}"`;
}).join('\n') : '- No outgoing citations found'}

### Cited By (Incoming Links)
${incomingEdges.length > 0 ? incomingEdges.map((edge: any) => {
  const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source?.id || edge.source);
  const sourceNode = graphData.nodes.find((n: any) => n.id === sourceId);
  const sourceTitle = sourceNode?.title || sourceNode?.label || 'Unknown';
  const relationshipType = edge.relationship || 'references';
  const context = edge.evidence || 'Context not available';
  const explanation = edge.description || 'Relationship explanation not available';
  
  return `- **[[${sourceTitle}]]**
  - type:: \`${relationshipType}\`
  - strength:: ${edge.strength || 0.5}
  - context:: "${context.replace(/"/g, '\\"')}"
  - explanation:: "${explanation.replace(/"/g, '\\"')}"`;
}).join('\n') : '- No incoming citations found'}

---

*Auto-generated at ${new Date().toLocaleString('zh-TW')}*
`;
  };

  // Helper function to generate graph overview (full version with all visualizations)
  const generateGraphOverview = (graphData: any, graphName: string): string => {
    // Get relationship statistics
    const relationshipCounts: { [key: string]: number } = {};
    graphData.edges.forEach((edge: any) => {
      const relType = edge.relationship || 'related';
      relationshipCounts[relType] = (relationshipCounts[relType] || 0) + 1;
    });
    const relationshipStats = Object.entries(relationshipCounts)
      .map(([type, count]) => `- **${type}**: ${count}`)
      .join('\n');

    // Helper to sanitize node ID for Mermaid
    const sanitizeNodeId = (title: string | undefined): string => {
      if (!title || typeof title !== 'string') return 'unknown';
      return title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '').substring(0, 10);
    };

    // Helper to truncate title
    const truncateTitle = (title: string, maxLength: number): string => {
      if (title.length <= maxLength) return title;
      return title.substring(0, maxLength - 3) + '...';
    };

    return `---
title: "${graphName}"
type: "Knowledge Graph Overview"
tags: [Graph, Overview, Research]
cssclasses: [juggl-graph-overview]
papers_count: ${graphData.nodes.length}
relationships_count: ${graphData.edges.length}
generated_date: "${new Date().toISOString()}"
---

# ${graphName}

## 📊 Graph Statistics
- **Papers Count**: ${graphData.nodes.length}
- **Relationships Count**: ${graphData.edges.length}
- **Generated**: ${new Date().toLocaleString('zh-TW')}

## 📚 Papers in This Graph
\`\`\`dataview
TABLE 
  authors as "Authors",
  year as "Year",
  length(file.outlinks) as "Citations Out",
  length(file.inlinks) as "Citations In"
FROM #Paper 
SORT year DESC
\`\`\`

### Paper List
${graphData.nodes.map((node: any) => {
  const nodeTitle = node.title || node.label || String(node.id);
  const year = node.year ? `(${node.year})` : '';
  const authors = node.authors?.length > 0 ? node.authors.join(', ') : 'Unknown';
  return `- **[[${nodeTitle}]]** ${year} - ${authors}`;
}).join('\n')}

## 🔗 Relationship Analysis

### Relationship Type Distribution
${relationshipStats}

### Detailed Relationships
\`\`\`dataview
TABLE 
  file.link as "Source Paper",
  choice(type, type, "references") as "Relationship Type",
  strength as "Strength"
FROM [[]]
WHERE contains(tags, "Paper")
FLATTEN file.outlinks as outlink
FLATTEN outlink.type as type
FLATTEN outlink.strength as strength
SORT strength DESC
\`\`\`

## 🎨 Interactive Visualization

### Mermaid Network Diagram
\`\`\`mermaid
graph TD
${graphData.edges.map((edge: any) => {
  const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source?.id || edge.source);
  const targetId = typeof edge.target === 'string' ? edge.target : (edge.target?.id || edge.target);
  const sourceNode = graphData.nodes.find((n: any) => n.id === sourceId);
  const targetNode = graphData.nodes.find((n: any) => n.id === targetId);
  const sourceTitle = sourceNode?.title || sourceNode?.label || 'Unknown';
  const targetTitle = targetNode?.title || targetNode?.label || 'Unknown';
  const sourceLabel = sanitizeNodeId(sourceTitle);
  const targetLabel = sanitizeNodeId(targetTitle);
      const sourceTitleShort = truncateTitle(sourceTitle, 30);
      const targetTitleShort = truncateTitle(targetTitle, 30);
      const relationshipLabel = edge.relationship || 'related';
      return `    ${sourceLabel}["${sourceTitleShort}"] -->|${relationshipLabel}| ${targetLabel}["${targetTitleShort}"]
    style ${sourceLabel} fill:#64c864,stroke:#2d5016,stroke-width:2px
    style ${targetLabel} fill:#64c864,stroke:#2d5016,stroke-width:2px`;
}).join('\n')}

classDef paper fill:#64c864,stroke:#2d5016,stroke-width:2px,color:#fff
classDef cited fill:#7b68ee,stroke:#4b0082,stroke-width:2px,color:#fff
\`\`\`

### Obsidian Graph View
> **Tip**: Open this note in Obsidian and use the built-in Graph View (Ctrl+G / Cmd+G) to see an interactive visualization of all paper relationships. The graph will automatically show connections based on the \`[[links]]\` in each paper file.

### Juggl Interactive Graph
\`\`\`juggl
${graphData.nodes.map((node: any) => {
  const nodeId = sanitizeNodeId(node.title || node.label);
  const outgoing = graphData.edges
    .filter((e: any) => {
      const sourceId = typeof e.source === 'string' ? e.source : (e.source?.id || e.source);
      return sourceId === node.id;
    })
    .map((e: any) => {
      const targetId = typeof e.target === 'string' ? e.target : (e.target?.id || e.target);
      const target = graphData.nodes.find((n: any) => n.id === targetId);
      return target ? sanitizeNodeId(target.title || target.label) : null;
    })
    .filter(Boolean)
    .join(',');
  return outgoing ? `  ${nodeId} -> {${outgoing}}` : null;
}).filter(Boolean).join('\n')}
\`\`\`

## 📋 Relationship Details
${graphData.edges.map((edge: any, index: number) => {
  const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source?.id || edge.source);
  const targetId = typeof edge.target === 'string' ? edge.target : (edge.target?.id || edge.target);
  const sourceNode = graphData.nodes.find((n: any) => n.id === sourceId);
  const targetNode = graphData.nodes.find((n: any) => n.id === targetId);
  const sourceTitle = sourceNode?.title || sourceNode?.label || `Unknown (ID: ${sourceId})`;
  const targetTitle = targetNode?.title || targetNode?.label || `Unknown (ID: ${targetId})`;
  const strength = edge.strength ? ` (強度: ${edge.strength.toFixed(2)})` : '';
  const evidence = edge.evidence ? `\n  - **Evidence**: ${edge.evidence}` : '';
  const description = edge.description ? `\n  - **Description**: ${edge.description}` : '';
  return `### Relationship ${index + 1}: ${edge.relationship || 'related'}
- **Source**: [[${sourceTitle}]]
- **Target**: [[${targetTitle}]]${strength}${evidence}${description}`;
}).join('\n\n')}

## 🎯 Juggl Configuration
> **For Juggl Plugin**: 
> - Install the [Juggl plugin](https://github.com/HEmile/juggl) from Obsidian Community Plugins
> - Node styles are defined via \`cssclasses: [juggl-node-paper]\`
> - Relationship types are stored in \`type::\` fields
> - Strength values are available in \`strength::\` fields
> - Use the Juggl code block above to render an interactive graph view
> - Click on any paper node to see its details and relationships

### How to View the Graph:
1. **Obsidian Native Graph View**: Press \`Ctrl+G\` (Windows/Linux) or \`Cmd+G\` (Mac) to open the global graph view
2. **Juggl Plugin**: Install Juggl from Community Plugins, then open this note to see the interactive graph
3. **Mermaid Diagram**: The Mermaid diagram above renders automatically in Obsidian

## 📝 My Analysis Notes
<!-- Add your manual analysis and insights here -->

---
*Knowledge graph auto-generated on ${new Date().toLocaleString('zh-TW')}*
*Compatible with Obsidian Juggl & Dataview plugins*
`;
  };

  // Obsidian sync functionality
  const syncToObsidian = async () => {
    if (!graphData) {
      setSyncStatus('❌ 沒有圖數據可同步');
      setTimeout(() => setSyncStatus(null), 3000);
      return;
    }

    // For REST API mode, use browser-side sync
    if (obsidianSyncMode === 'rest') {
      await syncToObsidianViaApi();
      return;
    }

    // For local mode, require vault path
    if (obsidianSyncMode === 'local' && !obsidianPath.trim()) {
      setSyncStatus('❌ 請輸入 Obsidian vault 路徑');
      setTimeout(() => setSyncStatus(null), 3000);
      return;
    }

    setIsSyncing(true);
    setSyncStatus(obsidianSyncMode === 'zip' ? '正在生成 ZIP 文件...' : '正在同步到 Obsidian...');

    try {
      // Convert frontend GraphData format to backend expected format
      const backendGraphData = {
        nodes: graphData.nodes.map((node) => ({
          id: node.id,
          title: node.title || node.label || node.id,
          authors: node.authors || [],
          abstract: node.abstract || '',
          introduction: node.introduction || '',
          url: node.url || '',
          tags: node.tags || [],
          year: node.year,
          venue: node.venue,
          conference: node.conference,
          citationCount: node.citationCount || node.paperCitationCount,
          doi: node.doi,
          arxivId: node.arxivId,
        })),
        edges: graphData.edges.map((edge) => {
          // Handle both string IDs and node objects (from D3)
          const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
          const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
          
          return {
            source: sourceId,
            target: targetId,
            relationship: edge.relationship || '',
            strength: edge.strength || 1,
            evidence: edge.evidence || '',
            description: edge.description || edge.relationship || '',
          };
        }),
      };

      // Build vault path with subfolder if provided (only for local mode)
      let finalVaultPath: string | undefined = undefined;
      if (obsidianSyncMode === 'local') {
        finalVaultPath = obsidianPath.trim().replace(/^["']|["']$/g, '');
        if (obsidianSubfolder.trim()) {
          const subfolder = obsidianSubfolder.trim().replace(/^["']|["']$/g, '');
          finalVaultPath = `${finalVaultPath}/${subfolder}`;
        }
      }

      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/graph/sync-to-obsidian`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          graphData: backendGraphData,
          graphName: `Paper Graph ${new Date().toLocaleDateString()}`,
          vaultPath: finalVaultPath,
          exportMode: obsidianSyncMode,
        }),
      });

      // Handle ZIP download
      if (obsidianSyncMode === 'zip') {
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Paper_Graph_${new Date().toISOString().split('T')[0]}.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          setSyncStatus('✅ ZIP 文件下載成功！請解壓到您的 Obsidian vault 文件夾');
        } else {
          const result = await response.json();
          setSyncStatus(`❌ 生成失敗: ${result.error || result.message || '未知錯誤'}`);
        }
      } else {
        // Handle local sync
        const result = await response.json();
        if (result.success) {
          setSyncStatus(`✅ ${result.message}`);
        } else {
          setSyncStatus(`❌ 同步失敗: ${result.error || result.message || '未知錯誤'}`);
        }
      }
    } catch (error) {
      console.error('Obsidian sync error:', error);
      setSyncStatus(`❌ 同步失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#1e1e1e' }}>
      {/* Main Content Area - Uses flex-1 to automatically adjust height based on bottom section */}
      <div className="flex-1 min-h-0 flex gap-1 overflow-hidden">
        
        {/* Left Column - Configuration with Resizable Sidebar */}
        {!isConfigCollapsed && (
          <ResizableSidebar
            initialWidth={320}
            minWidth={250}
            maxWidth={500}
            position="left"
            collapsed={false}
            onCollapseChange={setIsConfigCollapsed}
            onWidthChange={setLeftSidebarWidth}
            collapsedWidth={50}
          >
        <div className="h-full flex flex-col overflow-hidden min-w-0">
          {/* Analysis Configuration - Professional scrollable panel with Tailwind classes */}
          <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-5 shadow-xl 
                         bg-gradient-to-br from-obsidian-card to-obsidian-hover
                         border-r-2 border-obsidian-border 
                         rounded-tl-2xl rounded-bl-2xl
                         scrollbar-academic transition-all duration-300">
          {/* Header Section - Professional academic styling */}
          <div className="flex items-center justify-between mb-5 pb-3 border-b-2" style={{ borderColor: 'rgba(100, 200, 100, 0.3)' }}>
              <h2 className="text-lg font-semibold tracking-wide" style={{ color: '#e8e8e8', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                Analysis Configuration
              </h2>
            <button
                onClick={() => setIsConfigCollapsed(true)}
                className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
              style={{ 
                backgroundColor: '#2d2d2d', 
                color: '#64c864', 
                border: '1px solid rgba(100, 200, 100, 0.2)' 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                title="Collapse configuration panel"
            >
                <ExpandLessIcon className="w-4 h-4" />
                <span>Hide</span>
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
                {/* Sync Mode Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-medium" style={{ color: '#b8b8b8' }}>
                    同步模式
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setObsidianSyncMode('local')}
                      className="px-3 py-2 rounded text-sm font-medium transition-all"
                      style={{
                        backgroundColor: obsidianSyncMode === 'local' ? '#64c864' : '#2d2d2d',
                        color: obsidianSyncMode === 'local' ? '#1e1e1e' : '#e8e8e8',
                        border: `1px solid ${obsidianSyncMode === 'local' ? '#64c864' : 'rgba(100, 200, 100, 0.3)'}`,
                      }}
                    >
                      本地路徑
                    </button>
                    <button
                      type="button"
                      onClick={() => setObsidianSyncMode('zip')}
                      className="px-3 py-2 rounded text-sm font-medium transition-all"
                      style={{
                        backgroundColor: obsidianSyncMode === 'zip' ? '#64c864' : '#2d2d2d',
                        color: obsidianSyncMode === 'zip' ? '#1e1e1e' : '#e8e8e8',
                        border: `1px solid ${obsidianSyncMode === 'zip' ? '#64c864' : 'rgba(100, 200, 100, 0.3)'}`,
                      }}
                    >
                      📁 下載 ZIP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setObsidianSyncMode('rest');
                        if (apiAvailable === null) {
                          checkObsidianApi();
                        }
                      }}
                      className="px-3 py-2 rounded text-sm font-medium transition-all relative"
                      style={{
                        backgroundColor: obsidianSyncMode === 'rest' ? '#64c864' : '#2d2d2d',
                        color: obsidianSyncMode === 'rest' ? '#1e1e1e' : '#e8e8e8',
                        border: `1px solid ${obsidianSyncMode === 'rest' ? '#64c864' : 'rgba(100, 200, 100, 0.3)'}`,
                      }}
                    >
                      REST API
                      {apiAvailable === true && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                      )}
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: '#888888' }}>
                    {obsidianSyncMode === 'local' 
                      ? '💡 本地開發：直接寫入 Obsidian vault 文件夾'
                      : obsidianSyncMode === 'zip'
                      ? '💡 部署環境：下載 ZIP 文件，解壓到 Obsidian vault'
                      : '💡 自動同步：通過 Obsidian REST API 插件自動寫入（需安裝插件）'}
                  </p>
                </div>

                {/* REST API Configuration (only show for REST API mode) */}
                {obsidianSyncMode === 'rest' && (
                  <div className="space-y-2">
                    <div className="p-3 rounded" style={{ backgroundColor: '#252525', border: '1px solid rgba(100, 200, 100, 0.2)' }}>
                      <p className="text-xs font-medium mb-2" style={{ color: '#64c864' }}>
                        📖 使用說明：
                      </p>
                      <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: '#b8b8b8' }}>
                        <li>在 Obsidian 中安裝 "Local REST API" 插件</li>
                        <li>打開插件設置，複製 API Key</li>
                        <li>確保 Obsidian 正在運行</li>
                        <li>在下方輸入 API Key 即可使用</li>
                      </ol>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={obsidianApiUrl}
                        onChange={(e) => setObsidianApiUrl(e.target.value)}
                        placeholder="API URL (default: http://127.0.0.1:27123)"
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
                        type="button"
                        onClick={checkObsidianApi}
                        disabled={isCheckingApi}
                        className="px-3 py-2 rounded text-sm font-medium transition-all"
                        style={{
                          backgroundColor: isCheckingApi ? '#252525' : '#64c864',
                          color: isCheckingApi ? '#888888' : '#1e1e1e',
                          border: '1px solid rgba(100, 200, 100, 0.3)',
                          cursor: isCheckingApi ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isCheckingApi ? '檢查中...' : '檢查'}
                      </button>
                    </div>
                    {apiAvailable === true && (
                      <p className="text-xs" style={{ color: '#64c864' }}>
                        ✅ Obsidian REST API 可用
                      </p>
                    )}
                    {apiAvailable === false && (
                      <p className="text-xs" style={{ color: '#ff6b6b' }}>
                        ❌ 無法連接到 Obsidian REST API。請確認：
                        <br />1. 已安裝 Local REST API 插件
                        <br />2. 插件已啟用並運行
                        <br />3. API URL 正確
                      </p>
                    )}
                    <input
                      type="password"
                      value={obsidianApiKey}
                      onChange={(e) => saveApiKey(e.target.value)}
                      placeholder="Obsidian REST API Key（從插件設置中複製）"
                      className="form-input w-full text-sm focus:outline-none"
                      style={{
                        borderColor: 'rgba(100, 200, 100, 0.3)',
                        backgroundColor: '#2d2d2d',
                        color: '#e8e8e8',
                        borderRadius: '8px',
                        padding: '8px 12px'
                      }}
                    />
                    <p className="text-xs" style={{ color: '#888888' }}>
                      💡 API Key 會保存在瀏覽器中，無需每次輸入
                    </p>
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
                )}

                {/* ZIP Mode - Direct Download Button */}
                {obsidianSyncMode === 'zip' && (
                  <button
                    onClick={syncToObsidian}
                    disabled={isSyncing || !graphData}
                    className="w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: (isSyncing || !graphData)
                        ? '#252525'
                        : 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)',
                      color: (isSyncing || !graphData) ? '#888888' : '#1e1e1e',
                      borderRadius: '8px',
                      border: (isSyncing || !graphData)
                        ? '1px solid rgba(100, 200, 100, 0.2)' 
                        : 'none',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      cursor: (isSyncing || !graphData) ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      boxShadow: (isSyncing || !graphData)
                        ? 'none' 
                        : '0 2px 8px rgba(100, 200, 100, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSyncing && graphData) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(100, 200, 100, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSyncing && graphData) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(100, 200, 100, 0.3)';
                      }
                    }}
                  >
                    {isSyncing ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#1e1e1e' }}>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: '#1e1e1e' }}></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ color: '#1e1e1e' }}></path>
                        </svg>
                        <span>生成中...</span>
                      </>
                    ) : (
                      <span>📁 下載 ZIP</span>
                    )}
                  </button>
                )}

                {/* Local Path Inputs (only show for local mode) */}
                {obsidianSyncMode === 'local' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={obsidianPath}
                      onChange={(e) => setObsidianPath(e.target.value)}
                      placeholder="Obsidian vault path (e.g., C:\Users\YourName\Documents\MyVault)"
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
                    <button
                      onClick={syncToObsidian}
                      disabled={isSyncing || !graphData || !obsidianPath.trim()}
                      className="w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: (isSyncing || !graphData || !obsidianPath.trim())
                          ? '#252525'
                          : 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)',
                        color: (isSyncing || !graphData || !obsidianPath.trim()) ? '#888888' : '#1e1e1e',
                        borderRadius: '8px',
                        border: (isSyncing || !graphData || !obsidianPath.trim())
                          ? '1px solid rgba(100, 200, 100, 0.2)' 
                          : 'none',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        cursor: (isSyncing || !graphData || !obsidianPath.trim()) ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        boxShadow: (isSyncing || !graphData || !obsidianPath.trim())
                          ? 'none' 
                          : '0 2px 8px rgba(100, 200, 100, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSyncing && graphData && obsidianPath.trim()) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(100, 200, 100, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSyncing && graphData && obsidianPath.trim()) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(100, 200, 100, 0.3)';
                        }
                      }}
                    >
                      {isSyncing ? (
                        <>
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#1e1e1e' }}>
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: '#1e1e1e' }}></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ color: '#1e1e1e' }}></path>
                          </svg>
                          <span>同步中...</span>
                        </>
                      ) : (
                        <span>📁 同步到 Obsidian</span>
                      )}
                    </button>
                  </div>
                )}

                {/* REST API Sync Button (only show for REST API mode) */}
                {obsidianSyncMode === 'rest' && (
                  <button
                    onClick={syncToObsidian}
                    disabled={isSyncing || !graphData || !obsidianApiKey.trim()}
                    className="w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: (isSyncing || !graphData || !obsidianApiKey.trim())
                        ? '#252525'
                        : 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)',
                      color: (isSyncing || !graphData || !obsidianApiKey.trim()) ? '#888888' : '#1e1e1e',
                      borderRadius: '8px',
                      border: (isSyncing || !graphData || !obsidianApiKey.trim())
                        ? '1px solid rgba(100, 200, 100, 0.2)' 
                        : 'none',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      cursor: (isSyncing || !graphData || !obsidianApiKey.trim()) ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      boxShadow: (isSyncing || !graphData || !obsidianApiKey.trim())
                        ? 'none' 
                        : '0 2px 8px rgba(100, 200, 100, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSyncing && graphData && obsidianApiKey.trim()) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(100, 200, 100, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSyncing && graphData && obsidianApiKey.trim()) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(100, 200, 100, 0.3)';
                      }
                    }}
                  >
                    {isSyncing ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#1e1e1e' }}>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: '#1e1e1e' }}></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ color: '#1e1e1e' }}></path>
                        </svg>
                        <span>同步中...</span>
                      </>
                    ) : (
                      <span>📁 同步到 Obsidian</span>
                    )}
                  </button>
                )}
                
                {syncStatus && (
                  <div 
                    className="text-sm p-2 rounded"
                    style={{
                      backgroundColor: syncStatus.includes('✅') 
                        ? 'rgba(100, 200, 100, 0.2)' 
                        : 'rgba(239, 68, 68, 0.2)',
                      color: syncStatus.includes('✅') ? '#64c864' : '#ef4444',
                      border: `1px solid ${syncStatus.includes('✅') ? 'rgba(100, 200, 100, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    {syncStatus}
                  </div>
                )}
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

          {/* New Analysis Button - Below Start Analysis */}
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to start a new analysis? This will clear all current results.')) {
                // Clear all state
                setGraphData(null);
                setPriorWorksData({});
                setDerivativeWorksData({});
                setAllPriorWorks([]);
                setAllDerivativeWorks([]);
                setCurrentSessionId(null);
                setProgress(0);
                setProgressInfo(undefined);
                setError(null);
                setIsLoading(false);
                // Reset view mode
                setViewMode('graph');
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="w-full px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 mt-3"
            style={{
              backgroundColor: 'rgba(100, 200, 100, 0.15)',
              color: '#64c864',
              border: '1px solid rgba(100, 200, 100, 0.3)',
              borderRadius: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(100, 200, 100, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(100, 200, 100, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
            }}
            title="Start New Analysis"
          >
            <AddCircleOutlineIcon style={{ fontSize: '20px' }} />
            <span>New Analysis</span>
          </button>
          </>
          )}
          </div>
        </div>
        </ResizableSidebar>
        )}

        {/* Center Column - Main Content with Mode Switching */}
        <div className="flex-1 h-full overflow-hidden relative flex flex-col" style={{ backgroundColor: '#1e1e1e' }}>
        {/* Header with Mode Tabs - Professional Tab Design - Always visible */}
        <div className="border-b relative" style={{ 
          borderColor: 'rgba(100, 200, 100, 0.2)',
          backgroundColor: '#252525',
          zIndex: 10,
        }}>
            <div 
              className="flex items-center justify-between border-b" 
              style={{ 
                borderColor: 'rgba(100, 200, 100, 0.1)',
                paddingLeft: '16px',
                paddingRight: '16px',
              }}
            >
              {/* Left side: Configuration button and tabs */}
              <div className="flex items-center">
                {/* Configuration Toggle Button - Inside tabs bar when collapsed (show when loading or have graphData) */}
                {isConfigCollapsed && (
            <button
                    onClick={() => setIsConfigCollapsed(false)}
                    className="px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-2 mr-4"
              style={{
                      backgroundColor: '#2d2d2d',
                      color: '#64c864',
                border: '1px solid rgba(100, 200, 100, 0.3)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                height: '42px',
                display: 'flex',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#252525';
                  e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
              }}
              onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2d2d2d';
                  e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
              }}
            >
                    <SettingsIcon className="w-4 h-4" />
                    <span>Show Configuration</span>
            </button>
                )}
              <button
                onClick={() => setViewMode('graph')}
                className="px-6 py-3 text-sm font-semibold transition-all duration-200 relative"
                style={{
                  backgroundColor: viewMode === 'graph' ? 'transparent' : 'transparent',
                  color: viewMode === 'graph' ? '#64c864' : '#b8b8b8',
                  borderBottom: viewMode === 'graph' ? '2px solid #64c864' : '2px solid transparent',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontWeight: viewMode === 'graph' ? 600 : 500,
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'graph') {
                    e.currentTarget.style.color = '#e8e8e8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'graph') {
                    e.currentTarget.style.color = '#b8b8b8';
                  }
                }}
              >
                <BarChartIcon className="w-4 h-4 mr-2 inline" style={{ verticalAlign: 'middle' }} /> 
                Graph View
              </button>
              <button
                onClick={() => setViewMode('prior-works')}
                className="px-6 py-3 text-sm font-semibold transition-all duration-200 relative"
                style={{
                  backgroundColor: viewMode === 'prior-works' ? 'transparent' : 'transparent',
                  color: viewMode === 'prior-works' ? '#64c864' : '#b8b8b8',
                  borderBottom: viewMode === 'prior-works' ? '2px solid #64c864' : '2px solid transparent',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontWeight: viewMode === 'prior-works' ? 600 : 500,
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'prior-works') {
                    e.currentTarget.style.color = '#e8e8e8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'prior-works') {
                    e.currentTarget.style.color = '#b8b8b8';
                  }
                }}
              >
                <MenuBookIcon className="w-4 h-4 mr-2 inline" style={{ verticalAlign: 'middle' }} /> 
                Prior Works
                {allPriorWorks.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{
                    backgroundColor: viewMode === 'prior-works' ? 'rgba(100, 200, 100, 0.2)' : 'rgba(100, 200, 100, 0.1)',
                    color: '#64c864',
                  }}>
                    {allPriorWorks.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setViewMode('derivative-works')}
                className="px-6 py-3 text-sm font-semibold transition-all duration-200 relative"
                style={{
                  backgroundColor: viewMode === 'derivative-works' ? 'transparent' : 'transparent',
                  color: viewMode === 'derivative-works' ? '#64c864' : '#b8b8b8',
                  borderBottom: viewMode === 'derivative-works' ? '2px solid #64c864' : '2px solid transparent',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontWeight: viewMode === 'derivative-works' ? 600 : 500,
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'derivative-works') {
                    e.currentTarget.style.color = '#e8e8e8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'derivative-works') {
                    e.currentTarget.style.color = '#b8b8b8';
                  }
                }}
              >
                <LinkIcon className="w-4 h-4 mr-2 inline" style={{ verticalAlign: 'middle' }} /> 
                Derivative Works
                {allDerivativeWorks.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{
                    backgroundColor: viewMode === 'derivative-works' ? 'rgba(100, 200, 100, 0.2)' : 'rgba(100, 200, 100, 0.1)',
                    color: '#64c864',
                  }}>
                    {allDerivativeWorks.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setViewMode('citation-extractor')}
                className="px-6 py-3 text-sm font-semibold transition-all duration-200 relative"
                style={{
                  backgroundColor: viewMode === 'citation-extractor' ? 'transparent' : 'transparent',
                  color: viewMode === 'citation-extractor' ? '#64c864' : '#b8b8b8',
                  borderBottom: viewMode === 'citation-extractor' ? '2px solid #64c864' : '2px solid transparent',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontWeight: viewMode === 'citation-extractor' ? 600 : 500,
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'citation-extractor') {
                    e.currentTarget.style.color = '#e8e8e8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'citation-extractor') {
                    e.currentTarget.style.color = '#b8b8b8';
                  }
                }}
              >
                <DescriptionIcon className="w-4 h-4 mr-2 inline" style={{ verticalAlign: 'middle' }} /> 
                Citation Extractor
              </button>
            </div>

              {/* Right side: Guide button */}
              {!showGuideSidebar && (
                <button
                  onClick={() => setShowGuideSidebar(true)}
                  className="px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-2"
                  style={{
                    backgroundColor: '#2d2d2d',
                    color: '#64c864',
                    border: '1px solid rgba(100, 200, 100, 0.3)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontWeight: 600,
                    fontSize: '14px',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#252525';
                    e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#2d2d2d';
                    e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
                  }}
                >
                  <BookIcon className="w-4 h-4" />
                  <span>Show Guide</span>
                </button>
              )}
            </div>
          </div>

        {/* Top Right - Show Guide button when no graphData and not loading */}
        {!graphData && !isLoading && !showGuideSidebar && (
          <div className="absolute top-1 right-4 z-50">
            <button
              onClick={() => setShowGuideSidebar(true)}
              className="px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-2"
              style={{
                backgroundColor: '#2d2d2d',
                color: '#64c864',
                border: '1px solid rgba(100, 200, 100, 0.3)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                height: '42px',
                display: 'flex',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#252525';
                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2d2d2d';
                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
              }}
            >
              <BookIcon className="w-4 h-4" />
              <span>Show Guide</span>
            </button>
          </div>
        )}

        {/* Top Left Button - Configuration Toggle - Only show when sidebar is hidden, no graphData, and not loading */}
        {isConfigCollapsed && !graphData && !isLoading && (
          <div 
            className="absolute left-4 top-1 z-[100] flex items-center gap-2" 
          >
            <button
              onClick={() => setIsConfigCollapsed(false)}
              className="px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-2"
              style={{
                backgroundColor: '#2d2d2d',
                color: '#64c864',
                border: '1px solid rgba(100, 200, 100, 0.3)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                zIndex: 100,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#252525';
                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2d2d2d';
                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
              }}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Show Configuration</span>
            </button>
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
                    key={currentSessionId || 'default'} // Force re-render when session changes
                    data={graphData} 
                    onDataUpdate={handleGraphDataUpdate}
                    isLoading={isLoading || sessionLoading}
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
                                  const aAuthor = getDisplayAuthor(a.authors, showFirstAuthor);
                                  const bAuthor = getDisplayAuthor(b.authors, showFirstAuthor);
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
                                  {getDisplayAuthor(work.authors, showFirstAuthor)}
                                </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.year || 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {typeof work.citationCount === 'number' ? (
                                  work.citationCount.toLocaleString()
                                ) : (
                                  <span style={{ opacity: 0.6, fontStyle: 'italic' }} title="Citation count not available">N/A</span>
                                )}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {typeof work.strength === 'number' ? work.strength.toFixed(2) : '0.00'}
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
                                  const aAuthor = getDisplayAuthor(a.authors, showDerivativeFirstAuthor);
                                  const bAuthor = getDisplayAuthor(b.authors, showDerivativeFirstAuthor);
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
                                  {getDisplayAuthor(work.authors, showDerivativeFirstAuthor)}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {work.year || 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {typeof work.citationCount === 'number' ? work.citationCount.toLocaleString() : 'N/A'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#e8e8e8' }}>
                                {typeof work.strength === 'number' ? work.strength.toFixed(2) : 'N/A'}
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
          
          {viewMode === 'citation-extractor' && (
            <div className="h-full overflow-y-auto p-6" style={{ backgroundColor: '#1e1e1e' }}>
              <div className="max-w-6xl mx-auto">
                <h2 className="text-2xl font-bold mb-6" style={{ 
                  color: '#e8e8e8',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  Citation Extractor
                </h2>
                
                <div className="mb-6">
                  <div className="flex gap-3 mb-4">
                    <input
                      type="url"
                      value={citationUrl}
                      onChange={(e) => setCitationUrl(e.target.value)}
                      placeholder="Enter paper URL for citation extraction (e.g., https://arxiv.org/abs/2305.10403)"
                      className="flex-1 text-sm focus:outline-none"
                      style={{
                        borderColor: 'rgba(100, 200, 100, 0.3)',
                        backgroundColor: '#2d2d2d',
                        color: '#e8e8e8',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        border: '1px solid rgba(100, 200, 100, 0.3)',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}
                    />
                    <button
                      onClick={extractCitations}
                      disabled={isExtracting || !citationUrl}
                      className="px-6 py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all duration-200 font-semibold"
                      style={{
                        background: isExtracting || !citationUrl 
                          ? '#252525' 
                          : 'linear-gradient(135deg, #64c864 0%, #4ade80 100%)',
                        color: isExtracting || !citationUrl ? '#888888' : '#1e1e1e',
                        borderRadius: '8px',
                        border: isExtracting || !citationUrl ? '1px solid rgba(100, 200, 100, 0.2)' : 'none',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        cursor: isExtracting || !citationUrl ? 'not-allowed' : 'pointer',
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
                        <span>Extract Citations</span>
                      )}
                    </button>
                  </div>

                  {/* Citation Format Selector */}
                  {rawCitations.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2" style={{ 
                        color: '#e8e8e8',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        Citation Format:
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {(['apa', 'ieee', 'mla', 'chicago', 'plain'] as const).map((format) => (
                          <button
                            key={format}
                            onClick={() => setCitationFormat(format)}
                            className="px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg"
                            style={{
                              backgroundColor: citationFormat === format ? '#64c864' : '#2d2d2d',
                              color: citationFormat === format ? '#1e1e1e' : '#e8e8e8',
                              border: `1px solid ${citationFormat === format ? '#64c864' : 'rgba(100, 200, 100, 0.3)'}`,
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              if (citationFormat !== format) {
                                e.currentTarget.style.backgroundColor = '#252525';
                                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (citationFormat !== format) {
                                e.currentTarget.style.backgroundColor = '#2d2d2d';
                                e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
                              }
                            }}
                          >
                            {format.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {citationResults && (
                  <div className="p-6 rounded-lg border" style={{
                    backgroundColor: '#2d2d2d',
                    border: '1px solid rgba(100, 200, 100, 0.3)',
                    borderRadius: '12px'
                  }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold" style={{ 
                        color: '#e8e8e8',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        Extracted Citations ({citationResults.split('\n').length} total) - {citationFormat.toUpperCase()} Format
                      </h3>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(citationResults);
                          alert('Citations copied to clipboard!');
                        }}
                        className="px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg"
                        style={{
                          backgroundColor: '#252525',
                          color: '#64c864',
                          border: '1px solid rgba(100, 200, 100, 0.3)',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#2d2d2d';
                          e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#252525';
                          e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
                        }}
                      >
                        Copy All
                      </button>
                    </div>
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-academic" style={{ 
                      fontFamily: citationFormat === 'plain' ? 'monospace' : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
                      fontSize: '14px',
                      lineHeight: '1.8'
                    }}>
                      {citationResults.split('\n').map((citation, index) => (
                        <div key={index}                         style={{ 
                          color: '#e8e8e8',
                          padding: '12px 16px',
                          backgroundColor: '#252525',
                          borderRadius: '8px',
                          border: '1px solid rgba(100, 200, 100, 0.1)',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#2a2a2a';
                          e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#252525';
                          e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.1)';
                        }}
                        >
                          <span style={{ flex: 1, lineHeight: '1.8' }}>{citation}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(citation);
                              // Show temporary feedback
                              const btn = e.currentTarget;
                              const originalHTML = btn.innerHTML;
                              btn.innerHTML = '<span style="font-size: 11px; font-weight: 600;">copied</span>';
                              btn.style.color = '#64c864';
                              setTimeout(() => {
                                btn.innerHTML = originalHTML;
                                btn.style.color = '#b8b8b8';
                              }, 1500);
                            }}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#b8b8b8',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease',
                              borderRadius: '4px',
                              minWidth: '24px',
                              minHeight: '24px',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#2d2d2d';
                              e.currentTarget.style.color = '#64c864';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#b8b8b8';
                            }}
                            title="Copy this citation"
                          >
                            <CopyIcon style={{ width: '16px', height: '16px' }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {!graphData && !isLoading && viewMode === 'graph' && (
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

      {/* Guide Sidebar - Right side resizable panel */}
      {showGuideSidebar && (
        <ResizableSidebar
          initialWidth={350}
          minWidth={250}
          maxWidth={600}
          position="right"
          collapsed={false}
          onCollapseChange={(collapsed) => {
            if (collapsed) {
              setShowGuideSidebar(false);
            }
          }}
          onWidthChange={setRightSidebarWidth}
          collapsedWidth={50}
        >
          <div className="h-full overflow-y-auto scrollbar-academic p-5" style={{
            backgroundColor: '#252525',
          }}>
            {/* Header with Close Button */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b-2" style={{ borderColor: 'rgba(100, 200, 100, 0.3)' }}>
              <h2 
                className="text-lg font-semibold"
                style={{
                  color: '#e8e8e8',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              >
                User Guide
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
                title="Close Guide"
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
        </ResizableSidebar>
      )}
      </div>
    </div>
  );
};

export default PaperGraphPage;
