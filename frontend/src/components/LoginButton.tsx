import { Button } from '@mui/material';
import { isAuthenticated, getCurrentUser, logout } from '../utils/auth';
import { useState, useEffect } from 'react';

interface LoginButtonProps {
  onLogin?: (user: any) => void;
}

export default function LoginButton({ onLogin }: LoginButtonProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (isAuthenticated()) {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
        setAuthenticated(true);
        if (onLogin) {
          onLogin(userData);
        }
      } catch (error) {
        console.error('Failed to get user:', error);
        setAuthenticated(false);
      }
    }
    setLoading(false);
  };

  const handleLogin = () => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    // Redirect to Google OAuth
    window.location.href = `${apiBaseUrl}/api/auth/google`;
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setUser(null);
    if (onLogin) {
      onLogin(null);
    }
  };

  if (loading) {
    return <Button disabled>检查中...</Button>;
  }

  if (authenticated && user) {
    return (
      <Button
        variant="outlined"
        onClick={handleLogout}
        sx={{
          color: '#e8e8e8',
          borderColor: '#64c864',
          '&:hover': {
            borderColor: '#64c864',
            backgroundColor: 'rgba(100, 200, 100, 0.1)',
          },
        }}
      >
        登出 ({user.name || user.email})
      </Button>
    );
  }

  return (
    <Button
      variant="contained"
      onClick={handleLogin}
      sx={{
        backgroundColor: '#64c864',
        color: '#1e1e1e',
        fontWeight: 600,
        '&:hover': {
          backgroundColor: '#52a852',
        },
      }}
    >
      使用 Google 登入
    </Button>
  );
}

