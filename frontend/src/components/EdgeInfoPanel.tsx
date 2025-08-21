import React from 'react';
import { Edge, GraphData } from '../types/graph';

interface EdgeInfoPanelProps {
  edge: Edge;
  data: GraphData;
  onEdit: () => void;
  onClose: () => void;
}

const EdgeInfoPanel: React.FC<EdgeInfoPanelProps> = ({ 
  edge, 
  data, 
  onEdit, 
  onClose 
}) => {
  const sourceNode = data.nodes.find(n => n.id === edge.source);
  const targetNode = data.nodes.find(n => n.id === edge.target);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Connection Info</h4>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-3 mb-4">
        <div>
          <span className="font-medium text-gray-700">Source:</span>
          <p className="text-gray-600 text-sm">{sourceNode?.title}</p>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">Target:</span>
          <p className="text-gray-600 text-sm">{targetNode?.title}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium text-gray-700">Relationship:</span>
            <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              {edge.relationship}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Strength:</span>
            <p className="text-gray-600 text-sm">{edge.strength}</p>
          </div>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">Description:</span>
          <p className="text-gray-600 text-sm">{edge.description}</p>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">Evidence:</span>
          <p className="text-gray-600 text-sm">{edge.evidence}</p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors"
        >
          ✏️ Edit
        </button>
      </div>
    </div>
  );
};

export default EdgeInfoPanel;
