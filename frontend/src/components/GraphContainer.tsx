import React, { useState, useEffect } from 'react';
import GraphVisualization from './GraphVisualization';
import { GraphData, Node, Edge } from '../types/graph';
import Sidebar from './Sidebar';

interface GraphContainerProps {
  data?: GraphData;
  onDataUpdate?: (data: GraphData) => void;
}

const GraphContainer: React.FC<GraphContainerProps> = ({ 
  data: initialData, 
  onDataUpdate 
}) => {
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  // Update data when initialData changes
  useEffect(() => {
    if (initialData && initialData.nodes.length > 0) {
      console.log('GraphContainer: Updating with new data', initialData);
      setData(initialData);
      // Clear selected states when new data comes in
      setSelectedNode(null);
      setSelectedEdge(null);
      if (onDataUpdate) {
        onDataUpdate(initialData);
      }
    } else {
      // Generate sample data if none provided
      console.log('GraphContainer: Using sample data');
      const sampleData: GraphData = {
        nodes: [
          {
            id: 'paper1',
            label: 'Paper 1',
            title: 'Advanced Machine Learning',
            authors: ['Alice Johnson', 'Bob Smith'],
            abstract: 'This paper explores advanced ML techniques...',
            introduction: 'Introduction to the study...',
            url: 'https://example.com/paper1',
            tags: ['machine learning', 'neural networks'],
            year: '2023',
            venue: 'ICML',
            citationCount: 45,
          },
          {
            id: 'paper2',
            label: 'Paper 2',
            title: 'Deep Learning Applications',
            authors: ['Carol Davis', 'David Wilson'],
            abstract: 'Applications of deep learning in various domains...',
            introduction: 'Deep learning has revolutionized...',
            url: 'https://example.com/paper2',
            tags: ['deep learning', 'applications'],
            year: '2023',
            venue: 'NeurIPS',
            citationCount: 67,
          },
          {
            id: 'paper3',
            label: 'Paper 3',
            title: 'NLP Advances',
            authors: ['Eve Brown', 'Frank Miller'],
            abstract: 'Recent advances in NLP...',
            introduction: 'NLP has seen significant progress...',
            url: 'https://example.com/paper3',
            tags: ['NLP', 'transformers'],
            year: '2024',
            venue: 'ACL',
            citationCount: 23,
          },
        ],
        edges: [
          {
            source: 'paper1',
            target: 'paper2',
            relationship: 'cites',
            strength: 0.8,
            evidence: 'Direct citation in methodology section',
            description: 'Paper 1 cites Paper 2 for deep learning methods',
          },
          {
            source: 'paper2',
            target: 'paper3',
            relationship: 'builds on',
            strength: 0.6,
            evidence: 'Similar research area',
            description: 'Both papers work on AI applications',
          },
        ],
      };
      setData(sampleData);
      if (onDataUpdate) {
        onDataUpdate(sampleData);
      }
    }
  }, [initialData, onDataUpdate]);

  const handleDataUpdate = (newData: GraphData) => {
    setData(newData);
    if (onDataUpdate) {
      onDataUpdate(newData);
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    const newData = {
      nodes: data.nodes.filter(node => node.id !== nodeId),
      edges: data.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId)
    };
    handleDataUpdate(newData);
    setSelectedNode(null);
  };

  return (
    <div className="flex h-full w-full">
      {/* Main Graph Area */}
      <div className="flex-1 bg-gray-50">
        <GraphVisualization
          data={data}
          onDataUpdate={handleDataUpdate}
        />
      </div>
      
      {/* Sidebar */}
      <div className="w-96 border-l border-gray-200 bg-slate-50">
        <Sidebar
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          data={data}
          onDataUpdate={handleDataUpdate}
          onDeleteNode={handleDeleteNode}
          onClearSelection={() => {
            setSelectedNode(null);
            setSelectedEdge(null);
          }}
        />
      </div>
    </div>
  );
};

export default GraphContainer;
