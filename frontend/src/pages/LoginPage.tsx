import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Divider,
  Fade,
} from '@mui/material';
import {
  Google as GoogleIcon,
  AccountTree as GraphIcon,
  Search as SearchIcon,
  Timeline as TimelineIcon,
  AutoAwesome as SparkleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated, getCurrentUser } from '../utils/auth';

const LoginPage: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    if (isAuthenticated()) {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
        setAuthenticated(true);
        // Redirect to main app after a short delay
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } catch (error) {
        console.error('Failed to get user:', error);
        setAuthenticated(false);
      }
    }
    setLoading(false);
  };

  const handleLogin = () => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    window.location.href = `${apiBaseUrl}/api/auth/google`;
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: '#1e1e1e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ color: '#64c864' }}>Loading...</Typography>
      </Box>
    );
  }

  if (authenticated && user) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: '#1e1e1e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Fade in={true}>
          <Card
            sx={{
              maxWidth: 500,
              backgroundColor: '#2d2d2d',
              border: '1px solid rgba(100, 200, 100, 0.2)',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <SparkleIcon sx={{ fontSize: 60, color: '#64c864', mb: 2 }} />
              <Typography
                variant="h5"
                sx={{
                  color: '#64c864',
                  mb: 2,
                  fontWeight: 600,
                }}
              >
                Welcome back, {user.name || user.email}!
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#b8b8b8',
                  mb: 3,
                }}
              >
                Redirecting to the application...
              </Typography>
            </CardContent>
          </Card>
        </Fade>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e1e1e 0%, #252525 50%, #1a3a1a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(100, 200, 100, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(100, 200, 100, 0.2) 0%, transparent 50%)',
        }}
      />

      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 4,
            alignItems: 'center',
          }}
        >
          {/* Left side - Branding and features */}
          <Fade in={true} timeout={800}>
            <Box sx={{ color: '#e8e8e8' }}>
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <GraphIcon
                    sx={{
                      fontSize: 48,
                      color: '#64c864',
                      mr: 2,
                    }}
                  />
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 700,
                      color: '#e8e8e8',
                      fontFamily: '"Inter", sans-serif',
                    }}
                  >
                    Paper Master
                  </Typography>
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    color: '#b8b8b8',
                    mb: 4,
                    fontWeight: 300,
                    ml: 8,
                  }}
                >
                  Academic Paper Relationship Analyzer
                </Typography>
              </Box>

              <Typography
                variant="h6"
                sx={{
                  color: '#64c864',
                  mb: 3,
                  fontWeight: 600,
                }}
              >
                Discover Connections Between Research Papers
              </Typography>

              <Box sx={{ mb: 4 }}>
                <FeatureItem
                  icon={<SearchIcon />}
                  title="Extract Citations"
                  description="Automatically extract and analyze citations from academic papers using GROBID"
                />
                <FeatureItem
                  icon={<GraphIcon />}
                  title="Build Knowledge Graphs"
                  description="Visualize relationships between papers in an interactive graph format"
                />
                <FeatureItem
                  icon={<TimelineIcon />}
                  title="Trace Influence"
                  description="Track how research influences subsequent work across time periods"
                />
              </Box>
            </Box>
          </Fade>

          {/* Right side - Login card */}
          <Fade in={true} timeout={1000}>
            <Card
              sx={{
                backgroundColor: '#2d2d2d',
                border: '1px solid rgba(100, 200, 100, 0.2)',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(100, 200, 100, 0.1)',
                backdropFilter: 'blur(10px)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Glowing border effect */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #64c864, transparent)',
                  animation: 'glow 3s ease-in-out infinite',
                  '@keyframes glow': {
                    '0%, 100%': { opacity: 0.5 },
                    '50%': { opacity: 1 },
                  },
                }}
              />

              <CardContent sx={{ p: 4 }}>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      color: '#e8e8e8',
                      mb: 1,
                      fontWeight: 600,
                    }}
                  >
                    Welcome
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#b8b8b8',
                    }}
                  >
                    Sign in to start exploring academic paper relationships
                  </Typography>
                </Box>

                <Divider
                  sx={{
                    mb: 4,
                    borderColor: 'rgba(100, 200, 100, 0.2)',
                  }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<GoogleIcon />}
                  onClick={handleLogin}
                  sx={{
                    backgroundColor: '#64c864',
                    color: '#1e1e1e',
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: 'none',
                    boxShadow: '0 4px 12px rgba(100, 200, 100, 0.3)',
                    '&:hover': {
                      backgroundColor: '#52a852',
                      boxShadow: '0 6px 16px rgba(100, 200, 100, 0.4)',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  Continue with Google
                </Button>

                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#888888',
                      fontSize: '0.75rem',
                    }}
                  >
                    By signing in, you agree to our Terms of Service and Privacy Policy
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Fade>
        </Box>
      </Container>
    </Box>
  );
};

interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        mb: 3,
        p: 2,
        borderRadius: 2,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: 'rgba(100, 200, 100, 0.05)',
          transform: 'translateX(4px)',
        },
      }}
    >
      <Box
        sx={{
          color: '#64c864',
          mr: 2,
          mt: 0.5,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography
          variant="subtitle1"
          sx={{
            color: '#e8e8e8',
            mb: 0.5,
            fontWeight: 600,
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#b8b8b8',
            lineHeight: 1.6,
          }}
        >
          {description}
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;

