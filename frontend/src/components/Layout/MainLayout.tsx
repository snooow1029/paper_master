import React from 'react';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
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
          
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#b8b8b8',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              marginLeft: 2,
              fontSize: '0.85rem'
            }}
          >
             Citation Network Analysis |  Intelligent Section Filtering |  Relationship Graph Construction
          </Typography>
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
    </Box>
  );
};

export default MainLayout;
