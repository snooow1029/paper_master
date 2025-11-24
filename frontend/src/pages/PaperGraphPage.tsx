import React, { useState } from 'react';
import GraphVisualization from '../components/GraphVisualization';
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
  const [error, setError] = useState<string | null>(null);
  
  // 保存用户输入的原始论文 URLs（用于 Prior/Derivative Works）
  const [originalPaperUrls, setOriginalPaperUrls] = useState<string[]>([]);
  
  // 多模式切换状态（类似 Connected Papers）
  type ViewMode = 'graph' | 'prior-works' | 'derivative-works';
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  
  // Prior Works 和 Derivative Works 数据（从分析结果中获取）
  const [priorWorksData, setPriorWorksData] = useState<Record<string, any[]>>({});
  const [derivativeWorksData, setDerivativeWorksData] = useState<Record<string, any[]>>({});
  
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
  const [showBottomSection, setShowBottomSection] = useState(true);

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

  // Main analysis function
  const handleAnalyze = async () => {
    const validUrls = urls.filter(url => url.trim());
    if (validUrls.length === 0) {
      setError('Please enter at least one valid URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 使用原本的圖分析API
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
            const workTitle = (work.title || '').toLowerCase();
            
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
    <div className="h-screen flex flex-col overflow-hidden bg-academic-cream">
      {/* Main Content Area - Uses flex-1 to automatically adjust height based on bottom section */}
      <div className={`flex-1 min-h-0 grid gap-1 overflow-hidden ${isConfigCollapsed ? 'grid-cols-[50px_1fr]' : 'grid-cols-[320px_1fr]'}`}>
        
        {/* Left Column - Configuration */}
        <div className="h-full flex flex-col overflow-hidden min-w-0">
          {/* Analysis Configuration - Professional scrollable panel with Tailwind classes */}
          <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-5 shadow-xl 
                         bg-gradient-to-br from-academic-beige to-academic-beige/95
                         border-r-2 border-academic-lightBeige 
                         rounded-tl-2xl rounded-bl-2xl
                         scrollbar-academic transition-all duration-300">
          {/* Header Section - Professional academic styling */}
          <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-academic-purple/40">
            {!isConfigCollapsed && (
              <h2 className="text-lg font-semibold font-serif text-academic-cream tracking-wide">
                Analysis Configuration
              </h2>
            )}
            <button
              onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
              className="ml-auto px-3 py-1.5 rounded-lg 
                         bg-academic-lightBeige/80 hover:bg-academic-lightBeige
                         text-academic-darkBrown text-sm font-medium
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
              <h3 className="text-sm font-medium" style={{ color: '#F5F5DC' }}>Paper URLs</h3>
              <button
                onClick={fillExampleUrls}
                className="px-2 py-1 text-xs rounded hover:opacity-90 transition-colors"
                style={{
                  backgroundColor: '#D2CBBF',
                  color: '#5D4037'
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
                      borderColor: '#D2CBBF',
                      backgroundColor: '#F5F5DC',
                      color: '#5D4037'
                    }}
                  />
                </div>
                {urls.length > 2 && (
                  <button
                    onClick={() => removeUrl(index)}
                    className="px-2 py-2 rounded text-xs hover:opacity-90"
                    title="Remove"
                    style={{
                      backgroundColor: '#B89B74',
                      color: '#F5F5DC'
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
                borderColor: '#BDB4D3',
                color: '#707C5D'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#BDB4D3';
                e.currentTarget.style.color = '#5D4037';
                e.currentTarget.style.backgroundColor = '#D2CBBF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#BDB4D3';
                e.currentTarget.style.color = '#707C5D';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <AddIcon className="w-4 h-4 mr-1 inline" /> Add Paper
            </button>
          </div>

          {/* Filter Toggle */}
          <div className="mb-4 p-3 rounded border" style={{
            backgroundColor: 'var(--green-50)',
            borderColor: 'var(--green-200)'
          }}>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="filterSections"
                checked={filterSections}
                onChange={(e) => setFilterSections(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: '#BDB4D3' }}
              />
              <label htmlFor="filterSections" className="text-xs font-medium" style={{ 
                color: '#5D4037',
                fontFamily: '"Lora", "Merriweather", "Georgia", serif'
              }}>
                <FilterListIcon className="w-4 h-4 mr-1 inline" /> Smart Section Filter
              </label>
            </div>
            <p className="text-xs mt-1" style={{ color: '#707C5D' }}>
              {filterSections 
                ? 'Analyze key sections only (recommended)'
                : 'Analyze all sections'
              }
            </p>
          </div>

          {/* Network Expansion Depth */}
          <div className="mb-4 p-3 rounded border" style={{
            backgroundColor: '#D2CBBF',
            borderColor: '#A39A86'
          }}>
            <span className="text-xs font-medium block mb-2" style={{ 
              color: '#5D4037',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif'
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
                    style={{ accentColor: '#BDB4D3' }}
                  />
                  <span className="text-xs" style={{ color: '#707C5D' }}>
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
                backgroundColor: '#D2CBBF',
                borderColor: '#A39A86',
                color: '#5D4037',
                fontFamily: '"Lora", "Merriweather", "Georgia", serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#BDB4D3';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#D2CBBF';
              }}
            >
              <span className="font-medium flex items-center gap-2">
                <DescriptionIcon className="w-4 h-4" /> Citation Extractor
              </span>
              {showCitationExtractor ? (
                <ExpandMoreIcon className="w-4 h-4" style={{ color: '#707C5D' }} />
              ) : (
                <ExpandLessIcon className="w-4 h-4 rotate-180" style={{ color: '#707C5D' }} />
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
                      borderColor: '#A39A86',
                      backgroundColor: '#F5F5DC',
                      color: '#5D4037',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                  />
                  <button
                    onClick={extractCitations}
                    disabled={isExtracting || !citationUrl}
                    className="btn-primary px-3 py-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all duration-200"
                    style={{
                      backgroundColor: isExtracting || !citationUrl ? '#A39A86' : '#BDB4D3',
                      color: '#F5F5DC',
                      borderRadius: '8px',
                      border: 'none',
                      fontFamily: '"Lora", "Merriweather", "Georgia", serif',
                      minWidth: '90px',
                      cursor: isExtracting || !citationUrl ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isExtracting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#F5F5DC' }}>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: '#F5F5DC' }}></circle>
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
                    backgroundColor: '#F5F5DC',
                    border: '1px solid #A39A86',
                    borderRadius: '8px'
                  }}>
                    <h4 className="font-semibold mb-2" style={{ 
                      color: '#5D4037',
                      fontFamily: '"Lora", "Merriweather", "Georgia", serif'
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
                                  color: '#BDB4D3', 
                                  fontWeight: '600',
                                  marginTop: '4px',
                                  cursor: 'pointer',
                                  textDecoration: 'underline'
                                }}
                                onClick={() => setShowAllCitations(true)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#A39A86';
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
                                  color: '#BDB4D3', 
                                  fontWeight: '600',
                                  marginTop: '4px',
                                  cursor: 'pointer',
                                  textDecoration: 'underline'
                                }}
                                onClick={() => setShowAllCitations(false)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#A39A86';
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
                backgroundColor: '#D2CBBF',
                borderColor: '#A39A86',
                color: '#5D4037',
                fontFamily: '"Lora", "Merriweather", "Georgia", serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#BDB4D3';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#D2CBBF';
              }}
            >
              <span className="font-medium flex items-center gap-2">
                <SyncIcon className="w-4 h-4" /> Obsidian Sync
              </span>
              {showObsidianSync ? (
                <ExpandMoreIcon className="w-4 h-4" style={{ color: '#707C5D' }} />
              ) : (
                <ExpandLessIcon className="w-4 h-4 rotate-180" style={{ color: '#707C5D' }} />
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
                      borderColor: '#A39A86',
                      backgroundColor: '#F5F5DC',
                      color: '#5D4037',
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
                      borderColor: '#A39A86',
                      backgroundColor: '#F5F5DC',
                      color: '#5D4037',
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
                ? '#A39A86' 
                : 'linear-gradient(135deg, #BDB4D3 0%, #f2f3f0ff 100%)',
              color: '#fafafaff',
              opacity: isLoading || urls.filter(u => u.trim()).length === 0 ? 0.6 : 1,
              borderRadius: '20px',
              border: 'none',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif',
              cursor: isLoading || urls.filter(u => u.trim()).length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#fafafaff' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: '#fafafaff' }}></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ color: '#fafafaff' }}></path>
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
        <div className="h-full overflow-hidden relative flex flex-col bg-[#F5F5DC]">
        {/* Header with Mode Tabs */}
        {graphData && (
          <div className="border-b" style={{ 
            borderColor: '#A39A86',
            background: 'linear-gradient(135deg, #c6bdddff 0%, #BDB4D3 0%)'
          }}>
            <div className="flex items-center justify-center border-b" style={{ borderColor: '#A39A86' }}>
              <button
                onClick={() => setViewMode('graph')}
                className="px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'graph' ? '#F5F5DC' : 'transparent',
                  color: viewMode === 'graph' ? '#5D4037' : '#F5F5DC',
                  borderBottom: viewMode === 'graph' ? '2px solid #BDB4D3' : '2px solid transparent',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
                }}
              >
                <BarChartIcon className="w-4 h-4 mr-1 inline" /> Graph
              </button>
              <button
                onClick={() => setViewMode('prior-works')}
                className="px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'prior-works' ? '#F5F5DC' : 'transparent',
                  color: viewMode === 'prior-works' ? '#5D4037' : '#F5F5DC',
                  borderBottom: viewMode === 'prior-works' ? '2px solid #BDB4D3' : '2px solid transparent',
                  fontFamily: '"Lora", "Merriweather", "Georgia", serif'
                }}
              >
                <MenuBookIcon className="w-4 h-4 mr-1 inline" /> Prior Works ({allPriorWorks.length})
              </button>
              <button
                onClick={() => setViewMode('derivative-works')}
                className="px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'derivative-works' ? '#F5F5DC' : 'transparent',
                  color: viewMode === 'derivative-works' ? '#5D4037' : '#F5F5DC',
                  borderBottom: viewMode === 'derivative-works' ? '2px solid #BDB4D3' : '2px solid transparent',
                  fontFamily: '"Lora", "Merriweather", "Georgia", serif'
                }}
              >
                <LinkIcon className="w-4 h-4 mr-1 inline" /> Derivative Works ({allDerivativeWorks.length})
              </button>
            </div>
          </div>
        )}
        
        {/* Content Area - Switch based on view mode */}
        <div className="flex-1 overflow-hidden">
          {graphData ? (
            <>
              {viewMode === 'graph' && (
                <GraphVisualization 
                  data={graphData} 
                  onDataUpdate={setGraphData}
                />
              )}
              
              {viewMode === 'prior-works' && (
                <div className="h-full overflow-y-auto p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="mb-4">
                    <h2 className="text-xl font-bold mb-2" style={{ color: '#5D4037', fontFamily: '"Lora", "Merriweather", "Georgia", serif' }}>
                      Prior Works
                    </h2>
                    <p className="text-sm mb-4" style={{ color: '#707C5D' }}>
                      These are papers that were most commonly cited by the papers in the graph.
                      This usually means that they are <strong>important seminal works</strong> for this field and it could be a good idea to get familiar with them.
                  </p>
                </div>
                  
                  {allPriorWorks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ backgroundColor: '#FFFFFF' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #BDB4D3', backgroundColor: '#F5F5DC' }}>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors" 
                              style={{ color: '#5D4037' }}
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
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'title' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▼
                                  </span>
                </div>
            </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold select-none" 
                              style={{ color: '#5D4037' }}
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="cursor-pointer hover:bg-gray-100 transition-colors px-1 py-1 rounded flex items-center gap-2"
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
                                        color: '#5D4037'
                                      }}
                                    >
                                      ▲
                                    </span>
                                    <span 
                                      style={{ 
                                        opacity: priorWorksSortField === 'lastAuthor' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                        color: '#5D4037'
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
                                    backgroundColor: showFirstAuthor ? '#BDB4D3' : '#D2CBBF',
                                    padding: '2px',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  title={showFirstAuthor ? 'Switch to Last author' : 'Switch to First author'}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = showFirstAuthor ? '#A39A86' : '#BDB4D3';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = showFirstAuthor ? '#BDB4D3' : '#D2CBBF';
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
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors" 
                              style={{ color: '#5D4037' }}
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
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'year' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▼
                                  </span>
      </div>
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors" 
                              style={{ color: '#5D4037' }}
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
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'citation' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▼
                                  </span>
                                </div>
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors" 
                              style={{ color: '#5D4037' }}
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
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: priorWorksSortField === 'strength' && priorWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#5D4037'
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
                              className="hover:bg-gray-50 transition-colors"
                              style={{ borderBottom: '1px solid #D2CBBF' }}
                            >
                              <td className="p-3 text-sm" style={{ color: '#5D4037' }}>
                                {work.title || 'Unknown Title'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#707C5D' }}>
                                {work.authors && work.authors.length > 0 
                                  ? (showFirstAuthor ? work.authors[0] : work.authors[work.authors.length - 1])
                                  : 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#707C5D' }}>
                                {work.year || 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#707C5D' }}>
                                {work.citationCount !== undefined ? work.citationCount.toLocaleString() : 'N/A'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#707C5D' }}>
                                {work.strength !== undefined ? work.strength.toFixed(3) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
        </div>
                  ) : (
                    <div className="text-center py-12" style={{ color: '#707C5D' }}>
                      <p>No prior works found.</p>
                </div>
              )}
            </div>
          )}
          
              {viewMode === 'derivative-works' && (
                <div className="h-full overflow-y-auto p-6" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="mb-4">
                    <h2 className="text-xl font-bold mb-2" style={{ color: '#5D4037', fontFamily: '"Lora", "Merriweather", "Georgia", serif' }}>
                      Derivative Works
                    </h2>
                    <p className="text-sm mb-4" style={{ color: '#707C5D' }}>
                      These are papers that cited many of the papers in the graph.
                      This usually means that they are either <strong>surveys of the field or recent relevant works</strong> which were inspired by many papers in the graph.
                    </p>
            </div>
        
                  {allDerivativeWorks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ backgroundColor: '#FFFFFF' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #BDB4D3', backgroundColor: '#F5F5DC' }}>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors" 
                              style={{ color: '#5D4037' }}
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
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'title' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▼
                                  </span>
          </div>
        </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold select-none" 
                              style={{ color: '#5D4037' }}
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="cursor-pointer hover:bg-gray-100 transition-colors px-1 py-1 rounded flex items-center gap-2"
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
                                        color: '#5D4037'
                                      }}
                                    >
                                      ▲
                                    </span>
                                    <span 
                                      style={{ 
                                        opacity: derivativeWorksSortField === 'lastAuthor' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                        color: '#5D4037'
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
                                    backgroundColor: showDerivativeFirstAuthor ? '#BDB4D3' : '#D2CBBF',
                                    padding: '2px',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  title={showDerivativeFirstAuthor ? 'Switch to Last author' : 'Switch to First author'}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = showDerivativeFirstAuthor ? '#A39A86' : '#BDB4D3';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = showDerivativeFirstAuthor ? '#BDB4D3' : '#D2CBBF';
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
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors" 
                              style={{ color: '#5D4037' }}
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
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'year' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▼
                                  </span>
                                </div>
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors" 
                              style={{ color: '#5D4037' }}
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
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'citation' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▼
                                  </span>
                                </div>
                              </div>
                            </th>
                            <th 
                              className="text-left p-3 text-sm font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors" 
                              style={{ color: '#5D4037' }}
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
                                      color: '#5D4037'
                                    }}
                                  >
                                    ▲
                                  </span>
                                  <span 
                                    style={{ 
                                      opacity: derivativeWorksSortField === 'strength' && derivativeWorksSortDirection === 'desc' ? 1 : 0.3,
                                      color: '#5D4037'
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
                              className="hover:bg-gray-50 transition-colors"
                              style={{ borderBottom: '1px solid #D2CBBF' }}
                            >
                              <td className="p-3 text-sm" style={{ color: '#5D4037' }}>
                                {work.title || 'Unknown Title'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#707C5D' }}>
                                {work.authors && work.authors.length > 0 
                                  ? (showDerivativeFirstAuthor ? work.authors[0] : work.authors[work.authors.length - 1])
                                  : 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#707C5D' }}>
                                {work.year || 'Unknown'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#707C5D' }}>
                                {work.citationCount !== undefined ? work.citationCount.toLocaleString() : 'N/A'}
                              </td>
                              <td className="p-3 text-sm" style={{ color: '#707C5D' }}>
                                {work.strength !== undefined ? work.strength.toFixed(2) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12" style={{ color: '#707C5D' }}>
                      <p>No derivative works found. This might take some time to search.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#F5F5DC' }}>
              <div className="text-center" style={{ color: '#707C5D' }}>
                <div className="w-20 h-20 mx-auto mb-4 border-4 border-dashed rounded-full flex items-center justify-center" style={{ borderColor: '#BDB4D3' }}>
                  <BarChartIcon className="w-10 h-10" style={{ color: '#BDB4D3' }} />
                </div>
                <p className="text-lg font-medium" style={{ 
                  color: '#5D4037',
                  fontFamily: '"Lora", "Merriweather", "Georgia", serif'
                }}>Interactive Graph Area</p>
                <p className="text-sm mt-2" style={{ color: '#707C5D' }}>Configure analysis parameters and click "Start Analysis" to visualize paper relationships</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Bottom Three-Column Information Section - Fixed at bottom with proper flex structure */}
      <div 
        className={`flex-shrink-0 relative transition-all duration-300 ease-in-out overflow-visible
                   bg-gradient-to-b from-academic-lightBeige via-academic-lightBeige/95 to-academic-beige/90 
                   border-t-2 border-academic-beige shadow-2xl
                   ${showBottomSection ? 'h-[40vh] min-h-[40vh] max-h-[40vh]' : 'h-10 min-h-[40px] max-h-[40px]'}`}
      >
        {/* Collapse/Expand Button - Professional academic styling with backdrop, fixed high z-index */}
        {/* Position dynamically adjusts based on left sidebar collapse state */}
        <button
          onClick={() => setShowBottomSection(!showBottomSection)}
          className={`absolute top-0 -translate-y-1/2 z-[9999] cursor-pointer 
                     transition-all duration-300 ease-in-out
                     bg-gradient-to-br from-academic-purple via-purple-200 to-academic-purple
                     hover:from-academic-beige hover:via-academic-purple/80 hover:to-academic-beige
                     border-2 border-academic-beige/80 rounded-xl shadow-2xl backdrop-blur-sm
                     px-6 py-3
                     flex items-center justify-center gap-2
                     font-serif font-semibold text-academic-darkBrown text-sm
                     hover:shadow-2xl hover:scale-105 active:scale-95
                     hover:border-academic-purple/100 pointer-events-auto
                     ${isConfigCollapsed ? 'left-[calc(25px+50%)] -translate-x-1/2' : 'left-1/2 -translate-x-1/2'}`}
          style={{
            left: isConfigCollapsed ? 'calc(50px + (100% - 50px) / 2)' : '50%',
            transform: 'translate(-50%, -50%)'
          }}
          title={showBottomSection ? 'Collapse guides to view more content' : 'Expand guides for help'}
        >
          {showBottomSection ? (
            <ExpandMoreIcon className="w-5 h-5" />
          ) : (
            <ExpandLessIcon className="w-5 h-5" />
          )}
          <span className="hidden sm:inline whitespace-nowrap">
            {showBottomSection ? 'Collapse Guides' : 'Expand Guides'}
          </span>
        </button>
        
        {/* Content Area - Professional three-column academic panel layout */}
        {showBottomSection && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-10 pb-3 px-2 h-full min-h-0 overflow-hidden relative z-0">
        {/* Analysis Guide - Left */}
            <div className="overflow-y-auto overflow-x-hidden p-5 shadow-inner bg-academic-cream h-full 
                          scrollbar-academic transition-all duration-200 rounded-lg border border-academic-lightBeige/50">
              <h2 
                className="text-lg font-semibold mb-4 pb-2" 
                style={{
            color: '#5D4037',
            borderBottom: '2px solid #BDB4D3',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
                }}
              >
            Analysis Guide
          </h2>
          
          {/* Usage Instructions */}
          <div className="mb-6 p-4 rounded-lg border" style={{
            backgroundColor: '#D2CBBF',
            borderColor: '#A39A86'
          }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ 
              color: '#5D4037',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif'
            }}>
              <BookIcon className="w-4 h-4" />
              How to Use
            </h3>
            <ol className="text-xs space-y-2 list-decimal list-inside" style={{ color: '#707C5D' }}>
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
        </div>

        {/* Key Features - Center */}
            <div className="overflow-y-auto overflow-x-hidden p-5 shadow-inner bg-academic-cream h-full 
                          scrollbar-academic transition-all duration-200 rounded-lg border border-academic-lightBeige/50">
              <h2 
                className="text-lg font-semibold mb-4 pb-2" 
                style={{
            color: '#5D4037',
            borderBottom: '2px solid #BDB4D3',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
                }}
              >
            Key Features
          </h2>
              
          <div className="mb-6 p-4 rounded-lg border" style={{
            backgroundColor: '#D2CBBF',
            borderColor: '#A39A86'
          }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ 
              color: '#5D4037',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif'
            }}>
              <AutoAwesomeIcon className="w-4 h-4" />
              Overview
            </h3>
            <ul className="text-xs space-y-2" style={{ color: '#707C5D' }}>
              <li className="flex items-start">
                <PsychologyIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#BDB4D3' }} />
                <div>
                  <strong>AI-Powered Analysis:</strong> Intelligent extraction of academic relationships
                </div>
              </li>
              <li className="flex items-start">
                <HubIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#BDB4D3' }} />
                <div>
                  <strong>Network Visualization:</strong> Interactive graph showing citation networks
                </div>
              </li>
              <li className="flex items-start">
                <CenterFocusStrongIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#BDB4D3' }} />
                <div>
                  <strong>Smart Filtering:</strong> Focus on key sections for better insights
                </div>
              </li>
              <li className="flex items-start">
                <LayersIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#BDB4D3' }} />
                <div>
                  <strong>Multi-Layer Expansion:</strong> Explore citation relationships at multiple depths
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Tips & Best Practices - Right */}
            <div className="overflow-y-auto overflow-x-hidden p-5 shadow-inner bg-academic-cream h-full 
                          scrollbar-academic transition-all duration-200 rounded-lg border border-academic-lightBeige/50">
              <h2 
                className="text-lg font-semibold mb-4 pb-2" 
                style={{
            color: '#5D4037',
            borderBottom: '2px solid #BDB4D3',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
                }}
              >
            Tips & Best Practices
          </h2>
              
          <div className="mb-6 p-4 rounded-lg border" style={{
            backgroundColor: '#D2CBBF',
            borderColor: '#A39A86'
          }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ 
              color: '#5D4037',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif'
            }}>
              <LightbulbIcon className="w-4 h-4" />
              Tips
            </h3>
            <ul className="text-xs space-y-2" style={{ color: '#707C5D' }}>
              <li>• Use arxiv.org URLs for best results</li>
              <li>• Enable smart filtering to reduce noise</li>
              <li>• Start with depth 1 for faster analysis</li>
              <li>• Use citation extractor for manual verification</li>
              <li>• Export to Obsidian for long-term knowledge management</li>
            </ul>
          </div>
        </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperGraphPage;
