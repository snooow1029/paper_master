export const API_ENDPOINTS = {
  PAPERS: '/api/papers',
  ANALYZE: '/api/papers/analyze',
  HEALTH: '/api/health',
} as const;

export const PAPER_SOURCES = {
  ARXIV: 'arXiv',
  DOI: 'DOI',
  WEB: 'Web',
} as const;

export const RELATIONSHIP_TYPES = {
  CITATION: 'citation',
  METHODOLOGICAL: 'methodological',
  THEORETICAL: 'theoretical',
  DOMAIN: 'domain',
  TEMPORAL: 'temporal',
} as const;

export const GRAPH_LAYOUT_OPTIONS = {
  PHYSICS_ENABLED: true,
  STABILIZATION_ITERATIONS: 100,
  SPRING_LENGTH: 95,
  CENTRAL_GRAVITY: 0.3,
  GRAVITATIONAL_CONSTANT: -8000,
} as const;

export const UI_CONSTANTS = {
  MAX_TITLE_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 200,
  DEFAULT_NODE_SIZE: 20,
  DEFAULT_EDGE_WIDTH: 2,
} as const;
