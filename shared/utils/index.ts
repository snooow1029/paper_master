/**
 * Validates if a string is a valid URL
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if URL is an arXiv paper URL
 */
export function isArxivUrl(url: string): boolean {
  return url.includes('arxiv.org/abs/');
}

/**
 * Checks if URL is a DOI URL
 */
export function isDoiUrl(url: string): boolean {
  return url.includes('doi.org/') || url.startsWith('10.');
}

/**
 * Extracts arXiv ID from URL
 */
export function extractArxivId(url: string): string | null {
  const match = url.match(/arxiv\.org\/abs\/([^?\/]+)/);
  return match ? match[1] : null;
}

/**
 * Extracts DOI from URL
 */
export function extractDoi(url: string): string | null {
  if (url.includes('doi.org/')) {
    return url.split('doi.org/')[1];
  }
  if (url.startsWith('10.')) {
    return url;
  }
  return null;
}

/**
 * Truncates text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generates a random color for graph visualization
 */
export function generateRandomColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Calculates similarity score between two strings
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / totalWords;
}
