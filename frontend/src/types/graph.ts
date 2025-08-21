export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  introduction: string;
  url: string;
  doi?: string;
  arxivId?: string;
  publishedDate?: string;
  tags: string[];
}

export interface Node {
  id: string;
  label: string;
  title: string;
  authors: string[];
  abstract: string;
  introduction: string;
  url: string;
  tags: string[];
  year?: string;
  venue?: string;
  conference?: string;
  citationCount?: number;
  paperCitationCount?: number;
  doi?: string;
  arxivId?: string;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  vx?: number;
  vy?: number;
}

export interface Edge {
  source: string | Node; // D3 force simulation converts string IDs to node objects
  target: string | Node; // D3 force simulation converts string IDs to node objects
  relationship: string;
  strength: number;
  evidence: string;
  description: string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
  originalPapers?: string[]; // IDs of source papers input by user
}

// Legacy interfaces for compatibility
export interface GraphNode extends Node {
  color?: string;
  semanticScholarUrl?: string;
  googleScholarUrl?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  description: string;
  weight: number;
  color?: string;
}
