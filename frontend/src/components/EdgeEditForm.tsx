import React, { useState } from 'react';
import { Edge } from '../types/graph';

interface EdgeEditFormProps {
  edge: Edge;
  onSave: (edge: Edge) => void;
  onCancel: () => void;
}

const EdgeEditForm: React.FC<EdgeEditFormProps> = ({ 
  edge, 
  onSave, 
  onCancel 
}) => {
  const [editData, setEditData] = useState<Edge>({ ...edge });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editData);
  };

  const relationshipOptions = [
    { value: 'cites', label: '引用 (cites)' },
    { value: 'builds on', label: '建構於 (builds on)' },
    { value: 'extends', label: '擴展 (extends)' },
    { value: 'compares', label: '比較 (compares)' },
    { value: 'contradicts', label: '反駁 (contradicts)' },
    { value: 'related', label: '相關 (related)' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Edit Connection</h4>
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition-colors"
          >
            💾 Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-md transition-colors"
          >
            ✕ Cancel
          </button>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Relationship Type:
          </label>
          <select
            value={editData.relationship}
            onChange={(e) => setEditData({ ...editData, relationship: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {relationshipOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Strength (0-1):
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={editData.strength}
            onChange={(e) => setEditData({ 
              ...editData, 
              strength: parseFloat(e.target.value) || 0 
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description:
          </label>
          <textarea
            value={editData.description}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Evidence:
          </label>
          <textarea
            value={editData.evidence}
            onChange={(e) => setEditData({ ...editData, evidence: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </form>
    </div>
  );
};

export default EdgeEditForm;
