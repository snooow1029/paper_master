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

  // Helper function to check if a node is a source paper
  const isSourceNode = (nodeId: string): boolean => {
    return data.originalPapers?.includes(nodeId) || false;
  };
  
  // Helper function to check if a node has edges
  const hasEdges = React.useCallback((nodeId: string): boolean => {
    return data.edges.some(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as Node).id;
      const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as Node).id;
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
        const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as Node).id;
        const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as Node).id;
        return !selectedNodeIds.has(sourceId) && !selectedNodeIds.has(targetId);
      })
    };
    setData(newData);
    setSelectedNodeIds(new Set());
    setSelectedNode(null);
    setClickedNode(null);
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
    setSelectedNode(null);
    setClickedNode(null);
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
      const sourceId = typeof e.source === 'string' ? e.source : e.source.id;
      const targetId = typeof e.target === 'string' ? e.target : e.target.id;
      return sourceId === editNodeData.id || targetId === editNodeData.id;
    });
    console.log('🔗 Connected edges BEFORE edit:', connectedEdgesBefore);
    
    // Create new nodes array with updated node
    const newNodes = data.nodes.map(node => 
      node.id === editNodeData.id ? editNodeData : node
    );
    
    // 🔧 FIX: Update edges to reference the new node objects
    const newEdges = data.edges.map(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
      
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
      const sourceId = typeof e.source === 'string' ? e.source : e.source.id;
      const targetId = typeof e.target === 'string' ? e.target : e.target.id;
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
        const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as Node).id;
        const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as Node).id;
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
            const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as Node).id;
            const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as Node).id;
            return sourceId === node.id || targetId === node.id;
          });
        });
    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = data.edges.filter(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as Node).id;
      const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as Node).id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
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
    
    // Update links styling
    linksUpdate
      .attr('stroke', 'rgba(100, 200, 100, 0.5)')
      .attr('stroke-width', (d: any) => Math.sqrt(d.strength * 8) + 1)
      .attr('opacity', 0.6)
      .style('cursor', 'pointer');
    
    // Update nodes styling
    nodesUpdate
      .attr('r', 26)
      .attr('fill', (d: Node) => isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
      .attr('stroke', (d: Node) => {
        return selectedNodeIds.has(d.id) ? '#64c864' : 'rgba(100, 200, 100, 0.4)';
      })
      .attr('stroke-width', (d: Node) => {
        return selectedNodeIds.has(d.id) ? 3 : 2;
      })
      .attr('filter', 'url(#dropShadow)')
      .style('cursor', 'pointer');

    svg.on('click', function(event) {
      if (event.target === this || (event.target as SVGElement).tagName === 'svg') {
        // Don't clear states if we're in editing mode
        if (isEditingNode || isEditingEdge) {
          return;
        }
        
        // Reset all visual states
        linksUpdate.attr('stroke', 'rgba(100, 200, 100, 0.5)').attr('opacity', 0.6).attr('stroke-width', (d: any) => Math.sqrt(d.strength * 8) + 1);
        nodesUpdate
          .attr('r', 26)
          .attr('fill', (d: Node) => isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
          .attr('stroke', (d: Node) => {
            return selectedNodeIds.has(d.id) ? '#9F7AEA' : '#F5F5DC';
          })
          .attr('stroke-width', (d: Node) => {
            return selectedNodeIds.has(d.id) ? 3 : 2;
          });
        
        // Clear all states
        setSelectedNode(null);
        setSelectedEdge(null);
        setClickedNode(null);
        setClickedEdge(null);
        setHoveredNode(null);
        setHoveredEdge(null);
        setSelectedNodeIds(new Set());
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
        
        // Apply clicked edge styling
        linksUpdate
          .attr('stroke', (linkData: any) => (linkData === d) ? 'url(#edgeGradient)' : '#EAE8E1')
          .attr('opacity', (linkData: any) => (linkData === d) ? 1 : 0.3)
          .attr('stroke-width', (linkData: any) => (linkData === d) ? Math.sqrt(linkData.strength * 12) + 6 : Math.sqrt(linkData.strength * 12) + 3);
        
        nodesUpdate
          .attr('r', (nodeData: any) => {
            const sourceId = (d.source as Node).id || d.source;
            const targetId = (d.target as Node).id || d.target;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? 28 : 25;
          })
          .attr('fill', (nodeData: any) => isSourceNode(nodeData.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
          .style('stroke', (nodeData: any) => {
            const sourceId = (d.source as Node).id || d.source;
            const targetId = (d.target as Node).id || d.target;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? '#64c864' : 'rgba(100, 200, 100, 0.4)';
          })
          .style('stroke-width', (nodeData: any) => {
            const sourceId = (d.source as Node).id || d.source;
            const targetId = (d.target as Node).id || d.target;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? 4 : 2;
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
          d3.select(this)
            .attr('stroke', 'rgba(100, 200, 100, 0.5)')
            .attr('opacity', 0.6)
            .attr('stroke-width', Math.sqrt(d.strength * 8) + 1);
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
          
          // Clicked the same node again: toggle off selection
          setClickedNode(null);
          setSelectedNode(null);
          setSelectedNodeIds(new Set());
          // Restore all nodes and links to initial state
          linksUpdate
            .attr('stroke', 'rgba(100, 200, 100, 0.5)')
            .attr('opacity', 0.6)
            .attr('stroke-width', (linkData: any) => Math.sqrt(linkData.strength * 8) + 1);
          
          nodesUpdate
            .attr('r', 26)
            .attr('fill', (d: Node) => isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
            .attr('stroke', (nodeData: any) => {
              return selectedNodeIds.has(nodeData.id) ? '#9F7AEA' : '#F5F5DC';
            })
            .attr('stroke-width', (nodeData: any) => {
              return selectedNodeIds.has(nodeData.id) ? 3 : 2;
            });
        } else {
          // Clicked a new node: set as current clicked node
          setClickedNode(d);
          setSelectedNode(d);
          setSelectedNodeIds(new Set([d.id]));
          setClickedEdge(null); // Clear clicked edge state
          
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
              return (sourceId === d.id || targetId === d.id) ? 'url(#edgeGradient)' : '#D2CBBF';
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
              if (nodeData.id === d.id) return '#c3a4ffff';
              return selectedNodeIds.has(nodeData.id) ? '#9F7AEA' : '#F5F5DC';
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
        if (d.year.includes('-')) {
          const parts = d.year.split('-');
          return parts[0].slice(-2) + parts[1];
        }
        return `'${d.year.slice(-2)}`;
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
  }, [data, dataVersion, onDataUpdate, isEditingNode, isEditingEdge, showIsolatedNodes, selectedNodeIds, hasEdges]);

  // Separate useEffect to maintain highlighting during editing
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    const links = svg.selectAll('.link');
    const nodes = svg.selectAll('.node');
    
    // Maintain node highlighting during editing
    if (isEditingNode && selectedNode) {
      links
        .attr('stroke', (linkData: any) => ((linkData.source as Node).id === selectedNode.id || (linkData.target as Node).id === selectedNode.id) ? 'url(#edgeGradient)' : '#D2CBBF')
        .attr('opacity', (linkData: any) => ((linkData.source as Node).id === selectedNode.id || (linkData.target as Node).id === selectedNode.id) ? 0.9 : 0.3)
        .attr('stroke-width', (linkData: any) => ((linkData.source as Node).id === selectedNode.id || (linkData.target as Node).id === selectedNode.id) ? Math.sqrt(linkData.strength * 8) + 3 : Math.sqrt(linkData.strength * 8) + 1);
      
      nodes
        .attr('r', (nodeData: any) => nodeData.id === selectedNode.id ? 32 : 26)
        .attr('fill', (nodeData: any) => {
          if (nodeData.id === selectedNode.id) {
            return isSourceNode(nodeData.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
          }
          return isSourceNode(nodeData.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)';
        })
        .style('stroke', (nodeData: any) => nodeData.id === selectedNode.id ? '#64c864' : 'rgba(100, 200, 100, 0.4)')
        .style('stroke-width', (nodeData: any) => nodeData.id === selectedNode.id ? 3 : 2);
    }
    
    // Maintain edge highlighting during editing
    if (isEditingEdge && selectedEdge) {
      links
        .attr('stroke', (linkData: any) => (linkData === selectedEdge) ? 'url(#edgeGradient)' : 'rgba(100, 200, 100, 0.3)')
        .attr('opacity', (linkData: any) => (linkData === selectedEdge) ? 1 : 0.3)
        .attr('stroke-width', (linkData: any) => (linkData === selectedEdge) ? Math.sqrt(linkData.strength * 12) + 6 : Math.sqrt(linkData.strength * 12) + 3);
      
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
          return (nodeData.id === sourceId || nodeData.id === targetId) ? '#64c864' : 'rgba(100, 200, 100, 0.4)';
        })
        .style('stroke-width', (nodeData: any) => {
          const sourceId = (selectedEdge.source as Node).id || selectedEdge.source;
          const targetId = (selectedEdge.target as Node).id || selectedEdge.target;
          return (nodeData.id === sourceId || nodeData.id === targetId) ? 4 : 2;
        });
    }
  }, [isEditingNode, isEditingEdge, selectedNode, selectedEdge, data]);

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
      
      {selectedNode && !isEditingNode && (() => {
        // Calculate position to keep panel within bounds
        const panelWidth = 500;
        const panelMaxHeight = 280;
        const padding = 16;
        const container = svgRef.current?.parentElement;
        const containerWidth = container?.clientWidth || 1000;
        const containerHeight = container?.clientHeight || 700;
        
        // Default position: top-right
        let top = 24;
        let right = padding;
        
        // Adjust if panel would overflow
        if (panelWidth + padding * 2 > containerWidth) {
          right = padding;
        }
        
        if (panelMaxHeight + top + padding > containerHeight) {
          top = Math.max(padding, containerHeight - panelMaxHeight - padding);
        }
        
        return (
        <div style={{ 
          position: 'absolute', 
          top: `${top}px`, 
          right: `${right}px`, 
          background: '#2d2d2d', 
          border: `1px solid rgba(100, 200, 100, 0.3)`, 
          padding: '20px', 
          borderRadius: '12px', 
          boxShadow: '0 3px 12px rgba(189, 180, 211, 0.25)', 
          width: `${Math.min(panelWidth, containerWidth - padding * 2)}px`, 
          maxHeight: `${Math.min(panelMaxHeight, containerHeight - top - padding)}px`, 
          overflowY: 'auto', 
          fontFamily: '"Lora", "Merriweather", "Georgia", serif',
          zIndex: 1001
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#e8e8e8', fontSize: '16px', fontWeight: '600', lineHeight: '1.4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>{selectedNode.title}</h3>
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => { setEditNodeData({...selectedNode}); setIsEditingNode(true); }} style={{ padding: '8px 16px', color: '#1e1e1e', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#64c864', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4ade80'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#64c864'; }}>Edit</button>
            <button onClick={() => handleDeleteNode(selectedNode.id)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#b8b8b8', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252525'; e.currentTarget.style.color = '#dc4444'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b8b8b8'; }}>Delete</button>
            <button onClick={() => setSelectedNode(null)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#b8b8b8', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252525'; e.currentTarget.style.color = '#e8e8e8'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b8b8b8'; }}>close</button>
          </div>
          <div style={{ marginTop: '16px', fontSize: '13px', lineHeight: '1.5' }}>
            <p style={{ marginBottom: '8px', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>author:</span> {selectedNode.authors?.join(', ') || 'no author info'}</p>
            <p style={{ marginBottom: '8px', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>Year:</span> {selectedNode.year || 'Unspecified'}</p>
            <p style={{ marginBottom: '8px', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>venue:</span> {selectedNode.venue || 'no venue info'}</p>
            <p style={{ marginBottom: '8px', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>abstract:</span> {selectedNode.abstract || 'no abstract info'}</p>
            <p style={{ marginBottom: '8px', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>citations:</span> {selectedNode.citationCount !== undefined ? selectedNode.citationCount.toLocaleString() : 'no citation info'}</p>
            <p style={{ marginBottom: '0', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>tags(didn't work currently):</span> {selectedNode.tags?.join(', ') || 'no tags'}</p>
          </div>
        </div>
        );
      })()}

      {isEditingNode && editNodeData && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#2d2d2d', border: `1px solid rgba(100, 200, 100, 0.3)`, padding: '20px', borderRadius: '12px', boxShadow: '0 3px 12px rgba(0, 0, 0, 0.4)', width: '340px', maxHeight: '500px', overflowY: 'auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: '0', color: '#e8e8e8', fontSize: '16px', fontWeight: '600' }}>edit paper info</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSaveNodeEdit} style={{ padding: '8px 16px', color: '#1e1e1e', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#64c864', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4ade80'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#64c864'; }}>儲存</button>
              <button onClick={() => { setIsEditingNode(false); setEditNodeData(null); }} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#b8b8b8', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252525'; e.currentTarget.style.color = '#e8e8e8'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b8b8b8'; }}>取消</button>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>Title:</label>
            <input type="text" value={editNodeData.title} onChange={(e) => setEditNodeData({...editNodeData, title: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>author:</label>
            <input type="text" value={editNodeData.authors.join(', ')} onChange={(e) => setEditNodeData({...editNodeData, authors: e.target.value.split(', ').filter(a => a.trim())})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
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
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>citation(didn't work currently):</label>
            <input type="number" value={editNodeData.citationCount || 0} onChange={(e) => setEditNodeData({...editNodeData, citationCount: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
          <div style={{ marginBottom: '0' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#64c864', fontSize: '13px' }}>tags(didn't work currently):</label>
            <input type="text" value={editNodeData.tags.join(', ')} onChange={(e) => setEditNodeData({...editNodeData, tags: e.target.value.split(', ').filter(t => t.trim())})} style={{ width: '100%', padding: '8px 12px', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', backgroundColor: '#252525', color: '#e8e8e8', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }} />
          </div>
        </div>
      )}

      {selectedEdge && !isEditingEdge && (() => {
        // Calculate position to keep panel within bounds
        const panelWidth = 500;
        const panelMaxHeight = 400;
        const padding = 16;
        const container = svgRef.current?.parentElement;
        const containerWidth = container?.clientWidth || 1000;
        const containerHeight = container?.clientHeight || 700;
        
        // Position below node panel or at top if no node panel
        let top = selectedNode ? 320 : 24;
        let right = padding;
        
        // Adjust if panel would overflow
        if (panelWidth + padding * 2 > containerWidth) {
          right = padding;
        }
        
        if (top + panelMaxHeight + padding > containerHeight) {
          top = Math.max(padding, containerHeight - panelMaxHeight - padding);
        }
        
        return (
        <div style={{ 
          position: 'absolute', 
          top: `${top}px`, 
          right: `${right}px`, 
          background: '#2d2d2d', 
          border: `1px solid rgba(100, 200, 100, 0.3)`, 
          padding: '20px', 
          borderRadius: '12px', 
          boxShadow: '0 3px 12px rgba(189, 180, 211, 0.25)', 
          maxHeight: `${Math.min(panelMaxHeight, containerHeight - top - padding)}px`, 
          width: `${Math.min(panelWidth, containerWidth - padding * 2)}px`, 
          overflowY: 'auto',
          fontFamily: '"Lora", "Merriweather", "Georgia", serif',
          zIndex: 1001
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#e8e8e8', fontSize: '16px', fontWeight: '600', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>relation info</h4>
          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
            <p style={{ marginBottom: '8px', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>relation:</span> {selectedEdge.relationship}</p>
            <p style={{ marginBottom: '8px', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>description:</span> {selectedEdge.description}</p>
            <p style={{ marginBottom: '8px', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>original context:</span> {selectedEdge.evidence}</p>
            <p style={{ marginBottom: '16px', color: '#e8e8e8' }}><span style={{ fontWeight: '600', color: '#64c864' }}>strength:</span> {selectedEdge.strength}</p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setEditEdgeData({ ...selectedEdge, source: (selectedEdge.source as Node).id, target: (selectedEdge.target as Node).id }); setIsEditingEdge(true); }} style={{ padding: '8px 16px', color: '#1e1e1e', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#64c864', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4ade80'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#64c864'; }}>Edit</button>
              <button onClick={() => setSelectedEdge(null)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#b8b8b8', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252525'; e.currentTarget.style.color = '#e8e8e8'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b8b8b8'; }}>Close</button>
            </div>
          </div>
        </div>
        );
      })()}

      {isEditingEdge && editEdgeData && (
        <div style={{ position: 'absolute', top: '320px', right: '16px', background: '#2d2d2d', border: `1px solid rgba(100, 200, 100, 0.3)`, padding: '20px', borderRadius: '12px', maxHeight: '400px', boxShadow: '0 3px 12px rgba(0, 0, 0, 0.4)', width: '340px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: '0', color: '#e8e8e8', fontSize: '16px', fontWeight: '600' }}>Edit Connection</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSaveEdgeEdit} style={{ padding: '8px 16px', color: '#1e1e1e', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#64c864', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4ade80'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#64c864'; }}>儲存</button>
              <button onClick={() => { setIsEditingEdge(false); setEditEdgeData(null); }} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#b8b8b8', border: `1px solid rgba(100, 200, 100, 0.3)`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252525'; e.currentTarget.style.color = '#e8e8e8'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b8b8b8'; }}>取消</button>
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
      )}
    </div>
  );
};

export default GraphVisualization;