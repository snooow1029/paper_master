import React, { useState } from 'react';
import GraphVisualization from '../components/GraphVisualization';
import { GraphData } from '../types/graph';

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

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
      const response = await fetch('/api/analyze-papers', {
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

      const data = await response.json();
      setGraphData(data);
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
      const response = await fetch('/api/extract-citations', {
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

  // Obsidian sync
  const syncToObsidian = async () => {
    if (!obsidianPath.trim() || !graphData) return;

    setIsSyncing(true);
    setSyncStatus('Syncing to Obsidian...');

    try {
      const response = await fetch('/api/sync-obsidian', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          graphData,
          obsidianPath,
          subfolder: obsidianSubfolder
        })
      });

      if (!response.ok) {
        throw new Error('Obsidian sync failed');
      }

      setSyncStatus('Successfully synced to Obsidian!');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      setSyncStatus(`Error: ${err instanceof Error ? err.message : 'Sync failed'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      {/* Desktop three-column layout */}
      <div className="h-full grid grid-cols-[320px_1fr_320px] gap-1">
        
        {/* Left Column - Analysis Configuration */}
        <div className="bg-white overflow-y-auto p-5 border-r border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-blue-600 mb-4 pb-2 border-b-2 border-blue-500">
            Analysis Configuration
          </h2>
          
          {/* URL Input Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Paper URLs</h3>
              <button
                onClick={fillExampleUrls}
                className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {urls.length > 2 && (
                  <button
                    onClick={() => removeUrl(index)}
                    className="px-2 py-2 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                    title="Remove"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
            
            <button
              onClick={addUrl}
              className="w-full py-2 border border-dashed border-gray-300 rounded text-gray-500 text-sm hover:border-blue-400 hover:text-blue-500"
            >
              ➕ Add Paper
            </button>
          </div>

          {/* Filter Toggle */}
          <div className="mb-4 p-3 bg-amber-50 rounded border border-amber-200">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="filterSections"
                checked={filterSections}
                onChange={(e) => setFilterSections(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="filterSections" className="text-xs font-medium text-amber-800">
                🎯 Smart Section Filter
              </label>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              {filterSections 
                ? 'Analyze key sections only (recommended)'
                : 'Analyze all sections'
              }
            </p>
          </div>

          {/* Network Expansion Depth */}
          <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
            <span className="text-xs font-medium text-blue-800 block mb-2">🕸️ Network Depth</span>
            <div className="space-y-2">
              {[0, 1, 2].map((depth) => (
                <label key={depth} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="expansionDepth"
                    value={depth}
                    checked={expansionDepth === depth}
                    onChange={(e) => setExpansionDepth(parseInt(e.target.value))}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="text-xs text-blue-700">
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
              className="flex items-center justify-between w-full p-3 bg-yellow-50 border border-yellow-200 rounded text-sm hover:bg-yellow-100"
            >
              <span className="font-medium text-yellow-800">📑 Citation Extractor</span>
              <span className="text-yellow-600">{showCitationExtractor ? '▼' : '▶'}</span>
            </button>

            {showCitationExtractor && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={citationUrl}
                    onChange={(e) => setCitationUrl(e.target.value)}
                    placeholder="Paper URL for citation extraction"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={extractCitations}
                    disabled={isExtracting || !citationUrl}
                    className="px-3 py-2 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 disabled:bg-gray-400"
                  >
                    {isExtracting ? 'Loading...' : 'Extract'}
                  </button>
                </div>
                
                {citationResults && (
                  <div className="max-h-40 overflow-y-auto bg-gray-50 p-3 rounded text-xs">
                    <h4 className="font-semibold mb-2">Extracted Citations:</h4>
                    <ul className="space-y-1">
                      {citationResults.split('\n').slice(0, 20).map((citation, index) => (
                        <li key={index} className="text-gray-700">{citation}</li>
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
              className="flex items-center justify-between w-full p-3 bg-purple-50 border border-purple-200 rounded text-sm hover:bg-purple-100"
            >
              <span className="font-medium text-purple-800">🔮 Obsidian Sync</span>
              <span className="text-purple-600">{showObsidianSync ? '▼' : '▶'}</span>
            </button>

            {showObsidianSync && (
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={obsidianPath}
                    onChange={(e) => setObsidianPath(e.target.value)}
                    placeholder="Obsidian vault path"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={obsidianSubfolder}
                    onChange={(e) => setObsidianSubfolder(e.target.value)}
                    placeholder="Subfolder (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                
                <button
                  onClick={syncToObsidian}
                  disabled={isSyncing || !obsidianPath || !graphData}
                  className="w-full px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:bg-gray-400"
                >
                  {isSyncing ? 'Syncing...' : 'Sync to Obsidian'}
                </button>
                
                {syncStatus && (
                  <p className="text-xs text-center text-gray-600">{syncStatus}</p>
                )}
              </div>
            )}
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={isLoading || urls.filter(u => u.trim()).length === 0}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:bg-gray-400 font-medium"
          >
            {isLoading ? '🔄 Analyzing...' : '🚀 Start Analysis'}
          </button>
        </div>

        {/* Center Column - Graph Visualization */}
        <div className="bg-white overflow-hidden relative flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
            <h1 className="text-xl font-bold text-white text-center">
              🔬 Paper Relationship Analysis System
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
              <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                  <div className="w-20 h-20 mx-auto mb-4 border-4 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                  <p className="text-lg font-medium">Interactive Graph Area</p>
                  <p className="text-sm mt-2">Configure analysis parameters and click "Start Analysis" to visualize paper relationships</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Guide and Information */}
        <div className="bg-white overflow-y-auto p-5 border-l border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-green-600 mb-4 pb-2 border-b-2 border-green-500">
            Analysis Guide
          </h2>
          
          {/* Usage Instructions */}
          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="text-sm font-semibold text-green-800 mb-3">📖 How to Use</h3>
            <ol className="text-xs text-green-700 space-y-2 list-decimal list-inside">
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

          {/* Features Overview */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">✨ Key Features</h3>
            <ul className="text-xs text-blue-700 space-y-2">
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

          {/* Tips and Best Practices */}
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="text-sm font-semibold text-yellow-800 mb-3">💡 Tips</h3>
            <ul className="text-xs text-yellow-700 space-y-2">
              <li>• Use arxiv.org URLs for best results</li>
              <li>• Enable smart filtering to reduce noise</li>
              <li>• Start with depth 1 for faster analysis</li>
              <li>• Use citation extractor for manual verification</li>
              <li>• Export to Obsidian for long-term knowledge management</li>
            </ul>
          </div>

          {/* Status Information */}
          {(isLoading || error) && (
            <div className="mb-4">
              {isLoading && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-700 flex items-center">
                    <span className="animate-spin mr-2">⏳</span>
                    Analysis in progress...
                  </p>
                </div>
              )}
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-700">❌ {error}</p>
                </div>
              )}
            </div>
          )}

          {/* Sample URLs Reference */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">📚 Sample Papers</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p className="font-medium">Classic ML Papers:</p>
              <p>• Attention Is All You Need</p>
              <p>• BERT: Pre-training</p>
              <p>• Variational Autoencoders</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaperGraphPage;
