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
  fullText?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaperRelation {
  id: string;
  fromPaper: Paper;
  toPaper: Paper;
  relationship: string;
  description: string;
  confidence: number;
  weight: number;
  createdAt?: Date;
}

export interface GraphNode {
  id: string;
  label: string;
  title: string;
  authors: string[];
  abstract: string;
  introduction: string;
  url: string;
  tags: string[];
  x?: number;
  y?: number;
  color?: string;
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

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AnalyzePapersRequest {
  urls: string[];
}

export interface AnalyzePapersResponse {
  papers: Paper[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AnalyzePapersWithCitationsRequest {
  urls: string[];
  includeCitations?: boolean;
  includeReferences?: boolean;
}

export interface AnalyzePapersWithCitationsResponse {
  papers: Paper[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  originalPapers: string[]; // IDs of original papers
  totalPapers: number;
  citationNetwork?: {
    citedPapers: number;
    citingPapers: number;
    citedPaperIds: string[];
    citingPaperIds: string[];
  };
}

export interface ExtractCitationNetworkRequest {
  paperIds: string[];
}

export interface ExtractCitationNetworkResponse {
  originalPapers: number;
  citedPapers: number;
  citingPapers: number;
  totalPapers: number;
  allPapers: Paper[];
}

export interface CitationNetwork {
  citedPapers: Paper[];
  citingPapers: Paper[];
  allPapers: Paper[];
}
