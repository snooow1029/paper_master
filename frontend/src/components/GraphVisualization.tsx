import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Node, Edge, GraphData } from '../types/graph';

interface GraphVisualizationProps {
  data?: GraphData;
  onDataUpdate?: (data: GraphData) => void;
  isLoading?: boolean; // 傳入加載狀態以調整控件位置
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ 
  data: initialData, 
  onDataUpdate,
  isLoading = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [clickedNode, setClickedNode] = useState<Node | null>(null);
  const [clickedEdge, setClickedEdge] = useState<Edge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [isEditingEdge, setIsEditingEdge] = useState(false);
  const [editNodeData, setEditNodeData] = useState<Node | null>(null);
  const [editEdgeData, setEditEdgeData] = useState<Omit<Edge, 'source' | 'target'> & { source: string; target: string } | null>(null);
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [dataVersion, setDataVersion] = useState(0);

  // Filter state: show all nodes or only nodes with edges
  const [showIsolatedNodes, setShowIsolatedNodes] = useState(true);
  
  // Multi-select state: selected node IDs
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  
  // Multi-select hint collapse state
  const [showMultiSelectHint, setShowMultiSelectHint] = useState(true);

  // Helper: check if node is connected to the currently clicked edge
  const isNodeConnectedToClickedEdge = (nodeId: string): boolean => {
    const activeEdge = clickedEdge || selectedEdge;
    if (!activeEdge) return false;
    const sourceId = typeof activeEdge.source === 'string' ? activeEdge.source : (activeEdge.source as Node)?.id;
    const targetId = typeof activeEdge.target === 'string' ? activeEdge.target : (activeEdge.target as Node)?.id;
    return sourceId === nodeId || targetId === nodeId;
  };

  const clearAllSelections = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setClickedNode(null);
    setClickedEdge(null);
    setHoveredNode(null);
    setHoveredEdge(null);
    setSelectedNodeIds(new Set());
  };

  // Helper function to check if a node is a source paper
  const isSourceNode = (nodeId: string): boolean => {
    return data.originalPapers?.includes(nodeId) || false;
  };
  
  // Helper function to check if a node has edges
  const hasEdges = React.useCallback((nodeId: string): boolean => {
    return data.edges.some(edge => {
      const edgeAny = edge as any;
      const sourceId = edgeAny.from || (typeof edge.source === 'string' ? edge.source : (edge.source as Node)?.id);
      const targetId = edgeAny.to || (typeof edge.target === 'string' ? edge.target : (edge.target as Node)?.id);
      return sourceId === nodeId || targetId === nodeId;
    });
  }, [data.edges]);
  
  // Delete selected nodes
  const handleDeleteSelectedNodes = () => {
    if (selectedNodeIds.size === 0) return;
    
    const newData = {
      ...data,
      nodes: data.nodes.filter(node => !selectedNodeIds.has(node.id)),
      edges: data.edges.filter(edge => {
        const edgeAny = edge as any;
        const sourceId = edgeAny.from || (typeof edge.source === 'string' ? edge.source : (edge.source as Node)?.id);
        const targetId = edgeAny.to || (typeof edge.target === 'string' ? edge.target : (edge.target as Node)?.id);
        return !selectedNodeIds.has(sourceId) && !selectedNodeIds.has(targetId);
      })
    };
    setData(newData);
    clearAllSelections();
    setDataVersion(prev => prev + 1);
    if (onDataUpdate) {
      onDataUpdate(newData);
    }
  };
  
  // Toggle node selection (with Ctrl/Cmd support for multi-select)
  const toggleNodeSelection = (node: Node, event: MouseEvent) => {
    const isMultiSelect = event.ctrlKey || event.metaKey;
    
    if (isMultiSelect) {
      // Multi-select mode
      const newSelectedIds = new Set(selectedNodeIds);
      if (newSelectedIds.has(node.id)) {
        newSelectedIds.delete(node.id);
      } else {
        newSelectedIds.add(node.id);
      }
      setSelectedNodeIds(newSelectedIds);
      // Keep the last clicked node as the primary selected node for display
      setSelectedNode(node);
      setClickedNode(node);
    } else {
      // Single select mode (existing behavior)
      if (clickedNode && clickedNode.id === node.id) {
        setSelectedNode(null);
        setClickedNode(null);
        setSelectedNodeIds(new Set());
      } else {
        setSelectedNode(node);
        setClickedNode(node);
        setSelectedNodeIds(new Set([node.id]));
      }
    }
  };

  // Debug: consume hover state to prevent TS warnings
  useEffect(() => {
    if (hoveredNode || hoveredEdge) {
      // These states are used for visual feedback but no additional logic needed here
    }
  }, [hoveredNode, hoveredEdge]);
  
  // Clean up selected nodes when filter mode changes
  useEffect(() => {
    if (!showIsolatedNodes) {
      // When filtering to only show connected nodes, remove isolated nodes from selection
      const filteredNodes = data.nodes.filter(node => hasEdges(node.id));
      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      const newSelectedIds = new Set<string>();
      selectedNodeIds.forEach(id => {
        if (filteredNodeIds.has(id)) {
          newSelectedIds.add(id);
        }
      });
      if (newSelectedIds.size !== selectedNodeIds.size) {
        setSelectedNodeIds(newSelectedIds);
        // If the selected node was filtered out, clear it
        if (selectedNode && !filteredNodeIds.has(selectedNode.id)) {
          setSelectedNode(null);
          setClickedNode(null);
        }
      }
    }
  }, [showIsolatedNodes, data.nodes]);

  // Update data when initialData changes
  useEffect(() => {
    console.log('GraphVisualization useEffect triggered, initialData:', initialData);
    if (initialData && initialData.nodes.length > 0) {
      // Use the provided data
      console.log('GraphVisualization: Updating with new data', initialData);
      console.log('Number of nodes:', initialData.nodes.length);
      console.log('Number of edges:', initialData.edges.length);
      setData(initialData);
      setDataVersion(prev => prev + 1);
      // Clear selected states when new data comes in
      setSelectedNode(null);
      setSelectedEdge(null);
      setClickedNode(null);
      setClickedEdge(null);
      setHoveredNode(null);
      setHoveredEdge(null);
      setIsEditingNode(false);
      setIsEditingEdge(false);
      setEditNodeData(null);
      setEditEdgeData(null);
      if (onDataUpdate) {
        onDataUpdate(initialData);
      }
    } else {
      // Generate sample data if none provided
      console.log('GraphVisualization: Using sample data');
      const sampleData: GraphData = {
        nodes: [
          { id: 'paper1', label: 'Paper 1', title: 'Advanced Machine Learning', authors: ['Alice Johnson', 'Bob Smith'], abstract: '...', introduction: '...', url: '...', tags: ['machine learning'], year: '2023', venue: 'ICML', citationCount: 45 },
          { id: 'paper2', label: 'Paper 2', title: 'Deep Learning Applications', authors: ['Carol Davis', 'David Wilson'], abstract: '...', introduction: '...', url: '...', tags: ['deep learning'], year: '2023', venue: 'NeurIPS', citationCount: 67 },
          { id: 'paper3', label: 'Paper 3', title: 'NLP Advances', authors: ['Eve Brown', 'Frank Miller'], abstract: '...', introduction: '...', url: '...', tags: ['NLP'], year: '2024', venue: 'ACL', citationCount: 23 },
        ],
        edges: [
          { source: 'paper1', target: 'paper2', relationship: 'cites', strength: 0.8, evidence: 'Direct citation', description: 'Paper 1 cites Paper 2' },
          { source: 'paper2', target: 'paper3', relationship: 'builds on', strength: 0.6, evidence: 'Similar area', description: 'Builds on AI applications' },
        ],
      };
      setData(sampleData);
      setDataVersion(prev => prev + 1);
      if (onDataUpdate) {
        onDataUpdate(sampleData);
      }
    }
  }, [initialData, onDataUpdate]);

  // Delete node function
  const handleDeleteNode = (nodeId: string) => {
    const newData = {
      nodes: data.nodes.filter(node => node.id !== nodeId),
      edges: data.edges.filter(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as Node).id;
        const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as Node).id;
        return sourceId !== nodeId && targetId !== nodeId;
      })
    };
    setData(newData);
    clearAllSelections();
    setDataVersion(prev => prev + 1);
    if (onDataUpdate) {
      onDataUpdate(newData);
    }
  };

  // Save node edits
  const handleSaveNodeEdit = () => {
    if (!editNodeData) return;
    
    console.log('🔄 DEBUG: Node Edit Started');
    console.log('📝 Original node before edit:', data.nodes.find(n => n.id === editNodeData.id));
    console.log('✏️ Edited node data:', editNodeData);
    
    // Find connected edges BEFORE edit
    const connectedEdgesBefore = data.edges.filter(e => {
      const eAny = e as any;
      const sourceId = eAny.from || (typeof e.source === 'string' ? e.source : e.source?.id);
      const targetId = eAny.to || (typeof e.target === 'string' ? e.target : e.target?.id);
      return sourceId === editNodeData.id || targetId === editNodeData.id;
    });
    console.log('🔗 Connected edges BEFORE edit:', connectedEdgesBefore);
    
    // Create new nodes array with updated node
    const newNodes = data.nodes.map(node => 
      node.id === editNodeData.id ? editNodeData : node
    );
    
    // 🔧 FIX: Update edges to reference the new node objects
    const newEdges = data.edges.map(edge => {
      const edgeAny = edge as any;
      const sourceId = edgeAny.from || (typeof edge.source === 'string' ? edge.source : edge.source?.id);
      const targetId = edgeAny.to || (typeof edge.target === 'string' ? edge.target : edge.target?.id);
      
      // Find the corresponding new node objects
      const newSourceNode = newNodes.find(n => n.id === sourceId);
      const newTargetNode = newNodes.find(n => n.id === targetId);
      
      return {
        ...edge,
        source: newSourceNode || edge.source,
        target: newTargetNode || edge.target
      };
    });
    
    const newData = {
      ...data,
      nodes: newNodes,
      edges: newEdges
    };
    
    // Find connected edges AFTER edit
    const connectedEdgesAfter = newData.edges.filter(e => {
      const eAny = e as any;
      const sourceId = eAny.from || (typeof e.source === 'string' ? e.source : e.source?.id);
      const targetId = eAny.to || (typeof e.target === 'string' ? e.target : e.target?.id);
      return sourceId === editNodeData.id || targetId === editNodeData.id;
    });
    console.log('✅ Updated node after edit:', newData.nodes.find(n => n.id === editNodeData.id));
    console.log('🔗 Connected edges AFTER edit:', connectedEdgesAfter);
    console.log('📊 Edge connection summary:', {
      beforeCount: connectedEdgesBefore.length,
      afterCount: connectedEdgesAfter.length,
      edgesStillConnected: connectedEdgesBefore.length === connectedEdgesAfter.length
    });
    
    setData(newData);
    setSelectedNode(editNodeData);
    setIsEditingNode(false);
    setEditNodeData(null);
    if (onDataUpdate) {
      onDataUpdate(newData);
    }
  };

  // Save edge edits
  const handleSaveEdgeEdit = () => {
    if (!editEdgeData) return;
    
    const newData = {
      ...data,
      edges: data.edges.map(edge => {
        const edgeAny = edge as any;
        const sourceId = edgeAny.from || (typeof edge.source === 'string' ? edge.source : (edge.source as Node)?.id);
        const targetId = edgeAny.to || (typeof edge.target === 'string' ? edge.target : (edge.target as Node)?.id);
        if (sourceId === editEdgeData.source && targetId === editEdgeData.target) {
            return { ...edge, ...editEdgeData };
        }
        return edge;
      })
    };
    setData(newData);
    setSelectedEdge({
        ...editEdgeData,
        source: data.nodes.find(n => n.id === editEdgeData.source)!,
        target: data.nodes.find(n => n.id === editEdgeData.target)!,
    });
    setIsEditingEdge(false);
    setEditEdgeData(null);
    if (onDataUpdate) {
      onDataUpdate(newData);
    }
  };

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Get actual container dimensions
    const container = svgRef.current.parentElement;
    const width = container ? container.clientWidth : 1000;
    const height = container ? container.clientHeight : 700;
    
    // Reserve space for control panels in top-left corner
    // Control panels are approximately 320px wide and can stack vertically
    const controlPanelWidth = 320;
    const controlPanelTopSpace = selectedNodeIds.size > 0 ? 180 : (showMultiSelectHint ? 180 : 80);
    const margin = { 
      top: Math.max(40, controlPanelTopSpace), 
      right: 40, 
      bottom: 40, 
      left: Math.max(40, controlPanelWidth) 
    };

    svg.attr('width', width).attr('height', height);
    
    const defs = svg.append('defs');
    
  // Obsidian style node gradient - green theme
    const nodeGradient = defs.append('radialGradient').attr('id', 'nodeGradient').attr('cx', '35%').attr('cy', '35%');
    nodeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#64c864').attr('stop-opacity', 0.9);
    nodeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#4ade80').attr('stop-opacity', 0.7);
    
  // Source node gradient - brighter green for input papers
    const sourceNodeGradient = defs.append('radialGradient').attr('id', 'sourceNodeGradient').attr('cx', '35%').attr('cy', '35%');
    sourceNodeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#4ade80').attr('stop-opacity', 1.0);
    sourceNodeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#22c55e').attr('stop-opacity', 0.8);
    
  // Node hover gradient - brighter green
    const nodeHoverGradient = defs.append('radialGradient').attr('id', 'nodeHoverGradient').attr('cx', '35%').attr('cy', '35%');
    nodeHoverGradient.append('stop').attr('offset', '0%').attr('stop-color', '#4ade80').attr('stop-opacity', 1.0);
    nodeHoverGradient.append('stop').attr('offset', '100%').attr('stop-color', '#22c55e').attr('stop-opacity', 0.9);
    
  // Source node hover gradient - brightest green
    const sourceNodeHoverGradient = defs.append('radialGradient').attr('id', 'sourceNodeHoverGradient').attr('cx', '35%').attr('cy', '35%');
    sourceNodeHoverGradient.append('stop').attr('offset', '0%').attr('stop-color', '#22c55e').attr('stop-opacity', 1.0);
    sourceNodeHoverGradient.append('stop').attr('offset', '100%').attr('stop-color', '#16a34a').attr('stop-opacity', 0.9);
    
    const dropShadow = defs.append('filter').attr('id', 'dropShadow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    dropShadow.append('feDropShadow').attr('dx', 1).attr('dy', 2).attr('stdDeviation', 2).attr('flood-color', '#64c864').attr('flood-opacity', 0.3);
    
    // Glow filter for selected nodes
    const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glow.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'coloredBlur');
    const glowFeMerge = glow.append('feMerge');
    glowFeMerge.append('feMergeNode').attr('in', 'coloredBlur');
    glowFeMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const edgeGradient = defs.append('linearGradient').attr('id', 'edgeGradient');
    edgeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#64c864').attr('stop-opacity', 0.6);
    edgeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#4ade80').attr('stop-opacity', 0.4);

    // Create main group with proper transform for margins
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Adjust simulation dimensions to account for margins
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;

    // Get filtered nodes and edges
    // Important: Filter nodes based on showIsolatedNodes setting
    const filteredNodes = showIsolatedNodes 
      ? data.nodes 
      : data.nodes.filter(node => {
          // Check if node has at least one edge
          return data.edges.some(edge => {
            const edgeAny = edge as any;
            const sourceId = edgeAny.from || (typeof edge.source === 'string' ? edge.source : (edge.source as Node)?.id);
            const targetId = edgeAny.to || (typeof edge.target === 'string' ? edge.target : (edge.target as Node)?.id);
            return sourceId === node.id || targetId === node.id;
          });
        });
    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
    // Convert edges from 'from/to' format to 'source/target' format for D3
    // D3 forceLink expects source/target to be node IDs (strings), which it will resolve to node objects
    const filteredEdges = data.edges
      .map(edge => {
        // Support both 'from/to' and 'source/target' formats
        // Use type assertion to access 'from' and 'to' which may exist in raw data
        const edgeAny = edge as any;
        const sourceId = edgeAny.from || (typeof edge.source === 'string' ? edge.source : (edge.source as Node)?.id);
        const targetId = edgeAny.to || (typeof edge.target === 'string' ? edge.target : (edge.target as Node)?.id);
        // Ensure source and target are strings (node IDs)
        const sourceIdStr = typeof sourceId === 'string' ? sourceId : String(sourceId);
        const targetIdStr = typeof targetId === 'string' ? targetId : String(targetId);
        return {
          ...edge,
          source: sourceIdStr, // D3 will resolve this to node object
          target: targetIdStr, // D3 will resolve this to node object
        };
      })
      .filter(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : String(edge.source);
        const targetId = typeof edge.target === 'string' ? edge.target : String(edge.target);
        return sourceId && targetId && visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
      });

    // Use D3 join pattern to properly handle enter/update/exit
    const links = g.selectAll('.link')
      .data(filteredEdges, (d: any) => {
        const sourceId = typeof d.source === 'string' ? d.source : (d.source as Node).id;
        const targetId = typeof d.target === 'string' ? d.target : (d.target as Node).id;
        return `${sourceId}-${targetId}`;
      });
    
    // Remove exiting links
    links.exit().remove();
    
    // Add entering links
    const linksEnter = links.enter().append('line').attr('class', 'link');
    const linksUpdate = linksEnter.merge(links as any);
    
    const nodes = g.selectAll('.node')
      .data(filteredNodes, (d: any) => d.id);
    
    // Remove exiting nodes
    nodes.exit().remove();
    
    // Add entering nodes
    const nodesEnter = nodes.enter().append('circle').attr('class', 'node');
    const nodesUpdate = nodesEnter.merge(nodes as any);
    
    const nodePrimaryColor = '#38bdf8'; // blue glow for selected nodes
    const nodeMultiColor = '#38bdf8';   // same blue for multi-select
    const edgeHighlightColor = '#c084fc'; // clicked edge / edge-connected nodes
    
    // Determine active edge (for maintaining purple highlight)
    const activeEdge = clickedEdge || selectedEdge;

    // Update links styling - maintain purple highlight for selected edge
    linksUpdate
      .attr('stroke', (d: any) => {
        if (activeEdge && d === activeEdge) return edgeHighlightColor; // Purple for selected edge
        return 'rgba(100, 200, 100, 0.5)';
      })
      .attr('stroke-width', (d: any) => {
        if (activeEdge && d === activeEdge) return Math.sqrt((d.strength || 1) * 12) + 6; // Thicker for selected edge
        return Math.sqrt((d.strength || 1) * 8) + 1;
      })
      .attr('opacity', (d: any) => {
        if (activeEdge && d === activeEdge) return 1.0; // Full opacity for selected edge
        return activeEdge ? 0.3 : 0.6; // Dim other edges when one is selected
      })
      .style('cursor', 'pointer');
    
    // Update nodes styling - make selected nodes more visible and distinguish states
    nodesUpdate
      .attr('r', 26)
      .attr('fill', (d: Node) => {
        if (clickedNode && clickedNode.id === d.id) {
          return isSourceNode(d.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
        }
        if (selectedNodeIds.has(d.id)) {
          return isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)';
        }
        if (isNodeConnectedToClickedEdge(d.id)) {
          return isSourceNode(d.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
        }
        return isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)';
      })
      .attr('stroke', (d: Node) => {
        if (clickedNode && clickedNode.id === d.id) {
          return nodePrimaryColor; // Bright green for clicked node
        }
        if (selectedNodeIds.has(d.id)) {
          return nodeMultiColor; // Cyan for multi-selected nodes
        }
        if (isNodeConnectedToClickedEdge(d.id)) {
          return edgeHighlightColor; // Purple for nodes connected to clicked edge
        }
        return 'rgba(100, 200, 100, 0.4)';
      })
      .attr('stroke-width', (d: Node) => {
        if (clickedNode && clickedNode.id === d.id) {
          return 4; // Thicker border for clicked node
        }
        if (selectedNodeIds.has(d.id)) {
          return 3;
        }
        if (isNodeConnectedToClickedEdge(d.id)) {
          return 3;
        }
        return 2;
      })
      .attr('filter', (d: Node) => {
        // Add glow effect for clicked, multi-selected, or edge-connected nodes
        if ((clickedNode && clickedNode.id === d.id) || selectedNodeIds.has(d.id) || isNodeConnectedToClickedEdge(d.id)) {
          return 'url(#dropShadow) url(#glow)';
        }
        return 'url(#dropShadow)';
      })
      .style('cursor', 'pointer');

    svg.on('click', function(event) {
      if (event.target === this || (event.target as SVGElement).tagName === 'svg') {
        // Don't clear states if we're in editing mode
        if (isEditingNode || isEditingEdge) {
          return;
        }
        clearAllSelections();
      }
    });
  
    // Identify source nodes (original papers) for better layout
    const sourceNodeIds = new Set(data.originalPapers || []);
    
    // Initialize node positions - source nodes near center (accounting for margins)
    const centerX = graphWidth / 2;
    const centerY = graphHeight / 2;
    filteredNodes.forEach((node, i) => {
      if (!node.x || !node.y) {
        if (isSourceNode(node.id)) {
          // Source nodes: place near center with slight spread
          const angle = (i * 2 * Math.PI) / Math.max(sourceNodeIds.size, 1);
          const radius = 80;
          node.x = centerX + Math.cos(angle) * radius;
          node.y = centerY + Math.sin(angle) * radius;
        } else {
          // Other nodes: spread randomly but not too far (accounting for margins)
          node.x = centerX + (Math.random() - 0.5) * graphWidth * 0.6;
          node.y = centerY + (Math.random() - 0.5) * graphHeight * 0.6;
        }
      }
    });

    // Calculate optimal link distance based on graph size (using filtered data)
    const nodeCount = filteredNodes.length;
    
    // Adaptive distance: larger graphs need more space
    const baseDistance = Math.max(150, Math.min(250, 100 + nodeCount * 2));
    const linkDistance = baseDistance;
    
    // Adaptive charge strength: larger graphs need stronger repulsion
    const baseCharge = -300;
    const chargeStrength = baseCharge - nodeCount * 5;

    const simulation = d3.forceSimulation<Node>(filteredNodes)
      .force('link', d3.forceLink<Node, Edge>(filteredEdges)
        .id(d => d.id)
        .distance((d: any) => {
          // Vary distance based on relationship strength
          const strength = d.strength || 0.5;
          return linkDistance * (0.8 + strength * 0.4); // 80% to 120% of base distance
        })
        .strength((d: any) => {
          // Stronger links pull nodes closer
          return (d.strength || 0.5) * 0.5;
        }))
      .force('charge', d3.forceManyBody()
        .strength((d) => {
          // Source nodes have less repulsion (stay closer to center)
          const node = d as Node;
          if (isSourceNode(node.id)) {
            return chargeStrength * 0.7;
          }
          return chargeStrength;
        })
        .theta(0.9)
        .distanceMax(Math.min(graphWidth, graphHeight) * 0.6))
      .force('center', d3.forceCenter(centerX, centerY).strength(0.05))
      .force('collision', d3.forceCollide()
        .radius((d) => {
          // Larger radius for source nodes and nodes with more citations
          const node = d as Node;
          const baseRadius = 35;
          if (isSourceNode(node.id)) {
            return baseRadius + 6;
          }
          const citationCount = node.citationCount || 0;
          return baseRadius + Math.min(citationCount / 50, 5); // Slightly larger for highly cited papers
        })
        .strength(0.85))
      .force('x', d3.forceX(centerX).strength(0.02))
      .force('y', d3.forceY(centerY).strength(0.02))
      .alphaDecay(0.022)
      .velocityDecay(0.4)
        .alpha(1)
        .restart();
    
    // Links click handler (attached before mouse handlers)
    linksUpdate
      .on('click', (event, d) => {
        event.stopPropagation(); // Prevent event from bubbling to SVG
        // Check if the same edge was clicked
        if (clickedEdge && clickedEdge === d) {
          // If edge is in editing mode, don't toggle off
          if (isEditingEdge) {
            return;
          }
        }
        
        setSelectedEdge(d);
        setClickedEdge(d);
        setClickedNode(null); // Clear clicked node state
        
        // Exit any existing editing mode when clicking a different edge
        setIsEditingNode(false);
        setIsEditingEdge(false);
        setEditNodeData(null);
        setEditEdgeData(null);
        
        // Apply clicked edge styling - edge and connected nodes should be purple
        const edgeHighlightColor = '#c084fc'; // Purple for edge highlighting
        linksUpdate
          .attr('stroke', (linkData: any) => (linkData === d) ? edgeHighlightColor : 'rgba(100, 200, 100, 0.3)')
          .attr('opacity', (linkData: any) => (linkData === d) ? 1.0 : 0.3)
          .attr('stroke-width', (linkData: any) => (linkData === d) 
            ? Math.sqrt((linkData.strength || 1) * 12) + 6 
            : Math.sqrt((linkData.strength || 1) * 8) + 1);
        
        nodesUpdate
          .attr('r', (nodeData: any) => {
            const sourceId = typeof d.source === 'string' ? d.source : (d.source as Node)?.id;
            const targetId = typeof d.target === 'string' ? d.target : (d.target as Node)?.id;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? 28 : 26;
          })
          .attr('fill', (nodeData: any) => {
            const sourceId = typeof d.source === 'string' ? d.source : (d.source as Node)?.id;
            const targetId = typeof d.target === 'string' ? d.target : (d.target as Node)?.id;
            if (nodeData.id === sourceId || nodeData.id === targetId) {
              return isSourceNode(nodeData.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
            }
            return isSourceNode(nodeData.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)';
          })
          .style('stroke', (nodeData: any) => {
            const sourceId = typeof d.source === 'string' ? d.source : (d.source as Node)?.id;
            const targetId = typeof d.target === 'string' ? d.target : (d.target as Node)?.id;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? edgeHighlightColor : 'rgba(100, 200, 100, 0.4)'; // Purple for edge-connected nodes
          })
          .style('stroke-width', (nodeData: any) => {
            const sourceId = typeof d.source === 'string' ? d.source : (d.source as Node)?.id;
            const targetId = typeof d.target === 'string' ? d.target : (d.target as Node)?.id;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? 3 : 2;
          })
          .attr('filter', (nodeData: any) => {
            const sourceId = typeof d.source === 'string' ? d.source : (d.source as Node)?.id;
            const targetId = typeof d.target === 'string' ? d.target : (d.target as Node)?.id;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? 'url(#dropShadow) url(#glow)' : 'url(#dropShadow)';
          });
      })
    linksUpdate
      .on('mouseenter', function(_event, d) {
        // Only apply hover if this edge is not clicked
        if (!clickedEdge || clickedEdge !== d) {
          setHoveredEdge(d);
          d3.select(this)
            .attr('stroke', '#64c864')
            .attr('opacity', 0.8)
            .attr('stroke-width', Math.sqrt(d.strength * 10) + 2);
        }
      })
      .on('mouseleave', function(_event, d) {
        // Only restore if this edge is not clicked
        if (!clickedEdge || clickedEdge !== d) {
          setHoveredEdge(null);
          const activeEdge = clickedEdge || selectedEdge;
          d3.select(this)
            .attr('stroke', (activeEdge && d === activeEdge) ? '#c084fc' : 'rgba(100, 200, 100, 0.5)')
            .attr('opacity', (activeEdge && d === activeEdge) ? 1.0 : (activeEdge ? 0.3 : 0.6))
            .attr('stroke-width', (activeEdge && d === activeEdge) 
              ? Math.sqrt((d.strength || 1) * 12) + 6 
              : Math.sqrt((d.strength || 1) * 8) + 1);
        }
      });

    // Attach click and mouse event handlers to nodesUpdate (not nodes)
    nodesUpdate
      .on('click', (event, d) => {
        event.stopPropagation(); // Prevent event from bubbling to SVG
        
        // Handle multi-select with Ctrl/Cmd key
        if (event.ctrlKey || event.metaKey) {
          toggleNodeSelection(d, event as any);
          return;
        }
        
        // Check if the same node was clicked
        if (clickedNode && clickedNode.id === d.id) {
          // If node is in editing mode, don't toggle off
          if (isEditingNode) {
            return;
          }
          clearAllSelections();
        } else {
          // Clicked a new node: set as current clicked node
          setClickedNode(d);
          setSelectedNode(d);
          setSelectedNodeIds(new Set([d.id]));
          
          // Exit any existing editing mode when clicking a different node
          setIsEditingNode(false);
          setIsEditingEdge(false);
          setEditNodeData(null);
          setEditEdgeData(null);
          
          // Apply clicked node styling
          linksUpdate
            .attr('stroke', (linkData: any) => {
              const sourceId = typeof linkData.source === 'string' ? linkData.source : (linkData.source as Node).id;
              const targetId = typeof linkData.target === 'string' ? linkData.target : (linkData.target as Node).id;
            return (sourceId === d.id || targetId === d.id) ? '#c084fc' : 'rgba(100, 200, 100, 0.5)';
            })
            .attr('opacity', (linkData: any) => {
              const sourceId = typeof linkData.source === 'string' ? linkData.source : (linkData.source as Node).id;
              const targetId = typeof linkData.target === 'string' ? linkData.target : (linkData.target as Node).id;
              return (sourceId === d.id || targetId === d.id) ? 0.9 : 0.3;
            })
            .attr('stroke-width', (linkData: any) => {
              const sourceId = typeof linkData.source === 'string' ? linkData.source : (linkData.source as Node).id;
              const targetId = typeof linkData.target === 'string' ? linkData.target : (linkData.target as Node).id;
              return (sourceId === d.id || targetId === d.id) ? Math.sqrt(linkData.strength * 8) + 3 : Math.sqrt(linkData.strength * 8) + 1;
            });
          
          nodesUpdate
            .attr('r', (nodeData: any) => nodeData.id === d.id ? 32 : 26)
            .attr('fill', (nodeData: any) => {
              if (nodeData.id === d.id) {
                return isSourceNode(nodeData.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
              }
              return isSourceNode(nodeData.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)';
            })
            .attr('stroke', (nodeData: any) => {
              if (nodeData.id === d.id) return '#38bdf8';
              return selectedNodeIds.has(nodeData.id) ? '#38bdf8' : 'rgba(100, 200, 100, 0.4)';
            })
            .attr('stroke-width', (nodeData: any) => {
              if (nodeData.id === d.id) return 3;
              return selectedNodeIds.has(nodeData.id) ? 3 : 2;
            });
        }
      })
      // Mouse event handlers
      .on('mouseenter', function(_event, d) {
        // Only show hover effect if the node is not clicked
        if (!clickedNode || clickedNode.id !== d.id) {
          setHoveredNode(d);
          
          // Apply hover styling for links
          linksUpdate
            .attr('stroke', (linkData: any) => {
              const sourceId = typeof linkData.source === 'string' ? linkData.source : (linkData.source as Node).id;
              const targetId = typeof linkData.target === 'string' ? linkData.target : (linkData.target as Node).id;
              return (sourceId === d.id || targetId === d.id) ? '#B89B74' : '#D2CBBF';
            })
            .attr('opacity', (linkData: any) => {
              const sourceId = typeof linkData.source === 'string' ? linkData.source : (linkData.source as Node).id;
              const targetId = typeof linkData.target === 'string' ? linkData.target : (linkData.target as Node).id;
              return (sourceId === d.id || targetId === d.id) ? 0.9 : 0.4;
            })
            .attr('stroke-width', (linkData: any) => {
              const sourceId = typeof linkData.source === 'string' ? linkData.source : (linkData.source as Node).id;
              const targetId = typeof linkData.target === 'string' ? linkData.target : (linkData.target as Node).id;
              return (sourceId === d.id || targetId === d.id) ? Math.sqrt(linkData.strength * 8) + 2 : Math.sqrt(linkData.strength * 8) + 1;
            });
          
          // Apply hover styling for this node
          d3.select(this)
            .attr('r', 28)
            .attr('fill', isSourceNode(d.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)')
            .style('stroke', '#64c864')
            .style('stroke-width', 3);
        }
      })
      .on('mouseleave', function(_event, d) {
        // Only restore if this node is not clicked
        if (!clickedNode || clickedNode.id !== d.id) {
          setHoveredNode(null);
          
          // Restore links if no node or edge is selected
          if (!selectedNode && !selectedEdge) {
            linksUpdate
              .attr('stroke', 'rgba(100, 200, 100, 0.5)')
              .attr('opacity', 0.6)
              .attr('stroke-width', (linkData: any) => Math.sqrt(linkData.strength * 8) + 1);
          }
          
          // Restore this node
          d3.select(this)
            .attr('r', 26)
            .attr('fill', isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
            .attr('stroke', selectedNodeIds.has(d.id) ? '#9F7AEA' : '#F5F5DC')
            .attr('stroke-width', selectedNodeIds.has(d.id) ? 3 : 2);
        }
      })
      .on('dblclick', (_event, d) => {
        d.fx = undefined;
        d.fy = undefined;
        d.vx = 0;
        d.vy = 0;
        simulation.alpha(0.03).restart();
      });

    // Handle labels with enter/update/exit pattern
    // Handle labels with enter/update/exit pattern
    const titleLabels = g.selectAll('.title-label')
      .data(filteredNodes, (d: any) => d.id);
    
    titleLabels.exit().remove();
    
    const titleLabelsEnter = titleLabels.enter().append('text')
      .attr('class', 'title-label')
      .attr('dx', 32)
      .attr('dy', -6)
      .style('font-size', '12px')
      .style('font-family', '"Lora", "Merriweather", "Georgia", serif')
      .style('font-weight', '400')
      .style('fill', '#e8e8e8')
      .style('cursor', 'pointer');
    
    const titleLabelsUpdate = titleLabelsEnter.merge(titleLabels as any);
    titleLabelsUpdate.text((d) => d.title.length > 28 ? d.title.substring(0, 28) + '…' : d.title)
      // ✅ **FIX 3: Removed the entire duplicated `dblclick` handler.**
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        const foreignObject = g.append('foreignObject').attr('x', d.x! + 32).attr('y', d.y! - 16).attr('width', 220).attr('height', 24);
        const input = foreignObject.append('xhtml:input')
          .attr('type', 'text')
          .attr('value', d.title)
          .style('width', '100%')
          .style('font-size', '12px')
          .style('font-family', '"Lora", "Merriweather", "Georgia", serif')
          .style('font-weight', '400')
          .style('border', `1px solid rgba(100, 200, 100, 0.3)`)
          .style('border-radius', '6px')
          .style('padding', '3px 6px')
          .style('background-color', '#252525')
          .style('color', '#e8e8e8');
        
        const label = d3.select(event.target as Element);
        label.style('display', 'none');
        
        (input.node() as HTMLInputElement)?.focus();
        (input.node() as HTMLInputElement)?.select();
        
        const finishEdit = () => {
          const newTitle = (input.node() as HTMLInputElement).value.trim();
          if (newTitle && newTitle !== d.title) {
            d.title = newTitle;
            const displayText = newTitle.length > 28 ? newTitle.substring(0, 28) + '…' : newTitle;
            label.text(displayText);
            if (onDataUpdate) {
              onDataUpdate(data);
            }
          }
          foreignObject.remove();
          label.style('display', 'block');
        };
        
        input.on('blur', finishEdit);
        input.on('keydown', (event) => {
          if (event.key === 'Enter') finishEdit();
          else if (event.key === 'Escape') {
            foreignObject.remove();
            label.style('display', 'block');
          }
        });
      });

    const yearLabels = g.selectAll('.year-label')
      .data(filteredNodes, (d: any) => d.id);
    
    yearLabels.exit().remove();
    
    const yearLabelsEnter = yearLabels.enter().append('text')
      .attr('class', 'year-label')
      .attr('dx', 32)
      .attr('dy', 14)
      .style('font-size', '10px')
      .style('font-family', '"Inter", "Lato", "Segoe UI", "Roboto", sans-serif')
      .style('font-weight', '400')
      .style('fill', '#b8b8b8')
      .style('opacity', '0.75')
      .style('cursor', 'pointer');
    
    const yearLabelsUpdate = yearLabelsEnter.merge(yearLabels as any);
    yearLabelsUpdate.text((d) => {
        if (!d.year) return '';
        
        // 统一格式化为完整的四位数西元年份
        // 处理各种可能的格式：'2017', '17', "'17", "2015", "1953", "2308" (2023年8月), "2017-2018"等
        let yearStr = String(d.year).trim();
        
        // 如果包含 '-' 或 '/'，只取第一部分（年份部分）
        if (yearStr.includes('-') || yearStr.includes('/')) {
          yearStr = yearStr.split(/[-\/]/)[0].trim();
        }
        
        // 移除单引号或其他前缀
        yearStr = yearStr.replace(/^['"]*/, '').replace(/['"]*$/, '');
        
        // 转换为数字
        let yearNum = parseInt(yearStr, 10);
        
        // 如果是 NaN，尝试其他解析方式
        if (isNaN(yearNum)) {
          // 尝试提取数字部分
          const match = yearStr.match(/\d{4}|\d{2}/);
          if (match) {
            yearNum = parseInt(match[0], 10);
            // 如果是两位数，判断是 1900 还是 2000 年代
            if (match[0].length === 2) {
              yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
        }
          } else {
            return ''; // 无法解析，返回空
          }
        } else {
          // 如果是两位数，判断是 1900 还是 2000 年代
          if (yearNum < 100) {
            yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
          }
        }
        
        // 确保年份在合理范围内（1900-2100）
        if (yearNum < 1900 || yearNum > 2100) {
          return ''; // 超出范围，返回空
        }
        
        // 返回完整的四位数年份
        return String(yearNum);
      });

    const drag = d3.drag<SVGCircleElement, Node>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        const nodeRadius = 25;
        const minX = nodeRadius;
        const maxX = graphWidth - nodeRadius;
        const minY = nodeRadius;
        const maxY = graphHeight - nodeRadius;
        d.fx = Math.max(minX, Math.min(maxX, event.x));
        d.fy = Math.max(minY, Math.min(maxY, event.y));
      })
      .on('end', (event, _d) => {
        if (!event.active) simulation.alphaTarget(0);
      });
    nodesUpdate.call(drag);

    simulation.on('tick', () => {
      // Apply boundary constraints (within graph area, accounting for margins)
      const nodeRadius = 35;
      const minX = nodeRadius;
      const maxX = graphWidth - nodeRadius;
      const minY = nodeRadius;
      const maxY = graphHeight - nodeRadius;
      
      filteredNodes.forEach(d => {
        if (d.x !== undefined && d.y !== undefined) {
          d.x = Math.max(minX, Math.min(maxX, d.x));
          d.y = Math.max(minY, Math.min(maxY, d.y));
        }
      });

      linksUpdate
        .attr('x1', (d: any) => {
          const source = typeof d.source === 'string' ? filteredNodes.find(n => n.id === d.source) : d.source;
          return (source as any)?.x || 0;
        })
        .attr('y1', (d: any) => {
          const source = typeof d.source === 'string' ? filteredNodes.find(n => n.id === d.source) : d.source;
          return (source as any)?.y || 0;
        })
        .attr('x2', (d: any) => {
          const target = typeof d.target === 'string' ? filteredNodes.find(n => n.id === d.target) : d.target;
          return (target as any)?.x || 0;
        })
        .attr('y2', (d: any) => {
          const target = typeof d.target === 'string' ? filteredNodes.find(n => n.id === d.target) : d.target;
          return (target as any)?.y || 0;
        });

      nodesUpdate.attr('cx', (d: any) => d.x || 0).attr('cy', (d: any) => d.y || 0);
      titleLabelsUpdate.attr('x', (d: any) => d.x || 0).attr('y', (d: any) => (d.y || 0) - 10);
      yearLabelsUpdate.attr('x', (d: any) => d.x || 0).attr('y', (d: any) => (d.y || 0) + 10);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dataVersion, onDataUpdate, isEditingNode, isEditingEdge, showIsolatedNodes, selectedNodeIds, hasEdges, clickedEdge, selectedEdge]);

  // Separate useEffect to maintain highlighting during editing
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    const links = svg.selectAll('.link');
    const nodes = svg.selectAll('.node');

    const nodePrimaryColor = '#38bdf8'; // blue for selected nodes
    const nodeMultiColor = '#38bdf8';   // blue for multi-selected nodes
    const edgeHighlightColor = '#c084fc'; // purple for selected edge & endpoints
    const activeEdge = clickedEdge || selectedEdge;

    // Base highlighting for current selections / hovers
    links
      .attr('stroke', (linkData: any) => {
        if (activeEdge && linkData === activeEdge) return edgeHighlightColor;
        if (hoveredEdge && linkData === hoveredEdge) return '#64c864';
        return 'rgba(100, 200, 100, 0.5)';
      })
      .attr('opacity', (linkData: any) => {
        if (activeEdge && linkData === activeEdge) return 1;
        if (hoveredEdge && linkData === hoveredEdge) return 0.8;
        return 0.6;
      })
      .attr('stroke-width', (linkData: any) => {
        const baseWidth = Math.sqrt((linkData.strength || 1) * 8) + 1;
        if (activeEdge && linkData === activeEdge) return Math.sqrt((linkData.strength || 1) * 12) + 6;
        if (hoveredEdge && linkData === hoveredEdge) return Math.sqrt((linkData.strength || 1) * 10) + 2;
        return baseWidth;
      });

    nodes
      .attr('r', (nodeData: any) => {
        if (clickedNode && clickedNode.id === nodeData.id) return 32;
        if (selectedNodeIds.has(nodeData.id)) return 28;
        if (isNodeConnectedToClickedEdge(nodeData.id)) return 28;
        return 26;
      })
      .attr('fill', (nodeData: any) => {
        if (clickedNode && clickedNode.id === nodeData.id) {
          return isSourceNode(nodeData.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
        }
        if (selectedNodeIds.has(nodeData.id)) {
          return isSourceNode(nodeData.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
        }
        if (isNodeConnectedToClickedEdge(nodeData.id)) {
          return isSourceNode(nodeData.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
        }
        return isSourceNode(nodeData.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)';
      })
      .style('stroke', (nodeData: any) => {
        if (clickedNode && clickedNode.id === nodeData.id) return nodePrimaryColor;
        if (selectedNodeIds.has(nodeData.id)) return nodeMultiColor;
        if (isNodeConnectedToClickedEdge(nodeData.id)) return edgeHighlightColor;
        return 'rgba(100, 200, 100, 0.4)';
      })
      .style('stroke-width', (nodeData: any) => {
        if (clickedNode && clickedNode.id === nodeData.id) return 4;
        if (selectedNodeIds.has(nodeData.id)) return 3;
        if (isNodeConnectedToClickedEdge(nodeData.id)) return 3;
        return 2;
      })
      .attr('filter', (nodeData: any) => {
        if ((clickedNode && clickedNode.id === nodeData.id) || selectedNodeIds.has(nodeData.id) || isNodeConnectedToClickedEdge(nodeData.id)) {
          return 'url(#dropShadow) url(#glow)';
        }
        return 'url(#dropShadow)';
      });
    
    // Maintain node highlighting during editing
    if (isEditingNode && selectedNode) {
      links
        .attr('stroke', (linkData: any) => ((linkData.source as Node).id === selectedNode.id || (linkData.target as Node).id === selectedNode.id) ? 'url(#edgeGradient)' : 'rgba(100, 200, 100, 0.3)')
        .attr('opacity', (linkData: any) => ((linkData.source as Node).id === selectedNode.id || (linkData.target as Node).id === selectedNode.id) ? 0.9 : 0.3)
        .attr('stroke-width', (linkData: any) => ((linkData.source as Node).id === selectedNode.id || (linkData.target as Node).id === selectedNode.id) ? Math.sqrt((linkData.strength || 1) * 8) + 3 : Math.sqrt((linkData.strength || 1) * 8) + 1);
      
      nodes
        .attr('r', (nodeData: any) => nodeData.id === selectedNode.id ? 32 : 26)
        .attr('fill', (nodeData: any) => {
          if (nodeData.id === selectedNode.id) {
            return isSourceNode(nodeData.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
          }
          return isSourceNode(nodeData.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)';
        })
        .style('stroke', (nodeData: any) => nodeData.id === selectedNode.id ? nodePrimaryColor : 'rgba(100, 200, 100, 0.4)')
        .style('stroke-width', (nodeData: any) => nodeData.id === selectedNode.id ? 3 : 2);
    }
    
    // Maintain edge highlighting during editing
    if (isEditingEdge && selectedEdge) {
      links
        .attr('stroke', (linkData: any) => (linkData === selectedEdge) ? 'url(#edgeGradient)' : 'rgba(100, 200, 100, 0.3)')
        .attr('opacity', (linkData: any) => (linkData === selectedEdge) ? 1 : 0.3)
        .attr('stroke-width', (linkData: any) => (linkData === selectedEdge) ? Math.sqrt((linkData.strength || 1) * 12) + 6 : Math.sqrt((linkData.strength || 1) * 12) + 3);
      
      nodes
        .attr('r', (nodeData: any) => {
          const sourceId = (selectedEdge.source as Node).id || selectedEdge.source;
          const targetId = (selectedEdge.target as Node).id || selectedEdge.target;
          return (nodeData.id === sourceId || nodeData.id === targetId) ? 28 : 25;
        })
        .attr('fill', (nodeData: any) => isSourceNode(nodeData.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
        .style('stroke', (nodeData: any) => {
          const sourceId = (selectedEdge.source as Node).id || selectedEdge.source;
          const targetId = (selectedEdge.target as Node).id || selectedEdge.target;
          return (nodeData.id === sourceId || nodeData.id === targetId) ? nodePrimaryColor : 'rgba(100, 200, 100, 0.4)';
        })
        .style('stroke-width', (nodeData: any) => {
          const sourceId = (selectedEdge.source as Node).id || selectedEdge.source;
          const targetId = (selectedEdge.target as Node).id || selectedEdge.target;
          return (nodeData.id === sourceId || nodeData.id === targetId) ? 4 : 2;
        });
    }
  }, [isEditingNode, isEditingEdge, selectedNode, selectedEdge, data, clickedNode, clickedEdge, hoveredEdge, selectedNodeIds]);

   // Keep panels below multi-select hints - adjusted to be closer to hint without overlapping
   // Multi-select hint + delete button can take ~180-200px, but we want less gap
   // When only edge is selected (no node), use same position as when only node is selected
   const overlayTop = (selectedNodeIds.size > 0 || selectedEdge) ? 170 : 150;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Toggle button and controls in top-left - moved down to avoid progress bar */}
      <div style={{ 
        position: 'absolute', 
        top: isLoading ? '240px' : '16px',  // 當進度條顯示時，控件位置更低（進度條高度約200px，加上間距）
        left: '16px', 
        zIndex: isLoading ? 998 : 1000,  // 進度條顯示時，控件 z-index 更低，確保進度條在上方
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'top 0.3s ease'  // 平滑過渡
      }}>
        {/* Toggle switch for showing/hiding isolated nodes */}
        <div style={{
          background: '#2d2d2d',
          border: `1px solid rgba(100, 200, 100, 0.3)`,
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <span style={{ 
            fontSize: '13px', 
            color: '#e8e8e8',
            fontWeight: '500',
            whiteSpace: 'nowrap'
          }}>
            {showIsolatedNodes ? 'Show All Nodes' : 'Hide Nodes with No Edges'}
          </span>
          
          {/* Toggle Switch - Obsidian style */}
          <button
            onClick={() => setShowIsolatedNodes(!showIsolatedNodes)}
            className="flex items-center justify-start rounded-full transition-all duration-200 relative"
            style={{
              width: '44px',
              height: '24px',
              backgroundColor: showIsolatedNodes ? '#64c864' : '#252525',
              padding: '2px',
              border: '1px solid rgba(100, 200, 100, 0.3)',
              cursor: 'pointer',
              boxShadow: showIsolatedNodes ? '0 0 8px rgba(100, 200, 100, 0.3)' : 'none'
            }}
            title={showIsolatedNodes ? 'Switch to hide isolated nodes' : 'Switch to show all nodes'}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = showIsolatedNodes ? '#4ade80' : '#2d2d2d';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = showIsolatedNodes ? '#64c864' : '#252525';
            }}
          >
            <div 
              className="absolute rounded-full shadow-sm transition-all duration-200"
              style={{
                width: '20px',
                height: '20px',
                left: showIsolatedNodes ? '22px' : '2px',
                top: '2px',
                backgroundColor: '#e8e8e8',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}
            />
          </button>
          
          <span style={{ 
            fontSize: '11px', 
            color: '#b8b8b8',
            fontStyle: 'italic'
          }}>
            {showIsolatedNodes ? '(including isolated nodes)' : '(connected nodes only)'}
          </span>
        </div>
        
        {/* Multi-select hint */}
        {selectedNodeIds.size === 0 && (
          <div style={{
            background: '#2d2d2d',
            border: `1px solid rgba(100, 200, 100, 0.3)`,
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            maxWidth: '280px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: showMultiSelectHint ? '4px' : '0',
              cursor: 'pointer'
            }}
            onClick={() => setShowMultiSelectHint(!showMultiSelectHint)}
            >
              <div style={{ fontSize: '12px', color: '#e8e8e8', fontWeight: '500' }}>
                💡 Multi-Select Nodes
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMultiSelectHint(!showMultiSelectHint);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#b8b8b8',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'transform 0.2s'
                }}
                title={showMultiSelectHint ? 'Collapse hint' : 'Expand hint'}
              >
                {showMultiSelectHint ? '▼' : '▶'}
              </button>
            </div>
            {showMultiSelectHint && (
              <div style={{ fontSize: '11px', color: '#b8b8b8', lineHeight: '1.4' }}>
                Hold <kbd style={{ 
                  background: '#252525', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  color: '#64c864',
                  border: '1px solid rgba(100, 200, 100, 0.3)'
                }}>Ctrl</kbd> (Windows/Linux) or <kbd style={{ 
                  background: '#252525', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  color: '#64c864',
                  border: '1px solid rgba(100, 200, 100, 0.3)'
                }}>Cmd</kbd> (Mac) and click nodes to select multiple
              </div>
            )}
          </div>
        )}
        
        {/* Delete selected nodes button */}
        {selectedNodeIds.size > 0 && (
          <div style={{
            background: '#2d2d2d',
            border: `1px solid rgba(220, 38, 38, 0.4)`,
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            maxWidth: '280px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleDeleteSelectedNodes}
                style={{
                  background: '#dc4444',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  color: '#e8e8e8',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#dc4444';
                }}
              >
                🗑️ Delete ({selectedNodeIds.size})
              </button>
              <span style={{ fontSize: '11px', color: '#b8b8b8' }}>
                {selectedNodeIds.size} node{selectedNodeIds.size > 1 ? 's' : ''} selected
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#b8b8b8', fontStyle: 'italic', lineHeight: '1.3' }}>
              Continue holding <kbd style={{ 
                background: '#252525', 
                padding: '1px 4px', 
                borderRadius: '3px', 
                fontSize: '9px',
                fontFamily: 'monospace',
                fontWeight: '600',
                color: '#64c864',
                border: '1px solid rgba(100, 200, 100, 0.3)'
              }}>Ctrl</kbd>/<kbd style={{ 
                background: '#252525', 
                padding: '1px 4px', 
                borderRadius: '3px', 
                fontSize: '9px',
                fontFamily: 'monospace',
                fontWeight: '600',
                color: '#64c864',
                border: '1px solid rgba(100, 200, 100, 0.3)'
              }}>Cmd</kbd> to select more
            </div>
          </div>
        )}
      </div>
      
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block', border: `1px solid rgba(100, 200, 100, 0.2)`, backgroundColor: '#1e1e1e', borderRadius: '12px' }} />
      
      {/* Left overlay: selection badges + node/edge info panels */}
      <div
        style={{
          position: 'absolute',
          left: '12px',
          top: `${overlayTop}px`, // avoid covering Show All toggle & multi-select hint
          width: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          zIndex: 1100,
          pointerEvents: 'none',
        }}
      >
        {/* Selection badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
          {selectedNodeIds.size > 1 && (
            <div style={{
              background: '#0b1f29',
              border: '1px solid rgba(34, 211, 238, 0.6)',
              color: '#22d3ee',
              padding: '8px 10px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>Multi-select: {selectedNodeIds.size} nodes</span>
              <button
                onClick={handleDeleteSelectedNodes}
                style={{
                  background: '#ef4444',
                  color: '#1e1e1e',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(239,68,68,0.4)'
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Node edit panel - render BEFORE info panel so it appears in same position */}
        {isEditingNode && editNodeData && (() => {
          const panelWidth = 360;
          const panelMaxHeight = 540;
        const container = svgRef.current?.parentElement;
        const containerHeight = container?.clientHeight || 700;
          const maxH = Math.min(panelMaxHeight, containerHeight - 40);
        return (
        <div style={{ 
              pointerEvents: 'auto',
              background: '#1e1e1e',
          border: `1px solid rgba(100, 200, 100, 0.3)`, 
              padding: '16px',
          borderRadius: '12px', 
          boxShadow: '0 3px 12px rgba(189, 180, 211, 0.25)', 
              width: `${panelWidth}px`,
              maxHeight: `${maxH}px`,
          overflowY: 'auto', 
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: '0', color: '#e8e8e8', fontSize: '16px', fontWeight: '600' }}>Edit Paper Info</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSaveNodeEdit} style={{ padding: '8px 16px', color: '#1e1e1e', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#64c864', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4ade80'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#64c864'; }}>Save</button>
              <button onClick={() => { setIsEditingNode(false); setEditNodeData(null); }} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#b8b8b8', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252525'; e.currentTarget.style.color = '#e8e8e8'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b8b8b8'; }}>Cancel</button>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>Title:</label>
            <input type="text" value={editNodeData.title} onChange={(e) => setEditNodeData({...editNodeData, title: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>author:</label>
            <input type="text" value={(editNodeData.authors || []).join(', ')} onChange={(e) => setEditNodeData({...editNodeData, authors: e.target.value.split(', ').filter(a => a.trim())})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>Year:</label>
            <input type="text" value={editNodeData.year || ''} onChange={(e) => setEditNodeData({...editNodeData, year: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>abstract:</label>
            <textarea value={editNodeData.abstract || ''} onChange={(e) => setEditNodeData({...editNodeData, abstract: e.target.value})} rows={4} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>venue:</label>
            <input type="text" value={editNodeData.venue || ''} onChange={(e) => setEditNodeData({...editNodeData, venue: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>citation:</label>
            <input type="number" value={editNodeData.citationCount || 0} onChange={(e) => setEditNodeData({...editNodeData, citationCount: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
          <div style={{ marginBottom: '0' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>tags:</label>
            <input type="text" value={(editNodeData.tags || []).join(', ')} onChange={(e) => setEditNodeData({...editNodeData, tags: e.target.value.split(', ').filter(t => t.trim())})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
        </div>
          );
        })()}

        {/* Node info panel */}
          {selectedNode && !isEditingNode && (() => {
            const panelWidth = 360;
            const panelMaxHeight = 540; // taller vertical space for node info
        const container = svgRef.current?.parentElement;
        const containerHeight = container?.clientHeight || 700;
          const maxH = Math.min(panelMaxHeight, containerHeight - 40);
        return (
        <div style={{ 
              pointerEvents: 'auto',
              background: '#1e1e1e',
              border: '1px solid rgba(100, 200, 100, 0.3)',
              padding: '16px',
          borderRadius: '12px', 
          boxShadow: '0 3px 12px rgba(189, 180, 211, 0.25)', 
              width: `${panelWidth}px`,
              maxHeight: `${maxH}px`,
          overflowY: 'auto',
          fontFamily: '"Lora", "Merriweather", "Georgia", serif',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <h3 style={{ margin: 0, color: '#e8e8e8', fontSize: '16px', fontWeight: '600', lineHeight: '1.4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                  {selectedNode.title}
                </h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => { setEditNodeData({...selectedNode, authors: selectedNode.authors || [], tags: selectedNode.tags || []}); setIsEditingNode(true); }}
                    style={{ padding: '6px 10px', color: '#1e1e1e', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', backgroundColor: '#64c864' }}
                  >Edit</button>
                  <button
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    style={{ padding: '6px 10px', backgroundColor: 'transparent', color: '#dc4444', border: '1px solid rgba(220, 68, 68, 0.5)', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                  >Delete</button>
                  <button
                    onClick={() => {
                      setSelectedNode(null);
                      setClickedNode(null);
                      // Also remove from selectedNodeIds to clear highlighting
                      const newSelectedIds = new Set(selectedNodeIds);
                      newSelectedIds.delete(selectedNode.id);
                      setSelectedNodeIds(newSelectedIds);
                    }}
                    style={{ padding: '6px 10px', backgroundColor: 'transparent', color: '#b8b8b8', border: '1px solid rgba(100, 200, 100, 0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                  >Close</button>
            </div>
          </div>
              <div style={{ marginTop: '12px', fontSize: '13px', lineHeight: '1.5', color: '#e8e8e8' }}>
                <p style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600', color: '#64c864' }}>author:</span> {selectedNode.authors?.join(', ') || 'no author info'}</p>
                <p style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600', color: '#64c864' }}>Year:</span> {selectedNode.year || 'Unspecified'}</p>
                <p style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600', color: '#64c864' }}>venue:</span> {selectedNode.venue || 'no venue info'}</p>
                <p style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600', color: '#64c864' }}>abstract:</span> {selectedNode.abstract || 'no abstract info'}</p>
                <p style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600', color: '#64c864' }}>citations:</span> {selectedNode.citationCount !== undefined ? selectedNode.citationCount.toLocaleString() : 'no citation info'}</p>
                <p style={{ marginBottom: '0' }}><span style={{ fontWeight: '600', color: '#64c864' }}>tags:</span> {selectedNode.tags?.join(', ') || 'no tags'}</p>
              </div>
        </div>
        );
      })()}

        {/* Edge edit panel - render BEFORE info panel so it appears in same position */}
        {isEditingEdge && editEdgeData && (() => {
          const panelWidth = 360;
          const panelMaxHeight = 420;
          const container = svgRef.current?.parentElement;
          const containerHeight = container?.clientHeight || 700;
          const maxH = Math.min(panelMaxHeight, containerHeight - 40);
          return (
            <div style={{
              pointerEvents: 'auto',
              background: '#1e1e1e',
              border: `1px solid rgba(192, 132, 252, 0.6)`,
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 3px 12px rgba(0, 0, 0, 0.35)',
              width: `${panelWidth}px`,
              maxHeight: `${maxH}px`,
              overflowY: 'auto',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: '0', color: '#e8e8e8', fontSize: '16px', fontWeight: '600' }}>Edit Connection</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSaveEdgeEdit} style={{ padding: '8px 16px', color: '#1e1e1e', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#64c864', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4ade80'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#64c864'; }}>Save</button>
              <button onClick={() => { setIsEditingEdge(false); setEditEdgeData(null); }} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#b8b8b8', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252525'; e.currentTarget.style.color = '#e8e8e8'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b8b8b8'; }}>Cancel</button>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>relation type:</label>
            <select value={editEdgeData.relationship} onChange={(e) => setEditEdgeData({...editEdgeData, relationship: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
              <option value="cites" style={{ backgroundColor: '#252525', color: '#e8e8e8' }}>引用 (cites)</option>
              <option value="builds on" style={{ backgroundColor: '#252525', color: '#e8e8e8' }}>建構於 (builds on)</option>
              <option value="extends" style={{ backgroundColor: '#252525', color: '#e8e8e8' }}>擴展 (extends)</option>
              <option value="compares" style={{ backgroundColor: '#252525', color: '#e8e8e8' }}>比較 (compares)</option>
              <option value="contradicts" style={{ backgroundColor: '#252525', color: '#e8e8e8' }}>反駁 (contradicts)</option>
              <option value="related" style={{ backgroundColor: '#252525', color: '#e8e8e8' }}>相關 (related)</option>
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>description:</label>
            <textarea value={editEdgeData.description} onChange={(e) => setEditEdgeData({...editEdgeData, description: e.target.value})} rows={3} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>original context:</label>
            <textarea value={editEdgeData.evidence} onChange={(e) => setEditEdgeData({...editEdgeData, evidence: e.target.value})} rows={2} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '0' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>strength (0-1):</label>
            <input type="number" min="0" max="1" step="0.1" value={editEdgeData.strength} onChange={(e) => setEditEdgeData({...editEdgeData, strength: parseFloat(e.target.value) || 0})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
        </div>
          );
        })()}

        {/* Edge info panel */}
        {selectedEdge && !isEditingEdge && (() => {
          const panelWidth = 360;
          const panelMaxHeight = 420; // taller vertical space for edge info
          const container = svgRef.current?.parentElement;
          const containerHeight = container?.clientHeight || 700;
          const maxH = Math.min(panelMaxHeight, containerHeight - 40);
          return (
            <div style={{
              pointerEvents: 'auto',
              background: '#1e1e1e',
              border: '1px solid rgba(192, 132, 252, 0.6)',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 3px 12px rgba(0, 0, 0, 0.35)',
              width: `${panelWidth}px`,
              maxHeight: `${maxH}px`,
              overflowY: 'auto',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#e8e8e8', fontSize: '15px', fontWeight: '600', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>relation info</h4>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => { setEditEdgeData({ ...selectedEdge, source: (selectedEdge.source as Node).id, target: (selectedEdge.target as Node).id }); setIsEditingEdge(true); }}
                    style={{ padding: '6px 10px', color: '#1e1e1e', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', backgroundColor: '#64c864' }}
                  >Edit</button>
                  <button
                    onClick={() => {
                      setSelectedEdge(null);
                      setClickedEdge(null);
                    }}
                    style={{ padding: '6px 10px', backgroundColor: 'transparent', color: '#b8b8b8', border: '1px solid rgba(192, 132, 252, 0.6)', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                  >Close</button>
                </div>
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#e8e8e8' }}>
                <p style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600', color: '#d8b4fe' }}>relation:</span> {selectedEdge.relationship}</p>
                <p style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600', color: '#d8b4fe' }}>description:</span> {selectedEdge.description}</p>
                <p style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600', color: '#d8b4fe' }}>original context:</span> {selectedEdge.evidence}</p>
                <p style={{ marginBottom: '0' }}><span style={{ fontWeight: '600', color: '#d8b4fe' }}>strength:</span> {selectedEdge.strength}</p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default GraphVisualization;