import React, { useState } from 'react';
import GraphVisualization from '../components/GraphVisualization';
import { GraphData } from '../types/graph';
import '../styles/theme.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

  // Configuration state
  const [urls, setUrls] = useState<string[]>(['', '']);
  const [filterSections, setFilterSections] = useState(true);
  const [expansionDepth, setExpansionDepth] = useState(0);

  // Citation Extractor state
  const [showCitationExtractor, setShowCitationExtractor] = useState(false);
  const [citationUrl, setCitationUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [citationResults, setCitationResults] = useState<string | null>(null);

  // Obsidian Sync state
  const [showObsidianSync, setShowObsidianSync] = useState(false);
  const [obsidianPath, setObsidianPath] = useState('');
  const [obsidianSubfolder, setObsidianSubfolder] = useState('');

  // Panel collapse state
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);

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
      setCitationResults(data.citations ? data.citations.map((c: Citation) => 
        `${c.title} (${c.authors?.join(', ') || 'Unknown authors'}) - ${c.year || 'Unknown year'}`
      ).join('\n') : 'No citations found');
    } catch (err) {
      setCitationResults(`Error: ${err instanceof Error ? err.message : 'Extraction failed'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // TODO: Obsidian sync functionality can be added later if needed

  return (
    <div className="min-h-screen overflow-auto flex flex-col" style={{ backgroundColor: '#F5F5DC' }}>
      {/* Main Content Area - Dynamic Layout */}
      <div className={`min-h-[60vh] grid gap-1 ${isConfigCollapsed ? 'grid-cols-[50px_1fr]' : 'grid-cols-[320px_1fr]'}`}>
        
        {/* Left Column - Configuration and Status */}
        <div className="flex flex-col gap-1">
          {/* Analysis Configuration */}
          <div className="overflow-y-auto p-5 shadow-sm flex-1" style={{ 
            backgroundColor: '#A39A86', 
            borderRight: '1px solid #D2CBBF',
            borderRadius: '12px'
          }}>
          <div className="flex items-center justify-between mb-4 pb-2" style={{ 
            borderBottom: '2px solid #BDB4D3'
          }}>
            {!isConfigCollapsed && (
              <h2 className="text-lg font-semibold" style={{ 
                color: '#F5F5DC',
                fontFamily: '"Lora", "Merriweather", "Georgia", serif'
              }}>
                Analysis Configuration
              </h2>
            )}
            <button
              onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
              className="px-2 py-1 text-sm rounded hover:opacity-90 transition-colors ml-auto"
              style={{
                backgroundColor: '#D2CBBF',
                color: '#5D4037'
              }}
              title={isConfigCollapsed ? "展開配置面板" : "收起配置面板"}
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
                📝 Examples
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
                    🗑️
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
              ➕ Add Paper
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
                🎯 Smart Section Filter
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
            }}>🕸️ Network Depth</span>
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
              <span className="font-medium">📑 Citation Extractor</span>
              <span style={{ color: '#707C5D' }}>{showCitationExtractor ? '▼' : '▶'}</span>
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
                    className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
                    style={{
                      backgroundColor: isExtracting || !citationUrl ? '#A39A86' : '#BDB4D3',
                      color: '#F5F5DC',
                      borderRadius: '8px',
                      border: 'none',
                      fontFamily: '"Lora", "Merriweather", "Georgia", serif'
                    }}
                  >
                    {isExtracting ? 'Loading...' : 'Extract'}
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
                    }}>Extracted Citations:</h4>
                    <ul className="space-y-1">
                      {citationResults.split('\n').slice(0, 20).map((citation, index) => (
                        <li key={index} style={{ color: '#707C5D' }}>{citation}</li>
                      ))}
                    </ul>
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
              <span className="font-medium">🔮 Obsidian Sync</span>
              <span style={{ color: '#707C5D' }}>{showObsidianSync ? '▼' : '▶'}</span>
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
            className="w-full px-4 py-3 rounded-lg font-medium transition-all"
            style={{
              background: isLoading || urls.filter(u => u.trim()).length === 0 
                ? '#A39A86' 
                : 'linear-gradient(135deg, #BDB4D3 0%, #f2f3f0ff 100%)',
              color: '#fafafaff',
              opacity: isLoading || urls.filter(u => u.trim()).length === 0 ? 0.6 : 1,
              borderRadius: '20px',
              border: 'none',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif'
            }}
          >
            {isLoading ? ' Analyzing...' : ' Start Analysis'}
          </button>
          </>
          )}
        </div>

        {/* Status & Tools Panel - moved from right column */}
        <div className="overflow-y-auto p-5 shadow-sm" style={{
          backgroundColor: '#D2CBBF',
          borderRight: '1px solid #A39A86'
        }}>
          <h2 className="text-lg font-semibold mb-4 pb-2" style={{
            color: '#5D4037',
            borderBottom: '2px solid #BDB4D3',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
          }}>
            Status & Tools
          </h2>
          
          {/* Status Information */}
          {(isLoading || error) && (
            <div className="mb-4">
              {isLoading && (
                <div className="p-3 rounded border" style={{
                  backgroundColor: '#F5F5DC',
                  borderColor: '#BDB4D3'
                }}>
                  <p className="text-sm flex items-center" style={{ color: '#707C5D' }}>
                    <span className="animate-spin mr-2">⏳</span>
                    Analysis in progress...
                  </p>
                </div>
              )}
              
              {error && (
                <div className="p-3 rounded border" style={{
                  backgroundColor: '#FEF2F2',
                  borderColor: '#D2CBBF'
                }}>
                  <p className="text-sm" style={{ color: '#5D4037' }}>❌ {error}</p>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="p-3 rounded" style={{ backgroundColor: '#F5F5DC' }}>
              <p className="text-sm" style={{ color: '#707C5D' }}>Ready for analysis</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Graph Visualization (now takes full width) */}
      <div className="overflow-hidden relative flex flex-col" style={{ backgroundColor: '#F5F5DC' }}>
        {/* Header */}
        <div className="p-4 border-b" style={{ 
          borderColor: '#A39A86',
          background: 'linear-gradient(135deg, #c6bdddff 0%, #BDB4D3 0%)'
        }}>
          <h1 className="text-xl font-bold text-center" style={{
            color: '#F5F5DC',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
          }}>
             Paper Relationship Analysis System
          </h1>
        </div>
        
        {/* Graph Area */}
        <div className="flex-1 overflow-hidden">
          {graphData ? (
            <GraphVisualization 
              data={graphData} 
              onDataUpdate={setGraphData}
            />
          ) : (
            <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#F5F5DC' }}>
              <div className="text-center" style={{ color: '#707C5D' }}>
                <div className="w-20 h-20 mx-auto mb-4 border-4 border-dashed rounded-full flex items-center justify-center" style={{ borderColor: '#BDB4D3' }}>
                  <span className="text-2xl">📊</span>
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

      {/* Bottom Three-Column Information Section */}
      <div className="min-h-[40vh] grid grid-cols-3 gap-1 py-2" style={{ backgroundColor: '#D2CBBF' }}>
        {/* Analysis Guide - Left */}
        <div className="overflow-y-auto p-5 shadow-sm max-h-96" style={{ backgroundColor: '#F5F5DC' }}>
          <h2 className="text-lg font-semibold mb-4 pb-2" style={{
            color: '#5D4037',
            borderBottom: '2px solid #BDB4D3',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
          }}>
            Analysis Guide
          </h2>
          
          {/* Usage Instructions */}
          <div className="mb-6 p-4 rounded-lg border" style={{
            backgroundColor: '#D2CBBF',
            borderColor: '#A39A86'
          }}>
            <h3 className="text-sm font-semibold mb-3" style={{ 
              color: '#5D4037',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif'
            }}>📖 How to Use</h3>
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
        <div className="overflow-y-auto p-5 shadow-sm max-h-96" style={{ backgroundColor: '#F5F5DC' }}>
          <h2 className="text-lg font-semibold mb-4 pb-2" style={{
            color: '#5D4037',
            borderBottom: '2px solid #BDB4D3',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
          }}>
            Key Features
          </h2>
          <div className="mb-6 p-4 rounded-lg border" style={{
            backgroundColor: '#D2CBBF',
            borderColor: '#A39A86'
          }}>
            <h3 className="text-sm font-semibold mb-3" style={{ 
              color: '#5D4037',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif'
            }}>✨ Overview</h3>
            <ul className="text-xs space-y-2" style={{ color: '#707C5D' }}>
              <li className="flex items-start">
                <span className="mr-2">🤖</span>
                <div>
                  <strong>AI-Powered Analysis:</strong> Intelligent extraction of academic relationships
                </div>
              </li>
              <li className="flex items-start">
                <span className="mr-2">🕸️</span>
                <div>
                  <strong>Network Visualization:</strong> Interactive graph showing citation networks
                </div>
              </li>
              <li className="flex items-start">
                <span className="mr-2">🎯</span>
                <div>
                  <strong>Smart Filtering:</strong> Focus on key sections for better insights
                </div>
              </li>
              <li className="flex items-start">
                <span className="mr-2">🔗</span>
                <div>
                  <strong>Multi-Layer Expansion:</strong> Explore citation relationships at multiple depths
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Tips & Best Practices - Right */}
        <div className="overflow-y-auto p-5 shadow-sm max-h-96" style={{ backgroundColor: '#F5F5DC' }}>
          <h2 className="text-lg font-semibold mb-4 pb-2" style={{
            color: '#5D4037',
            borderBottom: '2px solid #BDB4D3',
            fontFamily: '"Lora", "Merriweather", "Georgia", serif'
          }}>
            Tips & Best Practices
          </h2>
          <div className="mb-6 p-4 rounded-lg border" style={{
            backgroundColor: '#D2CBBF',
            borderColor: '#A39A86'
          }}>
            <h3 className="text-sm font-semibold mb-3" style={{ 
              color: '#5D4037',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif'
            }}>💡 Tips</h3>
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
    </div>
  );
};
export default PaperGraphPage;
