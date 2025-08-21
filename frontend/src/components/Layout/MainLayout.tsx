import React from 'react';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <Box sx={{ 
      flexGrow: 1,
      color: '#5D4037',
      backgroundColor: '#F5F5DC',
      minHeight: '100vh'
    }}>
      <AppBar 
        position="static" 
        sx={{ 
          backgroundColor: 'linear-gradient(135deg, #BDB4D3 0%, #707C5D 100%)',
          background: 'linear-gradient(135deg, #BDB4D3 0%, #707C5D 100%)'
        }}
      >
        <Toolbar>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontFamily: '"Lora", "Merriweather", "Georgia", serif',
              color: '#F5F5DC'
            }}
          >
            Paper Master - Intelligent Paper Analysis System
          </Typography>
          
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#D2CBBF',
              fontFamily: '"Lora", "Merriweather", "Georgia", serif',
              marginLeft: 2
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
          backgroundColor: '#F5F5DC',
          minHeight: 'calc(100vh - 64px)'
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;
