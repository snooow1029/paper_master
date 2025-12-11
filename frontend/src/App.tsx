import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography } from '@mui/material';
import MainLayout from './components/Layout/MainLayout';
import PaperGraphPage from './pages/PaperGraphPage';
import EnhancedGraphVisualization from './components/EnhancedGraphVisualization';
import LoginHandler from './components/LoginHandler';
import LoginPage from './pages/LoginPage';
import { isAuthenticated } from './utils/auth';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3b82f6',
    },
    secondary: {
      main: '#10b981',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
});

function TestPage() {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        測試頁面 - 應該能看到這個文字
      </Typography>
      <Typography variant="body1">
        如果你能看到這個頁面，說明基本的 React 和 Material-UI 功能正常。
      </Typography>
    </Box>
  );
}

// Protected Route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  const [sessionHandler, setSessionHandler] = React.useState<((sessionId: string, graphData: any) => void) | undefined>();

  React.useEffect(() => {
    console.log('🔧 App: sessionHandler updated', !!sessionHandler);
  }, [sessionHandler]);

  // Store pending session selection if handler is not ready
  const pendingSelectionRef = React.useRef<{ sessionId: string; graphData: any } | null>(null);

  const handleSessionSelect = React.useCallback((sessionId: string, graphData: any) => {
    if (sessionHandler) {
      sessionHandler(sessionId, graphData);
      pendingSelectionRef.current = null;
    } else {
      console.log('⏳ App: Handler not ready, storing pending selection');
      pendingSelectionRef.current = { sessionId, graphData };
    }
  }, [sessionHandler]);

  // Process pending selection when handler becomes available
  React.useEffect(() => {
    if (sessionHandler && pendingSelectionRef.current) {
      console.log('✅ App: Processing pending selection', pendingSelectionRef.current);
      const { sessionId, graphData } = pendingSelectionRef.current;
      sessionHandler(sessionId, graphData);
      pendingSelectionRef.current = null;
    }
  }, [sessionHandler]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <LoginHandler />
        <Routes>
          {/* Public route - Login page */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected routes - require authentication */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout onSelectSession={handleSessionSelect}>
                  <PaperGraphPage setSessionHandler={setSessionHandler} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/graph"
            element={
              <ProtectedRoute>
                <MainLayout onSelectSession={handleSessionSelect}>
                  <PaperGraphPage setSessionHandler={setSessionHandler} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/new-graph"
            element={
              <ProtectedRoute>
                <MainLayout onSelectSession={handleSessionSelect}>
                  <PaperGraphPage setSessionHandler={setSessionHandler} />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/enhanced-analysis"
            element={
              <ProtectedRoute>
                <MainLayout onSelectSession={handleSessionSelect}>
                  <EnhancedGraphVisualization />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/test"
            element={
              <ProtectedRoute>
                <MainLayout onSelectSession={handleSessionSelect}>
                  <TestPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
