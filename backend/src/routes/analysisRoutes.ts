import { Router } from 'express';
import { AnalysisController } from '../controllers/AnalysisController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const analysisController = new AnalysisController();

// All routes require authentication
router.use(authenticateToken);

// Create or update analysis
router.post('/', analysisController.createOrUpdateAnalysis.bind(analysisController));

// Save existing analysis result (without re-analyzing)
router.post('/save-result', authenticateToken, analysisController.saveAnalysisResult.bind(analysisController));

// Get all analyses for a session
router.get('/session/:sessionId', analysisController.getSessionAnalyses.bind(analysisController));

// Get analysis by ID
router.get('/:id', analysisController.getAnalysisById.bind(analysisController));

// Delete analysis
router.delete('/:id', analysisController.deleteAnalysis.bind(analysisController));

export default router;

