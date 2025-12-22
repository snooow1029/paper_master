import { useState } from 'react';
import { FileCopy as CopyIcon, OpenInNew as OpenInNewIcon, Search as SearchIcon } from '@mui/icons-material';
import '../styles/theme.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface ArxivSearchResult {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  updated?: string;
  arxivUrl: string;
  pdfUrl?: string;
  primaryCategory?: string;
  categories?: string[];
}

interface ArxivSearchResponse {
  success: boolean;
  results: ArxivSearchResult[];
  totalResults?: number;
  error?: string;
}

export default function ArxivSearch() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ArxivSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /**
   * Normalize query to handle word combinations
   * e.g., "incontext" -> "in context", "algorithmdistillation" -> "algorithm distillation"
   */
  const normalizeQueryForMatching = (query: string): string => {
    const wordExpansions: { [key: string]: string } = {
      'incontext': 'in context',
      'reinforcementlearning': 'reinforcement learning',
      'algorithmdistillation': 'algorithm distillation',
      'deeplearning': 'deep learning',
      'machinelearning': 'machine learning',
      'neuralnetwork': 'neural network',
      'neuralnetworks': 'neural networks',
      'artificialintelligence': 'artificial intelligence',
      'naturalanguage': 'natural language',
      'computervision': 'computer vision',
      'transferlearning': 'transfer learning',
      'fewshot': 'few shot',
      'zeroshot': 'zero shot',
      'oneshot': 'one shot',
      'multitask': 'multi task',
      'selfsupervised': 'self supervised',
      'semisupervised': 'semi supervised',
      'unsupervisedlearning': 'unsupervised learning',
      'supervisedlearning': 'supervised learning',
    };

    let normalized = query.toLowerCase().trim();
    
    // Try to expand common word combinations (case insensitive)
    for (const [combined, expanded] of Object.entries(wordExpansions)) {
      const regex = new RegExp(`\\b${combined}\\b`, 'gi');
      normalized = normalized.replace(regex, expanded);
    }
    
    // Split camelCase (lowercase followed by uppercase)
    normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    return normalized.trim();
  };

  /**
   * Calculate relevance score for a paper based on the search query
   * Higher score = more relevant
   */
  const calculateRelevanceScore = (paper: ArxivSearchResult, searchQuery: string): number => {
    // Normalize the search query first to handle word combinations
    const normalizedSearchQuery = normalizeQueryForMatching(searchQuery);
    const queryLower = normalizedSearchQuery.toLowerCase().trim();
    const titleLower = paper.title.toLowerCase();
    const summaryLower = paper.summary.toLowerCase();
    
    let score = 0;
    
    // Normalize strings: remove punctuation, hyphens, and extra spaces
    // This handles cases like "in context" vs "in-context" vs "incontext"
    const normalize = (str: string) => {
      let normalized = str
        .toLowerCase()
        .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
        .replace(/[^\w\s]/g, ' ') // Remove other punctuation
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      // Also try to expand common word combinations in the title
      const wordExpansions: { [key: string]: string } = {
        'incontext': 'in context',
        'reinforcementlearning': 'reinforcement learning',
        'algorithmdistillation': 'algorithm distillation',
        'deeplearning': 'deep learning',
        'machinelearning': 'machine learning',
      };
      
      for (const [combined, expanded] of Object.entries(wordExpansions)) {
        const regex = new RegExp(`\\b${combined}\\b`, 'gi');
        normalized = normalized.replace(regex, expanded);
      }
      
      return normalized;
    };
    
    const normalizedQuery = normalize(queryLower);
    const normalizedTitle = normalize(titleLower);
    
    // 1. Exact match (after normalization) - highest priority
    // e.g., "in context reinforcement learning with algorithm distillation" 
    // matches "In-context Reinforcement Learning with Algorithm Distillation"
    if (normalizedTitle === normalizedQuery) {
      score += 10000;
      return score; // Early return for perfect match
    }
    
    // 2. Title contains the entire query as substring (after normalization)
    if (normalizedTitle.includes(normalizedQuery)) {
      score += 5000;
    }
    
    // 3. Query contains the entire title (or vice versa)
    if (normalizedQuery.includes(normalizedTitle) || normalizedTitle.includes(normalizedQuery)) {
      score += 4000;
    }
    
    // 4. Extract keywords from query (words with length >= 2, excluding common words)
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const queryWords = normalizedQuery
      .split(/\s+/)
      .filter(w => w.length >= 2 && !commonWords.has(w));
    const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length >= 2);
    
    if (queryWords.length === 0) {
      // If no meaningful keywords, use simple substring match
      return normalizedTitle.includes(normalizedQuery) ? 100 : 0;
    }
    
    // Count matching keywords
    let matchedKeywords = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    const matchedWordIndices: number[] = [];
    
    for (let i = 0; i < queryWords.length; i++) {
      const queryWord = queryWords[i];
      const titleIndex = titleWords.indexOf(queryWord);
      if (titleIndex !== -1) {
        matchedKeywords++;
        matchedWordIndices.push(titleIndex);
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        consecutiveMatches = 0;
      }
    }
    
    // 5. Keyword match score (more keywords = higher score)
    const keywordMatchRatio = matchedKeywords / queryWords.length;
    score += keywordMatchRatio * 3000;
    
    // 6. All keywords match - very high score
    if (matchedKeywords === queryWords.length) {
      score += 2000;
    }
    
    // 7. Consecutive keyword matches (phrase matching) - important for relevance
    if (maxConsecutive >= 2) {
      score += maxConsecutive * 500;
    }
    
    // 8. Check if keywords appear in the same order (phrase order preservation)
    if (matchedWordIndices.length > 1) {
      let isOrdered = true;
      for (let i = 1; i < matchedWordIndices.length; i++) {
        if (matchedWordIndices[i] <= matchedWordIndices[i - 1]) {
          isOrdered = false;
          break;
        }
      }
      if (isOrdered && matchedWordIndices.length === queryWords.length) {
        score += 1500; // Perfect order match with all keywords
      } else if (isOrdered) {
        score += 500; // Partial order match
      }
    }
    
    // 9. Title starts with query (bonus for exact prefix match)
    const queryPrefix = normalizedQuery.substring(0, Math.min(30, normalizedQuery.length));
    if (normalizedTitle.startsWith(queryPrefix)) {
      score += 800;
    }
    
    // 10. Summary contains query keywords (lower weight, but still relevant)
    score += calculateSummaryMatchScore(summaryLower, queryWords);
    
    // 11. Penalize very long titles (shorter titles might be more precise)
    // But only if we don't have a very high score already
    score = applyTitleLengthPenalty(score, titleWords.length, queryWords.length);
    
    return score;
  };

  /**
   * Calculate additional relevance score based on summary keyword matches.
   * Lower weight than title matches, but still contributes to overall relevance.
   */
  const calculateSummaryMatchScore = (summaryLower: string, queryWords: string[]): number => {
    const summaryWords = summaryLower.split(/\s+/).filter(w => w.length >= 2);
    const summaryMatches = queryWords.filter(w => summaryWords.includes(w)).length;

    if (summaryMatches > 0) {
      return (summaryMatches / queryWords.length) * 200;
    }

    return 0;
  };

  /**
   * Apply a penalty to the relevance score for very long titles.
   * Shorter titles might be more precise, but avoid penalizing highly relevant results.
   */
  const applyTitleLengthPenalty = (
    currentScore: number,
    titleWordCount: number,
    queryWordCount: number
  ): number => {
    if (currentScore < 3000) {
      const titleLengthPenalty = Math.max(0, (titleWordCount - queryWordCount * 3) * 5);
      return currentScore - titleLengthPenalty;
    }

    return currentScore;
  };

  /**
   * Sort results by relevance score
   */
  const sortResultsByRelevance = (results: ArxivSearchResult[], searchQuery: string): ArxivSearchResult[] => {
    return [...results].sort((a, b) => {
      const scoreA = calculateRelevanceScore(a, searchQuery);
      const scoreB = calculateRelevanceScore(b, searchQuery);
      return scoreB - scoreA; // Descending order (higher score first)
    });
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // Normalize query before sending to backend (handle word combinations like "incontext" -> "in context")
      const normalizedQuery = normalizeQueryForMatching(query.trim());
      
      const response = await fetch(`${API_BASE_URL}/api/arxiv/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: normalizedQuery,
          maxResults: 50
        }),
      });

      const data: ArxivSearchResponse = await response.json();

      if (!data.success) {
        setError(data.error || 'Search failed');
        return;
      }

      // Sort results by relevance before displaying
      // Use normalized query for sorting to ensure proper matching
      const sortedResults = sortResultsByRelevance(data.results || [], normalizedQuery);
      
      setResults(sortedResults);
      if (sortedResults.length === 0) {
        setError('No results found. Try adjusting your search query.');
      }
    } catch (err) {
      console.error('Arxiv search failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    }).catch((err) => {
      console.error('Failed to copy:', err);
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="card rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--bg-card)' }}>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <SearchIcon style={{ fontSize: '24px', color: 'var(--green-600)' }} />
          arXiv Paper Search
        </h2>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          Search for papers on arXiv by title, author, or keywords. Click on a result to open it on arXiv, or copy the URL.
        </p>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter paper title, author, or keywords (e.g., 'transformer attention mechanism')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="form-input flex-1 px-4 py-2 rounded-md focus:outline-none"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-soft)',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="btn-primary px-6 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              style={{
                backgroundColor: loading || !query.trim() 
                  ? 'var(--text-muted)' 
                  : 'var(--green-600)',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => {
                if (!loading && query.trim()) {
                  e.currentTarget.style.backgroundColor = 'var(--green-700)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && query.trim()) {
                  e.currentTarget.style.backgroundColor = 'var(--green-600)';
                }
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {error && (
            <div className="rounded-md p-4 border" style={{ 
              backgroundColor: 'var(--bg-danger)', 
              borderColor: 'var(--border-danger)' 
            }}>
              <p style={{ color: 'var(--text-danger)' }}>{error}</p>
            </div>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="card rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--bg-card)' }}>
          <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Search Results ({results.length})
          </h3>

          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {results.map((result) => (
              <div
                key={result.id}
                className="p-4 rounded-lg border"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-soft)'
                }}
              >
                <div className="space-y-3">
                  {/* Title */}
                  <h4 className="font-semibold text-lg" style={{ color: 'var(--green-700)' }}>
                    {result.title}
                  </h4>

                  {/* Authors */}
                  {result.authors.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Authors:</span>
                      <span>{result.authors.slice(0, 5).join(', ')}
                        {result.authors.length > 5 && ` and ${result.authors.length - 5} more`}
                      </span>
                    </div>
                  )}

                  {/* Published date and category */}
                  <div className="flex flex-wrap gap-4 text-sm items-center" style={{ color: 'var(--text-secondary)' }}>
                    {result.published && (
                      <div className="flex items-center gap-1.5">
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Published:</span>
                        <span>{result.published}</span>
                      </div>
                    )}
                    {result.primaryCategory && (
                      <span className="px-2 py-1 rounded text-xs" style={{
                        backgroundColor: 'var(--green-100)',
                        color: 'var(--green-700)',
                        fontWeight: 500
                      }}>
                        {result.primaryCategory}
                      </span>
                    )}
                  </div>

                  {/* Summary */}
                  {result.summary && (
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <p className="line-clamp-3">{result.summary}</p>
                    </div>
                  )}

                  {/* URLs */}
                  <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                    <a
                      href={result.arxivUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: 'var(--green-600)',
                        color: '#fff'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--green-700)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--green-600)';
                      }}
                    >
                      <OpenInNewIcon style={{ fontSize: '16px' }} />
                      Open on arXiv
                    </a>
                    <button
                      onClick={() => handleCopyUrl(result.arxivUrl, result.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-primary)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <CopyIcon style={{ fontSize: '16px' }} />
                      {copiedId === result.id ? 'Copied!' : 'Copy URL'}
                    </button>
                    {result.pdfUrl && (
                      <a
                        href={result.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        📄 PDF
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
