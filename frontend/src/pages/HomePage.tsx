import React, { useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon 
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const [urls, setUrls] = useState<string[]>(['']);
  const [includeCitations, setIncludeCitations] = useState(true);
  const [includeReferences, setIncludeReferences] = useState(true);
  // const [useSemanticAnalysis, setUseSemanticAnalysis] = useState(false);
  const navigate = useNavigate();

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const addUrlInput = () => {
    setUrls([...urls, '']);
  };

  const removeUrlInput = (index: number) => {
    if (urls.length > 1) {
      const newUrls = urls.filter((_, i) => i !== index);
      setUrls(newUrls);
    }
  };

  const handleSubmit = () => {
    const validUrls = urls.filter(url => url.trim() !== '');
    if (validUrls.length > 0) {
      // Navigate to graph page with URLs and citation options as query params
      const urlParams = new URLSearchParams();
      validUrls.forEach((url, index) => {
        urlParams.append(`url${index}`, url);
      });
      urlParams.append('includeCitations', includeCitations.toString());
      urlParams.append('includeReferences', includeReferences.toString());
      navigate(`/graph?${urlParams.toString()}`);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          學術論文視覺化工具
        </Typography>
        <Typography variant="h6" component="p" gutterBottom align="center" color="text.secondary">
          輸入論文 URL，生成互動式連結圖，探索研究脈絡
        </Typography>
      </Box>

      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            輸入論文 URL
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            支援 arXiv、DOI 等格式的論文連結
          </Typography>

          <Box sx={{ mt: 3 }}>
            {urls.map((url, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TextField
                  fullWidth
                  label={`論文 URL ${index + 1}`}
                  value={url}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  placeholder="https://arxiv.org/abs/... 或 DOI:..."
                  variant="outlined"
                />
                {urls.length > 1 && (
                  <IconButton
                    onClick={() => removeUrlInput(index)}
                    sx={{ ml: 1 }}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            ))}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addUrlInput}
                variant="outlined"
              >
                新增 URL
              </Button>

              <Button
                onClick={handleSubmit}
                variant="contained"
                size="large"
                disabled={urls.every(url => url.trim() === '')}
              >
                生成連結圖
              </Button>
            </Box>

            {/* Citation Network Options */}
            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="citation-options-content"
                id="citation-options-header"
              >
                <Typography variant="h6">引用網絡選項</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  從給定論文建立更完整的引用關係網絡
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeReferences}
                        onChange={(e) => setIncludeReferences(e.target.checked)}
                      />
                    }
                    label="包含參考文獻 (論文引用的其他論文)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeCitations}
                        onChange={(e) => setIncludeCitations(e.target.checked)}
                      />
                    }
                    label="包含引用來源 (引用此論文的其他論文)"
                    sx={{ display: 'block' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  註：啟用此功能會大幅增加節點數量，處理時間也會較長
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          功能特色
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip label="自動論文抓取" variant="outlined" />
          <Chip label="智能關聯分析" variant="outlined" />
          <Chip label="互動式編輯" variant="outlined" />
          <Chip label="AI 輔助摘要" variant="outlined" />
          <Chip label="引用網絡建構" variant="outlined" />
          <Chip label="即時更新" variant="outlined" />
        </Box>
      </Box>
    </Container>
  );
};

export default HomePage;
