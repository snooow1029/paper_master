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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Close as CloseIcon, Delete as DeleteIcon, DeleteOutline as DeleteOutlineIcon } from '@mui/icons-material';
import { getSessions, deleteSession, deleteAllSessions, Session } from '../services/sessionService';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadUser();
      loadSessions();
    }
  }, [open]);

  // Listen for session saved event to reload the list
  useEffect(() => {
    const handleSessionSaved = () => {
      loadSessions();
    };

    window.addEventListener('sessionSaved', handleSessionSaved);
    return () => {
      window.removeEventListener('sessionSaved', handleSessionSaved);
    };
  }, []);

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
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent triggering the list item click
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;
    
    try {
      await deleteSession(sessionToDelete);
      // Remove from local state
      setSessions(sessions.filter(s => s.id !== sessionToDelete));
      // If the deleted session was selected, clear selection
      if (selectedSessionId === sessionToDelete) {
        setSelectedSessionId(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('删除失败，请重试');
    } finally {
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const handleDeleteAllClick = () => {
    setDeleteAllDialogOpen(true);
  };

  const handleDeleteAllConfirm = async () => {
    try {
      await deleteAllSessions();
      setSessions([]);
      setSelectedSessionId(null);
    } catch (error) {
      console.error('Failed to delete all sessions:', error);
      alert('删除失败，请重试');
    } finally {
      setDeleteAllDialogOpen(false);
    }
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
            History
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
                  {user.name || 'User'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#b8b8b8', fontSize: '0.85rem' }}>
                  {user.email}
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 2, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          </>
        )}

        {/* Delete All Button */}
        {sessions.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleDeleteAllClick}
              sx={{
                borderColor: '#f44336',
                color: '#f44336',
                '&:hover': {
                  borderColor: '#d32f2f',
                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                },
              }}
            >
              Delete All Records
            </Button>
          </Box>
        )}

        {/* Sessions List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress sx={{ color: '#64c864' }} />
          </Box>
        ) : sessions.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#b8b8b8', textAlign: 'center', p: 4 }}>
            No history yet
          </Typography>
        ) : (
          <List>
            {sessions.map((session) => (
              <ListItem 
                key={session.id} 
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={(e) => handleDeleteClick(e, session.id)}
                    sx={{
                      color: '#b8b8b8',
                      '&:hover': {
                        color: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                      },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => handleSessionClick(session.id)}
                  selected={selectedSessionId === session.id}
                  sx={{
                    mb: 1,
                    borderRadius: 1,
                    pr: 6, // Add padding for delete button
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
                        {formatDate(session.updatedAt)}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: '#2d2d2d',
            color: '#e8e8e8',
          },
        }}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#b8b8b8' }}>
            Are you sure you want to delete this record? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: '#e8e8e8' }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog
        open={deleteAllDialogOpen}
        onClose={() => setDeleteAllDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: '#2d2d2d',
            color: '#e8e8e8',
          },
        }}
      >
        <DialogTitle>Confirm Delete All Records</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#b8b8b8' }}>
            Are you sure you want to delete all history records? This action cannot be undone. {sessions.length} record(s) will be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllDialogOpen(false)} sx={{ color: '#e8e8e8' }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteAllConfirm} color="error" variant="contained">
            Delete All
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}

