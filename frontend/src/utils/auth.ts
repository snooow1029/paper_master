/**
 * 认证工具函数
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * 获取存储的 token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * 设置 token
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('authToken', token);
}

/**
 * 清除 token（登出）
 */
export function clearAuthToken(): void {
  localStorage.removeItem('authToken');
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * 获取认证 headers
 */
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser() {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      throw new Error('登录已过期，请重新登录');
    }
    throw new Error('获取用户信息失败');
  }

  return response.json();
}

/**
 * 登出
 */
export function logout(): void {
  clearAuthToken();
  window.location.href = '/';
}

