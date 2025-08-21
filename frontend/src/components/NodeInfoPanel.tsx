import React from 'react';
import { Node } from '../types/graph';
import '../styles/theme.css';

interface NodeInfoPanelProps {
  node: Node;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const NodeInfoPanel: React.FC<NodeInfoPanelProps> = ({ 
  node, 
  onEdit, 
  onDelete, 
  onClose 
}) => {
  
  // 添加調試日誌
  console.log('🔍 [NODE INFO PANEL DEBUG] Displaying node:', {
    id: node.id,
    title: node.title?.substring(0, 50) + '...',
    citationCount: node.citationCount,
    paperCitationCount: node.paperCitationCount
  });

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
