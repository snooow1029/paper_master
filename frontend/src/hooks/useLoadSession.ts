import { useState, useEffect } from 'react';
import { GraphData } from '../types/graph';

interface UseLoadSessionResult {
  graphData: GraphData | null;
  priorWorks: Record<string, any[]>;
  derivativeWorks: Record<string, any[]>;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to load session data and sanitize graph data for vis-network
 * Ensures all IDs are strings to prevent ID mismatch issues
 */
export function useLoadSession(sessionId: string | null): UseLoadSessionResult {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [priorWorks, setPriorWorks] = useState<Record<string, any[]>>({});
  const [derivativeWorks, setDerivativeWorks] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setGraphData(null);
      setPriorWorks({});
      setDerivativeWorks({});
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
        const priorWorks = data.priorWorks || {};
        const derivativeWorks = data.derivativeWorks || {};

        console.log(`\n🟡 ========== FRONTEND LOAD SESSION START ==========`);
        console.log(`📥 Session ID: ${sessionId}`);
        console.log(`📥 Raw response data:`, {
          hasGraphData: !!rawGraphData,
          nodesCount: rawGraphData?.nodes?.length || 0,
          edgesCount: rawGraphData?.edges?.length || 0,
          hasPriorWorks: !!priorWorks,
          hasDerivativeWorks: !!derivativeWorks,
          priorWorksKeys: priorWorks ? Object.keys(priorWorks) : [],
          derivativeWorksKeys: derivativeWorks ? Object.keys(derivativeWorks) : []
        });

        if (!rawGraphData) {
          throw new Error('No graph data found in session');
        }

        if (rawGraphData.edges && rawGraphData.edges.length > 0) {
          console.log(`📥 Raw edges sample (first 3):`, rawGraphData.edges.slice(0, 3).map((e: any) => ({
            id: e.id,
            from: e.from,
            to: e.to,
            source: e.source,
            target: e.target,
            label: e.label
          })));
        }

        // Sanitize graph data: ensure all IDs are strings
        const sanitizedGraphData = sanitizeGraphData(rawGraphData);
        
        // 添加 priorWorks 和 derivativeWorks 到 graphData
        if (priorWorks || derivativeWorks) {
          (sanitizedGraphData as any).originalPapers = {
            priorWorks: priorWorks,
            derivativeWorks: derivativeWorks
          };
        }
        
        console.log(`🔄 After sanitization: ${sanitizedGraphData.nodes.length} nodes, ${sanitizedGraphData.edges.length} edges`);
        if (sanitizedGraphData.edges.length > 0) {
          console.log(`🔄 Sanitized edges sample (first 3):`, sanitizedGraphData.edges.slice(0, 3).map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label
          })));
        }

        setGraphData(sanitizedGraphData);
        setPriorWorks(priorWorks || {});
        setDerivativeWorks(derivativeWorks || {});
        console.log(`✅ Loaded session ${sessionId}: ${sanitizedGraphData.nodes.length} nodes, ${sanitizedGraphData.edges.length} edges`);
        if (priorWorks && Object.keys(priorWorks).length > 0) {
          const priorCount = Object.values(priorWorks).flat().length;
          console.log(`✅ Loaded ${priorCount} prior works from history across ${Object.keys(priorWorks).length} papers`);
        }
        if (derivativeWorks && Object.keys(derivativeWorks).length > 0) {
          const derivativeCount = Object.values(derivativeWorks).flat().length;
          console.log(`✅ Loaded ${derivativeCount} derivative works from history across ${Object.keys(derivativeWorks).length} papers`);
        }
        console.log(`🟡 ========== FRONTEND LOAD SESSION END ==========\n`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('❌ Failed to load session:', errorMessage);
        setError(errorMessage);
        setGraphData(null);
        setPriorWorks({});
        setDerivativeWorks({});
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  return { graphData, priorWorks, derivativeWorks, loading, error };
}

/**
 * Sanitize graph data to ensure all IDs are strings
 * This prevents ID mismatch issues in vis-network
 */
function sanitizeGraphData(graphData: any): GraphData {
  // Sanitize nodes: ensure id is a string and arrays are initialized
  const sanitizedNodes = (graphData.nodes || []).map((node: any) => ({
    ...node,
    id: String(node.id || node.url || `node-${Math.random()}`),
    // Ensure label is a string
    label: String(node.label || node.title || ''),
    // Ensure arrays are initialized (not undefined)
    authors: Array.isArray(node.authors) ? node.authors : [],
    tags: Array.isArray(node.tags) ? node.tags : [],
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

