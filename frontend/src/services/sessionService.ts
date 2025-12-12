/**
 * Session API 服务
 */

import { getAuthToken } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface Session {
  id: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionRequest {
  title: string;
  description?: string;
}

/**
 * 创建新 Session
 */
export async function createSession(data: CreateSessionRequest): Promise<Session> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      throw new Error('登录已过期，请重新登录');
    }
    const error = await response.json().catch(() => ({ error: '创建 Session 失败' }));
    throw new Error(error.error || '创建 Session 失败');
  }

  return response.json();
}

/**
 * 获取所有 Sessions
 */
export async function getSessions(): Promise<Session[]> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      throw new Error('登录已过期，请重新登录');
    }
    throw new Error('获取 Sessions 失败');
  }

  return response.json();
}

/**
 * 获取特定 Session
 */
export async function getSessionById(sessionId: string): Promise<Session> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      throw new Error('登录已过期，请重新登录');
    }
    if (response.status === 404) {
      throw new Error('Session 不存在');
    }
    throw new Error('获取 Session 失败');
  }

  return response.json();
}

/**
 * 更新 Session
 */
export async function updateSession(
  sessionId: string,
  data: Partial<CreateSessionRequest>
): Promise<Session> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      throw new Error('登录已过期，请重新登录');
    }
    throw new Error('更新 Session 失败');
  }

  return response.json();
}

/**
 * 删除 Session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      throw new Error('登录已过期，请重新登录');
    }
    throw new Error('删除 Session 失败');
  }
}

/**
 * 删除所有 Sessions
 */
export async function deleteAllSessions(): Promise<number> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      throw new Error('登录已过期，请重新登录');
    }
    throw new Error('删除所有 Sessions 失败');
  }

  const result = await response.json();
  return result.deletedCount || 0;
}

