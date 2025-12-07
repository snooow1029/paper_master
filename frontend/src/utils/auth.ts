/**
 * Authentication utility functions
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Get stored token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * Set token
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('authToken', token);
}

/**
 * Clear token (logout)
 */
export function clearAuthToken(): void {
  localStorage.removeItem('authToken');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Get authentication headers
 */
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

/**
 * Get current user information
 */
export async function getCurrentUser() {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      throw new Error('Login expired, please login again');
    }
    throw new Error('Failed to get user information');
  }

  return response.json();
}

/**
 * Logout
 */
export function logout(): void {
  clearAuthToken();
  window.location.href = '/';
}

