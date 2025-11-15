import { useState } from 'react';
import '../styles/theme.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface Citation {
  id: string;
  title?: string;
  authors?: string[];
  year?: string;
  context: string;
  contextBefore: string;
  contextAfter: string;
  section?: string;
}

interface CitationResult {
  success: boolean;
  paperTitle?: string;
  citations: Citation[];
  error?: string;
}

export default function CitationExtractor() {
  const [arxivUrl, setArxivUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CitationResult | null>(null);

  const handleExtract = async () => {
    if (!arxivUrl.trim()) {
      alert('請輸入論文 URL');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/grobid/extract-citations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arxivUrl: arxivUrl.trim() }),
      });

      const data: CitationResult = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Citation extraction failed:', error);
      setResult({
        success: false,
        citations: [],
        error: error instanceof Error ? error.message : '未知錯誤'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExample = (url: string) => {
    setArxivUrl(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="card rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--bg-card)' }}>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          📝 論文引用提取器 (GROBID)
        </h2>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          輸入 arXiv 論文 URL，使用 GROBID 自動提取論文中的引用信息及其上下文
        </p>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://arxiv.org/abs/1706.03762"
              value={arxivUrl}
              onChange={(e) => setArxivUrl(e.target.value)}
              className="form-input flex-1 px-3 py-2 rounded-md focus:outline-none"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-soft)',
                color: 'var(--text-primary)'
              }}
            />
            <button
              onClick={handleExtract}
              disabled={loading}
              className="btn-primary px-6 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: loading ? 'var(--text-muted)' : 'var(--green-600)'
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--green-700)')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--green-600)')}
            >
              {loading ? '提取中...' : '提取引用'}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              className="btn-secondary px-3 py-1 text-sm rounded-md transition-colors"
              style={{
                backgroundColor: 'var(--green-100)',
                borderColor: 'var(--green-300)',
                color: 'var(--green-700)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--green-200)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--green-100)';
              }}
              onClick={() => handleExample('https://arxiv.org/abs/1706.03762')}
            >
              Transformer (經典)
            </button>
            <button
              className="btn-secondary px-3 py-1 text-sm rounded-md transition-colors"
              style={{
                backgroundColor: 'var(--green-100)',
                borderColor: 'var(--green-300)',
                color: 'var(--green-700)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--green-200)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--green-100)';
              }}
              onClick={() => handleExample('https://arxiv.org/abs/2301.08727')}
            >
              Neural Architecture Search
            </button>
            <button
              className="btn-secondary px-3 py-1 text-sm rounded-md transition-colors"
              style={{
                backgroundColor: 'var(--green-100)',
                borderColor: 'var(--green-300)',
                color: 'var(--green-700)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--green-200)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--green-100)';
              }}
              onClick={() => handleExample('https://arxiv.org/abs/2010.11929')}
            >
              Vision Transformer
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="card rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--bg-card)' }}>
          <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>📊 提取結果</h3>
          
          {!result.success ? (
            <div className="rounded-md p-4" style={{ backgroundColor: 'var(--bg-danger)', borderColor: 'var(--border-danger)' }}>
              <p style={{ color: 'var(--text-danger)' }}>{result.error || '提取失敗'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {result.paperTitle && (
                <div>
                  <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>論文標題</h4>
                  <p className="p-3 rounded-md" style={{ 
                    color: 'var(--text-secondary)', 
                    backgroundColor: 'var(--bg-soft)' 
                  }}>{result.paperTitle}</p>
                </div>
              )}

              <div>
                <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  引用統計 
                  <span className="ml-2 px-2 py-1 text-sm rounded-full" style={{
                    backgroundColor: 'var(--green-100)',
                    color: 'var(--green-700)'
                  }}>
                    {result.citations.length} 個引用
                  </span>
                </h4>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {result.citations.map((citation) => (
                  <div key={citation.id} className="p-4 rounded-r-md" style={{
                    borderLeft: `4px solid var(--green-600)`,
                    backgroundColor: 'var(--bg-soft)'
                  }}>
                    <div className="space-y-3">
                      {citation.title && (
                        <h5 className="font-medium" style={{ color: 'var(--green-700)' }}>
                          {citation.title}
                        </h5>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {citation.authors && citation.authors.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span>👥</span>
                            <span>{citation.authors.slice(0, 3).join(', ')}
                              {citation.authors.length > 3 && ` 等 ${citation.authors.length} 人`}
                            </span>
                          </div>
                        )}
                        
                        {citation.year && (
                          <div className="flex items-center gap-1">
                            <span>📅</span>
                            <span>{citation.year}</span>
                          </div>
                        )}

                        {citation.section && (
                          <span className="px-2 py-1 text-xs rounded" style={{
                            backgroundColor: 'var(--green-100)',
                            color: 'var(--green-700)'
                          }}>
                            {citation.section}
                          </span>
                        )}
                      </div>

                      <div className="p-3 rounded-md border" style={{
                        backgroundColor: 'var(--bg-primary)',
                        borderColor: 'var(--border-soft)'
                      }}>
                        <h6 className="font-medium text-sm mb-2" style={{ color: 'var(--text-primary)' }}>引用上下文：</h6>
                        <p className="text-sm leading-relaxed">
                          <span style={{ color: 'var(--text-secondary)' }}>{citation.contextBefore}</span>
                          <span className="px-1 rounded font-medium" style={{
                            backgroundColor: 'var(--green-200)',
                            color: 'var(--green-800)'
                          }}>
                            [引用]
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{citation.contextAfter}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
