import { useState, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Avatar,
  Divider,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { getSessions, Session } from '../services/sessionService';
import { getCurrentUser } from '../utils/auth';

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string, graphData: any) => void;
}

export default function HistorySidebar({ open, onClose, onSelectSession }: HistorySidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadUser();
      loadSessions();
    }
  }, [open]);

  const loadUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionClick = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const token = localStorage.getItem('authToken');

      // Fetch session graph data
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/graph`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load session graph');
      }

      const data = await response.json();
      onSelectSession(sessionId, data.graphData);
    } catch (error) {
      console.error('Failed to load session graph:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 360,
          backgroundColor: '#252525',
          color: '#e8e8e8',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            历史记录
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{
              color: '#e8e8e8',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* User Profile Section */}
        {user && (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 2,
                mb: 2,
                backgroundColor: '#1e1e1e',
                borderRadius: 2,
              }}
            >
              <Avatar
                src={user.avatar}
                sx={{
                  width: 48,
                  height: 48,
                  mr: 2,
                  bgcolor: '#64c864',
                }}
              >
                {user.name?.[0] || user.email?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {user.name || '用户'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#b8b8b8', fontSize: '0.85rem' }}>
                  {user.email}
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 2, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          </>
        )}

        {/* Sessions List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress sx={{ color: '#64c864' }} />
          </Box>
        ) : sessions.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#b8b8b8', textAlign: 'center', p: 4 }}>
            还没有历史记录
          </Typography>
        ) : (
          <List>
            {sessions.map((session) => (
              <ListItem key={session.id} disablePadding>
                <ListItemButton
                  onClick={() => handleSessionClick(session.id)}
                  selected={selectedSessionId === session.id}
                  sx={{
                    mb: 1,
                    borderRadius: 1,
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(100, 200, 100, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(100, 200, 100, 0.3)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {session.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: '#b8b8b8', fontSize: '0.8rem' }}>
                        {formatDate(session.createdAt)}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}

