/**
 * 前端登录处理示例代码
 * 
 * 将这个代码集成到你的前端应用中
 * 
 * 方法 1: 在 App.tsx 或主组件中添加
 * 方法 2: 创建一个专门的 LoginHandler 组件
 */

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

/**
 * 方法 1: 在 App.tsx 中使用
 */
export function useLoginHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      // 存储 token
      localStorage.setItem('authToken', token);
      
      // 验证 token 并获取用户信息
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('Token 验证失败');
        }
        return res.json();
      })
      .then(user => {
        console.log('✅ 登录成功:', user);
        
        // 可选：存储用户信息到 state/store
        // setUser(user);
        
        // 清除 URL 中的 token
        searchParams.delete('token');
        setSearchParams(searchParams, { replace: true });
        
        // 可选：显示成功消息
        // toast.success('登录成功！');
      })
      .catch(err => {
        console.error('❌ 登录验证失败:', err);
        
        // 清除无效的 token
        localStorage.removeItem('authToken');
        
        // 重定向到登录页面
        navigate('/login?error=invalid_token');
      });
    }
  }, [token, searchParams, setSearchParams, navigate]);
}

/**
 * 方法 2: 创建独立的 LoginHandler 组件
 */
export function LoginHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      // 存储 token
      localStorage.setItem('authToken', token);
      
      // 验证 token
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      
      fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => res.json())
      .then(user => {
        console.log('✅ 登录成功:', user);
        
        // 清除 URL 中的 token
        searchParams.delete('token');
        setSearchParams(searchParams, { replace: true });
      })
      .catch(err => {
        console.error('❌ 验证失败:', err);
        localStorage.removeItem('authToken');
        navigate('/login?error=invalid_token');
      });
    }
  }, [token, searchParams, setSearchParams, navigate]);

  return null; // 这个组件不渲染任何内容
}

/**
 * 使用示例：
 * 
 * // 在 App.tsx 中
 * import { LoginHandler } from './LoginHandler';
 * 
 * function App() {
 *   return (
 *     <>
 *       <LoginHandler />
 *       {/* 其他组件 */}
 *     </>
 *   );
 * }
 * 
 * // 或者使用 hook
 * import { useLoginHandler } from './LoginHandler';
 * 
 * function App() {
 *   useLoginHandler();
 *   // ...
 * }
 */

/**
 * API 调用辅助函数
 */
export function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('authToken');
}

/**
 * 登出
 */
export function logout() {
  localStorage.removeItem('authToken');
  // 可选：清除其他用户相关数据
  window.location.href = '/';
}

/**
 * 使用示例：调用需要认证的 API
 */
export async function createSession(title: string, description?: string) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    throw new Error('未登录');
  }
  
  const response = await fetch(`${apiBaseUrl}/api/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, description })
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token 无效，清除并重定向到登录
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      throw new Error('登录已过期，请重新登录');
    }
    throw new Error('请求失败');
  }
  
  return response.json();
}

