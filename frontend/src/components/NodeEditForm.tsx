import React, { useState } from 'react';
import { Node } from '../types/graph';

interface NodeEditFormProps {
  node: Node;
  onSave: (node: Node) => void;
  onCancel: () => void;
}

const NodeEditForm: React.FC<NodeEditFormProps> = ({ 
  node, 
  onSave, 
  onCancel 
}) => {
  const [editData, setEditData] = useState<Node>({ ...node });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editData);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Edit Paper Info</h3>
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
            Title:
          </label>
          <input
            type="text"
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Authors:
          </label>
          <input
            type="text"
            value={editData.authors.join(', ')}
            onChange={(e) => setEditData({ 
              ...editData, 
              authors: e.target.value.split(', ').filter(a => a.trim()) 
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Separate authors with commas"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year:
            </label>
            <input
              type="text"
              value={editData.year || ''}
              onChange={(e) => setEditData({ ...editData, year: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue:
            </label>
            <input
              type="text"
              value={editData.venue || ''}
              onChange={(e) => setEditData({ ...editData, venue: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Citation Count:
          </label>
          <input
            type="number"
            value={editData.citationCount || 0}
            onChange={(e) => setEditData({ 
              ...editData, 
              citationCount: parseInt(e.target.value) || 0 
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags:
          </label>
          <input
            type="text"
            value={editData.tags.join(', ')}
            onChange={(e) => setEditData({ 
              ...editData, 
              tags: e.target.value.split(', ').filter(t => t.trim()) 
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Separate tags with commas"
          />
        </div>
      </form>
    </div>
  );
};

export default NodeEditForm;
