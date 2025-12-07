import { useState, useEffect } from 'react';
import { GraphData } from '../types/graph';

interface UseLoadSessionResult {
  graphData: GraphData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to load session data and sanitize graph data for vis-network
 * Ensures all IDs are strings to prevent ID mismatch issues
 */
export function useLoadSession(sessionId: string | null): UseLoadSessionResult {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setGraphData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const loadSession = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const token = localStorage.getItem('authToken');

        if (!token) {
          throw new Error('No authentication token found');
        }

        // Fetch session graph data
        const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/graph`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load session: ${response.statusText}`);
        }

        const data = await response.json();
        const rawGraphData = data.graphData;

        if (!rawGraphData) {
          throw new Error('No graph data found in session');
        }

        // Sanitize graph data: ensure all IDs are strings
        const sanitizedGraphData = sanitizeGraphData(rawGraphData);

        setGraphData(sanitizedGraphData);
        console.log(`✅ Loaded session ${sessionId}: ${sanitizedGraphData.nodes.length} nodes, ${sanitizedGraphData.edges.length} edges`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('❌ Failed to load session:', errorMessage);
        setError(errorMessage);
        setGraphData(null);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  return { graphData, loading, error };
}

/**
 * Sanitize graph data to ensure all IDs are strings
 * This prevents ID mismatch issues in vis-network
 */
function sanitizeGraphData(graphData: any): GraphData {
  // Sanitize nodes: ensure id is a string
  const sanitizedNodes = (graphData.nodes || []).map((node: any) => ({
    ...node,
    id: String(node.id || node.url || `node-${Math.random()}`),
    // Ensure label is a string
    label: String(node.label || node.title || ''),
  }));

  // Sanitize edges: convert from/to to source/target format for D3 compatibility
  const sanitizedEdges = (graphData.edges || []).map((edge: any, index: number) => {
    // Support both 'from/to' and 'source/target' formats
    const sourceId = edge.from || edge.source;
    const targetId = edge.to || edge.target;
    
    // Extract ID if source/target are objects
    const sourceIdStr = typeof sourceId === 'string' 
      ? sourceId 
      : (sourceId?.id ? String(sourceId.id) : String(sourceId));
    const targetIdStr = typeof targetId === 'string' 
      ? targetId 
      : (targetId?.id ? String(targetId.id) : String(targetId));

    return {
      ...edge,
      id: String(edge.id || `edge-${sourceIdStr}-${targetIdStr}-${index}`),
      source: sourceIdStr, // Use source/target for D3 compatibility
      target: targetIdStr,
      // Ensure label is a string if present
      label: edge.label ? String(edge.label) : undefined,
      // Preserve other edge properties
      relationship: edge.relationship,
      strength: edge.strength,
      evidence: edge.evidence,
      description: edge.description,
      // Remove from/to to avoid confusion
      from: undefined,
      to: undefined,
    };
  });

  return {
    nodes: sanitizedNodes,
    edges: sanitizedEdges,
    originalPapers: graphData.originalPapers?.map((id: any) => String(id)),
  };
}

