import React, { useState } from 'react';
import { Node, Edge, GraphData } from '../types/graph';
import NodeInfoPanel from './NodeInfoPanel';
import EdgeInfoPanel from './EdgeInfoPanel';
import NodeEditForm from './NodeEditForm';
import EdgeEditForm from './EdgeEditForm';

interface SidebarProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  data: GraphData;
  onDataUpdate: (data: GraphData) => void;
  onDeleteNode: (nodeId: string) => void;
  onClearSelection: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedNode,
  selectedEdge,
  data,
  onDataUpdate,
  onDeleteNode,
  onClearSelection,
}) => {
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [isEditingEdge, setIsEditingEdge] = useState(false);

  const handleSaveNodeEdit = (editedNode: Node) => {
    const newData = {
      ...data,
      nodes: data.nodes.map(node => 
        node.id === editedNode.id ? editedNode : node
      )
    };
    onDataUpdate(newData);
    setIsEditingNode(false);
  };

  const handleSaveEdgeEdit = (editedEdge: Edge) => {
    const newData = {
      ...data,
      edges: data.edges.map(edge => 
        (edge.source === editedEdge.source && edge.target === editedEdge.target) 
          ? editedEdge : edge
      )
    };
    onDataUpdate(newData);
    setIsEditingEdge(false);
  };

  const handleDeleteNode = (nodeId: string) => {
    onDeleteNode(nodeId);
    onClearSelection();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Panel</h2>
          <p className="text-sm text-gray-600 mt-1">
            Click on nodes or edges to view and edit details
          </p>
        </div>

        {/* Node Section */}
        {selectedNode && (
          <div className="mb-6">
            {isEditingNode ? (
              <NodeEditForm
                node={selectedNode}
                onSave={handleSaveNodeEdit}
                onCancel={() => setIsEditingNode(false)}
              />
            ) : (
              <NodeInfoPanel
                node={selectedNode}
                onEdit={() => setIsEditingNode(true)}
                onDelete={() => handleDeleteNode(selectedNode.id)}
                onClose={onClearSelection}
              />
            )}
          </div>
        )}

        {/* Edge Section */}
        {selectedEdge && (
          <div className="mb-6">
            {isEditingEdge ? (
              <EdgeEditForm
                edge={selectedEdge}
                onSave={handleSaveEdgeEdit}
                onCancel={() => setIsEditingEdge(false)}
              />
            ) : (
              <EdgeInfoPanel
                edge={selectedEdge}
                data={data}
                onEdit={() => setIsEditingEdge(true)}
                onClose={onClearSelection}
              />
            )}
          </div>
        )}

        {/* Empty State */}
        {!selectedNode && !selectedEdge && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-400 text-4xl mb-3">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Selection
            </h3>
            <p className="text-gray-600 text-sm">
              Click on a node or edge in the graph to view its details and make edits.
            </p>
          </div>
        )}

        {/* Graph Statistics */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Statistics</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center p-2 bg-blue-50 rounded-md">
              <div className="text-2xl font-bold text-blue-600">
                {data.nodes.length}
              </div>
              <div className="text-gray-600">Papers</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-md">
              <div className="text-2xl font-bold text-green-600">
                {data.edges.length}
              </div>
              <div className="text-gray-600">Connections</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
