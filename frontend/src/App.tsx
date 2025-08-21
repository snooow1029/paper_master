import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography } from '@mui/material';
import MainLayout from './components/Layout/MainLayout';
import PaperGraphPage from './pages/PaperGraphPage';
import EnhancedGraphVisualization from './components/EnhancedGraphVisualization';

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

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <MainLayout>
          <Routes>
            <Route path="/test" element={<TestPage />} />
            <Route path="/" element={<PaperGraphPage />} />
            <Route path="/graph" element={<PaperGraphPage />} />
            <Route path="/new-graph" element={<PaperGraphPage />} />
            <Route path="/enhanced-analysis" element={<EnhancedGraphVisualization />} />
          </Routes>
        </MainLayout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
