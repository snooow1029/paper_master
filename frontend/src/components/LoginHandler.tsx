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
      setMessage('Verifying login...');

      // Store token
      setAuthToken(token);

      // Verify token and get user information
      getCurrentUser()
        .then((user) => {
          console.log('✅ Login successful:', user);
          setStatus('success');
          setMessage(`Welcome, ${user.name || user.email}!`);

          // Clear token from URL
          searchParams.delete('token');
          setSearchParams(searchParams, { replace: true });

          // Clear message after 2 seconds
          setTimeout(() => {
            setStatus('idle');
            setMessage('');
          }, 2000);
        })
        .catch((error) => {
          console.error('❌ Login verification failed:', error);
          setStatus('error');
          setMessage('Login verification failed, please try again');

          // Clear invalid token
          localStorage.removeItem('authToken');

          // Clear message after 3 seconds
          setTimeout(() => {
            setStatus('idle');
            setMessage('');
          }, 3000);
        });
    }
  }, [token, searchParams, setSearchParams]);

  // Show status message (optional)
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

  return null; // Don't render anything
}

