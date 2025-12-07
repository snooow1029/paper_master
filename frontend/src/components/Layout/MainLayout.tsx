import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Box, IconButton } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import LoginButton from '../LoginButton';
import HistorySidebar from '../HistorySidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  onSelectSession?: (sessionId: string, graphData: any) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, onSelectSession }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setUser] = useState<any>(null);

  const handleSelectSession = (sessionId: string, graphData: any) => {
    console.log('📋 MainLayout: Session selected', sessionId, graphData);
    setSidebarOpen(false);
    if (onSelectSession) {
      console.log('📋 MainLayout: Calling onSelectSession');
      onSelectSession(sessionId, graphData);
    } else {
      console.warn('⚠️ MainLayout: onSelectSession not provided');
    }
  };

  return (
    <Box sx={{ 
      flexGrow: 1,
      color: '#e8e8e8',
      backgroundColor: '#1e1e1e',
      minHeight: '100vh'
    }}>
      <AppBar 
        position="static" 
        sx={{ 
          backgroundColor: '#252525',
          background: '#252525',
          borderBottom: '1px solid rgba(100, 200, 100, 0.2)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setSidebarOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              color: '#e8e8e8',
              fontWeight: 600,
              letterSpacing: '0.3px'
            }}
          >
            Paper Master - Intelligent Paper Analysis System
          </Typography>
          
          <LoginButton onLogin={setUser} />
        </Toolbar>
      </AppBar>
      <Box 
        component="main" 
        sx={{ 
          p: 3,
          backgroundColor: '#1e1e1e',
          minHeight: 'calc(100vh - 64px)'
        }}
      >
        {children}
      </Box>
      
      <HistorySidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectSession={handleSelectSession}
      />
    </Box>
  );
};

export default MainLayout;
