/**
 * 登录处理组件
 * 处理 OAuth 回调后的 token
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setAuthToken, getCurrentUser } from '../utils/auth';

export default function LoginHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) {
      setStatus('processing');
      setMessage('正在验证登录...');

      // 存储 token
      setAuthToken(token);

      // 验证 token 并获取用户信息
      getCurrentUser()
        .then((user) => {
          console.log('✅ 登录成功:', user);
          setStatus('success');
          setMessage(`欢迎，${user.name || user.email}！`);

          // 清除 URL 中的 token
          searchParams.delete('token');
          setSearchParams(searchParams, { replace: true });

          // 2 秒后清除消息
          setTimeout(() => {
            setStatus('idle');
            setMessage('');
          }, 2000);
        })
        .catch((error) => {
          console.error('❌ 登录验证失败:', error);
          setStatus('error');
          setMessage('登录验证失败，请重新登录');

          // 清除无效的 token
          localStorage.removeItem('authToken');

          // 3 秒后清除消息
          setTimeout(() => {
            setStatus('idle');
            setMessage('');
          }, 3000);
        });
    }
  }, [token, searchParams, setSearchParams]);

  // 显示状态消息（可选）
  if (status !== 'idle' && message) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          padding: '12px 24px',
          backgroundColor: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#3b82f6',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 9999,
          fontSize: '14px',
        }}
      >
        {message}
      </div>
    );
  }

  return null; // 不渲染任何内容
}

