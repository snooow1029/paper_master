import React, { useState } from 'react';
import { Node } from '../types/graph';
import '../styles/theme.css';

// Use relative path if VITE_API_BASE_URL is not set (development proxy)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : 'http://localhost:8080');

interface NodeInfoPanelProps {
  node: Node;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface PriorWork {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  citationContext?: string;
}

interface DerivativeWork {
  id: string;
  title: string;
  authors: string[];
  year?: string;
  citationCount?: number;
}

const NodeInfoPanel: React.FC<NodeInfoPanelProps> = ({ 
  node, 
  onEdit, 
  onDelete, 
  onClose 
}) => {
  const [priorWorks, setPriorWorks] = useState<PriorWork[] | null>(null);
  const [derivativeWorks, setDerivativeWorks] = useState<DerivativeWork[] | null>(null);
  const [loadingPrior, setLoadingPrior] = useState(false);
  const [loadingDerivative, setLoadingDerivative] = useState(false);
  const [showPriorWorks, setShowPriorWorks] = useState(false);
  const [showDerivativeWorks, setShowDerivativeWorks] = useState(false);
  const [priorWorksError, setPriorWorksError] = useState<string | null>(null);
  const [derivativeWorksError, setDerivativeWorksError] = useState<string | null>(null);
  
  // 添加調試日誌
  console.log('🔍 [NODE INFO PANEL DEBUG] Displaying node:', {
    id: node.id,
    title: node.title?.substring(0, 50) + '...',
    citationCount: node.citationCount,
    paperCitationCount: node.paperCitationCount
  });

  const loadPriorWorks = async () => {
    if (priorWorks !== null) {
      setShowPriorWorks(!showPriorWorks);
      return;
    }

    setLoadingPrior(true);
    setPriorWorksError(null);
    try {
      // 优先使用 URL，因为这是我们最可靠的数据源
      let response;
      let apiUrl = '';
      
      if (node.url && node.url.trim()) {
        // 使用 URL 查询（最可靠）
        apiUrl = `${API_BASE_URL}/api/citations/prior-works?url=${encodeURIComponent(node.url)}`;
        response = await fetch(apiUrl);
      } else if (node.id) {
        // 尝试使用 ID
        apiUrl = `${API_BASE_URL}/api/citations/${node.id}/prior-works`;
        response = await fetch(apiUrl);
      } else {
        throw new Error('No paper URL or ID available. Cannot load prior works.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load prior works (${response.status})`);
      }

      const data = await response.json();
      if (data.success) {
        setPriorWorks(data.priorWorks || []);
        setShowPriorWorks(true);
        if (data.priorWorks && data.priorWorks.length === 0) {
          setPriorWorksError('No prior works found for this paper.');
        }
      } else {
        throw new Error(data.error || 'Failed to load prior works');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error loading prior works:', error);
      setPriorWorksError(errorMessage);
      // 仍然显示空列表
      setPriorWorks([]);
      setShowPriorWorks(true);
    } finally {
      setLoadingPrior(false);
    }
  };

  const loadDerivativeWorks = async () => {
    if (derivativeWorks !== null) {
      setShowDerivativeWorks(!showDerivativeWorks);
      return;
    }

    setLoadingDerivative(true);
    setDerivativeWorksError(null);
    try {
      // 优先使用 URL，因为这是我们最可靠的数据源
      let response;
      let apiUrl = '';
      
      if (node.url && node.url.trim()) {
        // 使用 URL 查询（最可靠）
        apiUrl = `${API_BASE_URL}/api/citations/derivative-works?url=${encodeURIComponent(node.url)}`;
        response = await fetch(apiUrl);
      } else if (node.id) {
        // 尝试使用 ID
        apiUrl = `${API_BASE_URL}/api/citations/${node.id}/derivative-works`;
        response = await fetch(apiUrl);
      } else {
        throw new Error('No paper URL or ID available. Cannot load derivative works.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load derivative works (${response.status})`);
      }

      const data = await response.json();
      if (data.success) {
        setDerivativeWorks(data.derivativeWorks || []);
        setShowDerivativeWorks(true);
        if (data.derivativeWorks && data.derivativeWorks.length === 0) {
          setDerivativeWorksError('No derivative works found for this paper.');
        }
      } else {
        throw new Error(data.error || 'Failed to load derivative works');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error loading derivative works:', error);
      setDerivativeWorksError(errorMessage);
      // 仍然显示空列表
      setDerivativeWorks([]);
      setShowDerivativeWorks(true);
    } finally {
      setLoadingDerivative(false);
    }
  };

  return (
    <div className="card rounded-lg shadow-md p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {node.title}
        </h3>
        <button
          onClick={onClose}
          className="p-1 transition-colors"
          style={{
            color: 'var(--text-secondary)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-3 mb-4">
        <div>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Authors:</span>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{node.authors.join(', ')}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Year:</span>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{node.year}</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Venue:</span>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{node.venue}</p>
          </div>
        </div>
        
        <div>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Citations:</span>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {node.paperCitationCount !== undefined ? node.paperCitationCount.toLocaleString() : 'Unknown'}
          </p>
        </div>
        
        <div>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Tags:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {node.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs rounded-full"
                style={{
                  backgroundColor: 'var(--green-100)',
                  color: 'var(--green-800)'
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      {/* Prior Works and Derivative Works */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={loadPriorWorks}
          disabled={loadingPrior}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors"
          style={{ 
            backgroundColor: loadingPrior ? 'var(--bg-secondary)' : 'var(--blue-500)',
            color: 'white',
            opacity: loadingPrior ? 0.6 : 1
          }}
          onMouseEnter={(e) => !loadingPrior && (e.currentTarget.style.backgroundColor = 'var(--blue-600)')}
          onMouseLeave={(e) => !loadingPrior && (e.currentTarget.style.backgroundColor = 'var(--blue-500)')}
        >
          {loadingPrior ? '⏳' : '📚'} Prior Works
        </button>
        <button
          onClick={loadDerivativeWorks}
          disabled={loadingDerivative}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors"
          style={{ 
            backgroundColor: loadingDerivative ? 'var(--bg-secondary)' : 'var(--purple-500)',
            color: 'white',
            opacity: loadingDerivative ? 0.6 : 1
          }}
          onMouseEnter={(e) => !loadingDerivative && (e.currentTarget.style.backgroundColor = 'var(--purple-600)')}
          onMouseLeave={(e) => !loadingDerivative && (e.currentTarget.style.backgroundColor = 'var(--purple-500)')}
        >
          {loadingDerivative ? '⏳' : '🔗'} Derivative Works
        </button>
      </div>

      {/* Prior Works List */}
      {showPriorWorks && priorWorks !== null && (
        <div className="mb-4 p-3 rounded-md" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            📚 Prior Works ({priorWorks.length})
          </h4>
          {priorWorksError && (
            <div className="mb-2 p-2 rounded text-xs" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              ⚠️ {priorWorksError}
            </div>
          )}
          {priorWorks.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {priorWorks.map((work) => (
                <div key={work.id} className="p-2 rounded text-sm" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {work.title}
                  </div>
                  {work.authors && work.authors.length > 0 && (
                    <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {work.authors.join(', ')}
                      {work.year && ` (${work.year})`}
                    </div>
                  )}
                  {work.citationContext && (
                    <div className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>
                      "{work.citationContext.substring(0, 100)}..."
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !priorWorksError ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No prior works found</p>
          ) : null}
        </div>
      )}

      {/* Derivative Works List */}
      {showDerivativeWorks && derivativeWorks !== null && (
        <div className="mb-4 p-3 rounded-md" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            🔗 Derivative Works ({derivativeWorks.length})
          </h4>
          {derivativeWorksError && (
            <div className="mb-2 p-2 rounded text-xs" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              ⚠️ {derivativeWorksError}
            </div>
          )}
          {derivativeWorks.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {derivativeWorks.map((work) => (
                <div key={work.id} className="p-2 rounded text-sm" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {work.title}
                  </div>
                  {work.authors && work.authors.length > 0 && (
                    <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {work.authors.join(', ')}
                      {work.year && ` (${work.year})`}
                    </div>
                  )}
                  {work.citationCount !== undefined && (
                    <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {work.citationCount.toLocaleString()} citations
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !derivativeWorksError ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No derivative works found</p>
          ) : null}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="btn-primary flex items-center gap-2 px-3 py-2 text-white text-sm rounded-md transition-colors"
          style={{ backgroundColor: 'var(--green-600)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--green-700)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--green-600)'}
        >
          ✏️ Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-2 px-3 py-2 text-white text-sm rounded-md transition-colors"
          style={{ backgroundColor: 'var(--error)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--error)'}
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
};

export default NodeInfoPanel;
