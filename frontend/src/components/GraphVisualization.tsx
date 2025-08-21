import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Node, Edge, GraphData } from '../types/graph';

interface GraphVisualizationProps {
  data?: GraphData;
  onDataUpdate?: (data: GraphData) => void;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ 
  data: initialData, 
  onDataUpdate 
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

  // Helper function to check if a node is a source paper
  const isSourceNode = (nodeId: string): boolean => {
    return data.originalPapers?.includes(nodeId) || false;
  };

  // Debug: consume hover state to prevent TS warnings
  useEffect(() => {
    if (hoveredNode || hoveredEdge) {
      // These states are used for visual feedback but no additional logic needed here
    }
  }, [hoveredNode, hoveredEdge]);

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

    const width = 1000;
    const height = 700;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    svg.attr('width', width).attr('height', height);
    
    const defs = svg.append('defs');
    
  // Update node gradient to semi-transparent lavender purple
    const nodeGradient = defs.append('radialGradient').attr('id', 'nodeGradient').attr('cx', '35%').attr('cy', '35%');
    nodeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#BDB4D3').attr('stop-opacity', 0.8);
    nodeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#BDB4D3').attr('stop-opacity', 0.6);
    
  // Source node gradient - distinct orange/gold for input papers
    const sourceNodeGradient = defs.append('radialGradient').attr('id', 'sourceNodeGradient').attr('cx', '35%').attr('cy', '35%');
    sourceNodeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#F59E0B').attr('stop-opacity', 0.9);
    sourceNodeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#D97706').attr('stop-opacity', 0.7);
    
  // Dark lavender purple gradient for mouse hover
    const nodeHoverGradient = defs.append('radialGradient').attr('id', 'nodeHoverGradient').attr('cx', '35%').attr('cy', '35%');
    nodeHoverGradient.append('stop').attr('offset', '0%').attr('stop-color', '#9F7AEA').attr('stop-opacity', 0.9);
    nodeHoverGradient.append('stop').attr('offset', '100%').attr('stop-color', '#7C5CE0').attr('stop-opacity', 0.8);
    
  // Source node hover gradient - brighter orange
    const sourceNodeHoverGradient = defs.append('radialGradient').attr('id', 'sourceNodeHoverGradient').attr('cx', '35%').attr('cy', '35%');
    sourceNodeHoverGradient.append('stop').attr('offset', '0%').attr('stop-color', '#FBBF24').attr('stop-opacity', 1.0);
    sourceNodeHoverGradient.append('stop').attr('offset', '100%').attr('stop-color', '#F59E0B').attr('stop-opacity', 0.9);
    
    const dropShadow = defs.append('filter').attr('id', 'dropShadow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    dropShadow.append('feDropShadow').attr('dx', 1).attr('dy', 2).attr('stdDeviation', 2).attr('flood-color', '#5D4037').attr('flood-opacity', 0.2);

    const edgeGradient = defs.append('linearGradient').attr('id', 'edgeGradient');
    edgeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#B89B74').attr('stop-opacity', 0.8);
    edgeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#D2CBBF').attr('stop-opacity', 0.6);

    // ✅ **FIX 1: Added a newline here.**
    const g = svg.append('g');

    const links = g.selectAll('.link').data(data.edges).enter().append('line').attr('class', 'link');
    const nodes = g.selectAll('.node').data(data.nodes).enter().append('circle').attr('class', 'node');

    svg.on('click', function(event) {
      if (event.target === this || (event.target as SVGElement).tagName === 'svg') {
        // Don't clear states if we're in editing mode
        if (isEditingNode || isEditingEdge) {
          return;
        }
        
        // Reset all visual states
        links.attr('stroke', '#D2CBBF').attr('opacity', 0.6).attr('stroke-width', (d: any) => Math.sqrt(d.strength * 8) + 1);
        nodes
          .attr('r', 26)
          .attr('fill', (d: Node) => isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
          .style('stroke', '#F5F5DC')
          .style('stroke-width', 2);
        
        // Clear all states
        setSelectedNode(null);
        setSelectedEdge(null);
        setClickedNode(null);
        setClickedEdge(null);
        setHoveredNode(null);
        setHoveredEdge(null);
      }
    });
  
    const simulation = d3.forceSimulation<Node>(data.nodes)
      .force('link', d3.forceLink<Node, Edge>(data.edges).id(d => d.id).distance(120).strength(0.1))
      .force('charge', d3.forceManyBody().strength(-200).theta(0.9))
      .force('center', d3.forceCenter(width * 0.4, height / 2)) // 偏左顯示，從 width/2 改為 width*0.4
      .force('collision', d3.forceCollide().radius(35))
      .force('boundary', () => {
        const nodeRadius = 25;
        const minX = margin.left + nodeRadius;
        const maxX = width - margin.right - nodeRadius;
        const minY = margin.top + nodeRadius;
        const maxY = height - margin.bottom - nodeRadius;
        data.nodes.forEach(d => {
          if (d.x !== undefined) d.x = Math.max(minX, Math.min(maxX, d.x));
          if (d.y !== undefined) d.y = Math.max(minY, Math.min(maxY, d.y));
        });
      })
      .alphaDecay(0.02)
      .velocityDecay(0.3);

    links
      .attr('stroke', '#D2CBBF')
      .attr('stroke-width', (d) => Math.sqrt(d.strength * 8) + 1)
      .attr('opacity', 0.6)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
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
        links
          .attr('stroke', (linkData: any) => (linkData === d) ? 'url(#edgeGradient)' : '#EAE8E1')
          .attr('opacity', (linkData: any) => (linkData === d) ? 1 : 0.3)
          .attr('stroke-width', (linkData: any) => (linkData === d) ? Math.sqrt(linkData.strength * 12) + 6 : Math.sqrt(linkData.strength * 12) + 3);
        
        nodes
          .attr('r', (nodeData: any) => {
            const sourceId = (d.source as Node).id || d.source;
            const targetId = (d.target as Node).id || d.target;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? 28 : 25;
          })
          .attr('fill', (nodeData: any) => isSourceNode(nodeData.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
          .style('stroke', (nodeData: any) => {
            const sourceId = (d.source as Node).id || d.source;
            const targetId = (d.target as Node).id || d.target;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? '#f7f5f8ff' : '#fff0acff';
          })
          .style('stroke-width', (nodeData: any) => {
            const sourceId = (d.source as Node).id || d.source;
            const targetId = (d.target as Node).id || d.target;
            return (nodeData.id === sourceId || nodeData.id === targetId) ? 4 : 2;
          });
      })
      .on('mouseenter', function(_event, d) {
        // Only apply hover if this edge is not clicked
        if (!clickedEdge || clickedEdge !== d) {
          setHoveredEdge(d);
          d3.select(this)
            .attr('stroke', '#B89B74')
            .attr('opacity', 0.8)
            .attr('stroke-width', Math.sqrt(d.strength * 10) + 2);
        }
      })
      .on('mouseleave', function(_event, d) {
        // Only restore if this edge is not clicked
        if (!clickedEdge || clickedEdge !== d) {
          setHoveredEdge(null);
          d3.select(this)
            .attr('stroke', '#D2CBBF')
            .attr('opacity', 0.6)
            .attr('stroke-width', Math.sqrt(d.strength * 8) + 1);
        }
      });

    nodes
      .attr('r', 26)
      .attr('fill', (d: Node) => isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
      .attr('stroke', '#F5F5DC')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#dropShadow)')
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        // Check if the same node was clicked
        if (clickedNode && clickedNode.id === d.id) {
          // If node is in editing mode, don't toggle off
          if (isEditingNode) {
            return;
          }
          
          // Clicked the same node again: toggle off selection
          setClickedNode(null);
          setSelectedNode(null);
          // Restore all nodes and links to initial state
          links
            .attr('stroke', '#D2CBBF')
            .attr('opacity', 0.6)
            .attr('stroke-width', (linkData: any) => Math.sqrt(linkData.strength * 8) + 1);
          
          nodes
            .attr('r', 26)
            .attr('fill', (d: Node) => isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
            .style('stroke', '#F5F5DC')
            .style('stroke-width', 2);
        } else {
          // Clicked a new node: set as current clicked node
          setClickedNode(d);
          setSelectedNode(d);
          setClickedEdge(null); // Clear clicked edge state
          
          // Exit any existing editing mode when clicking a different node
          setIsEditingNode(false);
          setIsEditingEdge(false);
          setEditNodeData(null);
          setEditEdgeData(null);
          
          // Apply clicked node styling
          links
            .attr('stroke', (linkData: any) => ((linkData.source as Node).id === d.id || (linkData.target as Node).id === d.id) ? 'url(#edgeGradient)' : '#D2CBBF')
            .attr('opacity', (linkData: any) => ((linkData.source as Node).id === d.id || (linkData.target as Node).id === d.id) ? 0.9 : 0.3)
            .attr('stroke-width', (linkData: any) => ((linkData.source as Node).id === d.id || (linkData.target as Node).id === d.id) ? Math.sqrt(linkData.strength * 8) + 3 : Math.sqrt(linkData.strength * 8) + 1);
          
          nodes
            .attr('r', (nodeData: any) => nodeData.id === d.id ? 32 : 26)
            .attr('fill', (nodeData: any) => {
              if (nodeData.id === d.id) {
                return isSourceNode(nodeData.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)';
              }
              return isSourceNode(nodeData.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)';
            })
            .style('stroke', (nodeData: any) => nodeData.id === d.id ? '#c3a4ffff' : '#F5F5DC')
            .style('stroke-width', (nodeData: any) => nodeData.id === d.id ? 3 : 2);
        }
      })
      // Mouse event handlers
      .on('mouseenter', function(_event, d) {
        // Only show hover effect if the node is not clicked
        if (!clickedNode || clickedNode.id !== d.id) {
          setHoveredNode(d);
          
          // Apply hover styling for links
          links
            .attr('stroke', (linkData: any) => ((linkData.source as Node).id === d.id || (linkData.target as Node).id === d.id) ? '#B89B74' : '#D2CBBF')
            .attr('opacity', (linkData: any) => ((linkData.source as Node).id === d.id || (linkData.target as Node).id === d.id) ? 0.9 : 0.4)
            .attr('stroke-width', (linkData: any) => ((linkData.source as Node).id === d.id || (linkData.target as Node).id === d.id) ? Math.sqrt(linkData.strength * 8) + 2 : Math.sqrt(linkData.strength * 8) + 1);
          
          // Apply hover styling for this node
          d3.select(this)
            .attr('r', 28)
            .attr('fill', isSourceNode(d.id) ? 'url(#sourceNodeHoverGradient)' : 'url(#nodeHoverGradient)')
            .style('stroke', '#c3a4ffff')
            .style('stroke-width', 3);
        }
      })
      .on('mouseleave', function(_event, d) {
        // Only restore if this node is not clicked
        if (!clickedNode || clickedNode.id !== d.id) {
          setHoveredNode(null);
          
          // Restore links if no node or edge is selected
          if (!selectedNode && !selectedEdge) {
            links
              .attr('stroke', '#D2CBBF')
              .attr('opacity', 0.6)
              .attr('stroke-width', (linkData: any) => Math.sqrt(linkData.strength * 8) + 1);
          }
          
          // Restore this node
          d3.select(this)
            .attr('r', 26)
            .attr('fill', isSourceNode(d.id) ? 'url(#sourceNodeGradient)' : 'url(#nodeGradient)')
            .style('stroke', '#F5F5DC')
            .style('stroke-width', 2);
        }
      })
      .on('dblclick', (_event, d) => {
        d.fx = undefined;
        d.fy = undefined;
        d.vx = 0;
        d.vy = 0;
        simulation.alpha(0.03).restart();
      });

    const titleLabels = g.selectAll('.title-label').data(data.nodes).enter().append('text')
      .attr('class', 'title-label')
      .attr('dx', 32)
      .attr('dy', -6)
      .style('font-size', '12px')
      .style('font-family', '"Lora", "Merriweather", "Georgia", serif')
      .style('font-weight', '400')
      .style('fill', '#5D4037')
      .style('cursor', 'pointer')
      .text((d) => d.title.length > 28 ? d.title.substring(0, 28) + '…' : d.title)
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
          .style('border', `2px solid #BDB4D3`)
          .style('border-radius', '6px')
          .style('padding', '3px 6px')
          .style('background-color', '#F5F5DC')
          .style('color', '#5D4037');
        
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

    const yearLabels = g.selectAll('.year-label').data(data.nodes).enter().append('text')
      .attr('class', 'year-label')
      .attr('dx', 32)
      .attr('dy', 14)
      .style('font-size', '10px')
      .style('font-family', '"Inter", "Lato", "Segoe UI", "Roboto", sans-serif')
      .style('font-weight', '400')
      .style('fill', '#B89B74')
      .style('opacity', '0.75')
      .style('cursor', 'pointer')
      .text((d) => {
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
        const minX = margin.left + nodeRadius;
        const maxX = width - margin.right - nodeRadius;
        const minY = margin.top + nodeRadius;
        const maxY = height - margin.bottom - nodeRadius;
        d.fx = Math.max(minX, Math.min(maxX, event.x));
        d.fy = Math.max(minY, Math.min(maxY, event.y));
      })
      .on('end', (event, _d) => {
        if (!event.active) simulation.alphaTarget(0);
      });
    nodes.call(drag);

    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes.attr('cx', (d: any) => d.x!).attr('cy', (d: any) => d.y!);
      titleLabels.attr('x', (d: any) => d.x!).attr('y', (d: any) => d.y!);
      yearLabels.attr('x', (d: any) => d.x!).attr('y', (d: any) => d.y!);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dataVersion, onDataUpdate, isEditingNode, isEditingEdge]);

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
        .style('stroke', (nodeData: any) => nodeData.id === selectedNode.id ? '#c3a4ffff' : '#F5F5DC')
        .style('stroke-width', (nodeData: any) => nodeData.id === selectedNode.id ? 3 : 2);
    }
    
    // Maintain edge highlighting during editing
    if (isEditingEdge && selectedEdge) {
      links
        .attr('stroke', (linkData: any) => (linkData === selectedEdge) ? 'url(#edgeGradient)' : '#EAE8E1')
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
          return (nodeData.id === sourceId || nodeData.id === targetId) ? '#f7f5f8ff' : '#fff0acff';
        })
        .style('stroke-width', (nodeData: any) => {
          const sourceId = (selectedEdge.source as Node).id || selectedEdge.source;
          const targetId = (selectedEdge.target as Node).id || selectedEdge.target;
          return (nodeData.id === sourceId || nodeData.id === targetId) ? 4 : 2;
        });
    }
  }, [isEditingNode, isEditingEdge, selectedNode, selectedEdge, data]);

  return (
    <div style={{ width: '100%', height: '700px', position: 'relative', backgroundColor: '#F5F5DC', borderRadius: '12px', overflow: 'hidden' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', border: `1px solid #D2CBBF`, backgroundColor: '#F5F5DC', borderRadius: '12px' }} />
      
      {selectedNode && !isEditingNode && (
        <div style={{ position: 'absolute', top: '24px', right: '16px', background: '#F5F5DC', border: `2px solid #BDB4D3`, padding: '20px', borderRadius: '12px', boxShadow: '0 3px 12px rgba(189, 180, 211, 0.25)', width: '500px', maxHeight: '280px', overflowY: 'auto', fontFamily: '"Lora", "Merriweather", "Georgia", serif' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#5D4037', fontSize: '16px', fontWeight: '600', lineHeight: '1.4' }}>{selectedNode.title}</h3>
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => { setEditNodeData({...selectedNode}); setIsEditingNode(true); }} className="bg-[#BDB4D3] hover:brightness-105 transition-all duration-200" style={{ padding: '8px 16px', color: '#F5F5DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '"Inter", "Lato", sans-serif', backgroundColor: '#BDB4D3' }}>Edit</button>
            <button onClick={() => handleDeleteNode(selectedNode.id)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#707C5D', border: `1px solid #A39A86`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '"Inter", "Lato", sans-serif', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#D2CBBF'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Delete</button>
            <button onClick={() => setSelectedNode(null)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#707C5D', border: `1px solid #A39A86`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: '"Inter", "Lato", sans-serif', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#D2CBBF'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>close</button>
          </div>
          <div style={{ marginTop: '16px', fontSize: '13px', lineHeight: '1.5' }}>
            <p style={{ marginBottom: '8px', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>author:</span> {selectedNode.authors?.join(', ') || 'no author info'}</p>
            <p style={{ marginBottom: '8px', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>Year:</span> {selectedNode.year || 'Unspecified'}</p>
            <p style={{ marginBottom: '8px', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>venue:</span> {selectedNode.venue || 'no venue info'}</p>
            <p style={{ marginBottom: '8px', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>abstract:</span> {selectedNode.abstract || 'no abstract info'}</p>
            <p style={{ marginBottom: '8px', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>citations:</span> {selectedNode.citationCount !== undefined ? selectedNode.citationCount.toLocaleString() : 'no citation info'}</p>
            <p style={{ marginBottom: '0', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>tags(didn't work currently):</span> {selectedNode.tags?.join(', ') || 'no tags'}</p>
          </div>
        </div>
      )}

      {isEditingNode && editNodeData && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#F5F5DC', border: `2px solid #BDB4D3`, padding: '20px', borderRadius: '12px', boxShadow: '0 3px 12px rgba(189, 180, 211, 0.25)', width: '340px', maxHeight: '500px', overflowY: 'auto', fontFamily: '"Lora", "Merriweather", "Georgia", serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: '0', color: '#5D4037', fontSize: '16px', fontWeight: '600' }}>edit paper info</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSaveNodeEdit} className="bg-[#BDB4D3] hover:brightness-105 transition-all duration-200" style={{ padding: '8px 16px', color: '#F5F5DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', backgroundColor: '#BDB4D3' }}>儲存</button>
              <button onClick={() => { setIsEditingNode(false); setEditNodeData(null); }} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#707C5D', border: `1px solid #A39A86`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#D2CBBF'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>取消</button>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#707C5D', fontSize: '13px' }}>Title:</label>
            <input type="text" value={editNodeData.title} onChange={(e) => setEditNodeData({...editNodeData, title: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: `1px solid #BDB4D3`, borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#707C5D', fontSize: '13px' }}>author:</label>
            <input type="text" value={editNodeData.authors.join(', ')} onChange={(e) => setEditNodeData({...editNodeData, authors: e.target.value.split(', ').filter(a => a.trim())})} style={{ width: '100%', padding: '8px 12px', border: `1px solid #BDB4D3`, borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#707C5D', fontSize: '13px' }}>Year:</label>
            <input type="text" value={editNodeData.year || ''} onChange={(e) => setEditNodeData({...editNodeData, year: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: `1px solid #BDB4D3`, borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#707C5D', fontSize: '13px' }}>abstract:</label>
            <textarea value={editNodeData.abstract || ''} onChange={(e) => setEditNodeData({...editNodeData, abstract: e.target.value})} rows={4} style={{ width: '100%', padding: '8px 12px', border: `1px solid #BDB4D3`, borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#707C5D', fontSize: '13px' }}>venue:</label>
            <input type="text" value={editNodeData.venue || ''} onChange={(e) => setEditNodeData({...editNodeData, venue: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: `1px solid #BDB4D3`, borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#707C5D', fontSize: '13px' }}>citation(didn't work currently):</label>
            <input type="number" value={editNodeData.citationCount || 0} onChange={(e) => setEditNodeData({...editNodeData, citationCount: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px 12px', border: `1px solid #BDB4D3`, borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif' }} />
          </div>
          <div style={{ marginBottom: '0' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#707C5D', fontSize: '13px' }}>tags(didn't work currently):</label>
            <input type="text" value={editNodeData.tags.join(', ')} onChange={(e) => setEditNodeData({...editNodeData, tags: e.target.value.split(', ').filter(t => t.trim())})} style={{ width: '100%', padding: '8px 12px', border: `1px solid #BDB4D3`, borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif' }} />
          </div>
        </div>
      )}

      {selectedEdge && !isEditingEdge && (
        <div style={{ position: 'absolute', top: '320px', right: '16px', background: '#F5F5DC', border: `2px solid #BDB4D3`, padding: '20px', borderRadius: '12px', boxShadow: '0 3px 12px rgba(189, 180, 211, 0.25)', maxHeight: '400px', width: '500px', fontFamily: '"Lora", "Merriweather", "Georgia", serif' }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#5D4037', fontSize: '16px', fontWeight: '600' }}>relation info</h4>
          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
            <p style={{ marginBottom: '8px', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>relation:</span> {selectedEdge.relationship}</p>
            <p style={{ marginBottom: '8px', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>description:</span> {selectedEdge.description}</p>
            <p style={{ marginBottom: '8px', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>original context:</span> {selectedEdge.evidence}</p>
            <p style={{ marginBottom: '16px', color: '#5D4037' }}><span style={{ fontWeight: '600', color: '#707C5D' }}>strength:</span> {selectedEdge.strength}</p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setEditEdgeData({ ...selectedEdge, source: (selectedEdge.source as Node).id, target: (selectedEdge.target as Node).id }); setIsEditingEdge(true); }} className="bg-[#BDB4D3] hover:brightness-105 transition-all duration-200" style={{ padding: '8px 16px', color: '#F5F5DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', backgroundColor: '#BDB4D3' }}>Edit</button>
              <button onClick={() => setSelectedEdge(null)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#707C5D', border: `1px solid #A39A86`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#D2CBBF'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {isEditingEdge && editEdgeData && (
        <div style={{ position: 'absolute', top: '320px', right: '16px', background: '#F5F5DC', border: `2px solid #BDB4D3`, padding: '20px', borderRadius: '12px', maxHeight: '400px', boxShadow: '0 3px 12px rgba(189, 180, 211, 0.25)', width: '340px', fontFamily: '"Lora", "Merriweather", "Georgia", serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: '0', color: '#5D4037', fontSize: '16px', fontWeight: '600' }}>Edit Connection</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSaveEdgeEdit} className="bg-[#BDB4D3] hover:brightness-105 transition-all duration-200" style={{ padding: '8px 16px', color: '#F5F5DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', backgroundColor: '#BDB4D3' }}>儲存</button>
              <button onClick={() => { setIsEditingEdge(false); setEditEdgeData(null); }} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#707C5D', border: `1px solid #A39A86`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#D2CBBF'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>取消</button>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#707C5D', fontSize: '13px' }}>relation type:</label>
            <select value={editEdgeData.relationship} onChange={(e) => setEditEdgeData({...editEdgeData, relationship: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: `1px solid #BDB4D3`, borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif' }}>
              <option value="cites">引用 (cites)</option>
              <option value="builds on">建構於 (builds on)</option>
              <option value="extends">擴展 (extends)</option>
              <option value="compares">比較 (compares)</option>
              <option value="contradicts">反駁 (contradicts)</option>
              <option value="related">相關 (related)</option>
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#707C5D', fontSize: '13px' }}>description:</label>
            <textarea value={editEdgeData.description} onChange={(e) => setEditEdgeData({...editEdgeData, description: e.target.value})} rows={3} style={{ width: '100%', padding: '8px 12px', border: `1px solid #BDB4D3`, borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#B89B74', fontSize: '13px' }}>original context:</label>
            <textarea value={editEdgeData.evidence} onChange={(e) => setEditEdgeData({...editEdgeData, evidence: e.target.value})} rows={2} style={{ width: '100%', padding: '8px 12px', border: `1px solid #D2CBBF`, borderRadius: '8px', backgroundColor: '#F5F5DC', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '0' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#B89B74', fontSize: '13px' }}>strength (0-1):</label>
            <input type="number" min="0" max="1" step="0.1" value={editEdgeData.strength} onChange={(e) => setEditEdgeData({...editEdgeData, strength: parseFloat(e.target.value) || 0})} style={{ width: '100%', padding: '8px 12px', border: `1px solid #D2CBBF`, borderRadius: '8px', backgroundColor: '#F5F5DC', color: '#5D4037', fontSize: '13px', fontFamily: '"Inter", "Lato", sans-serif' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphVisualization;