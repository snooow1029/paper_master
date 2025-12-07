import { Router } from 'express';
import { AnalysisController } from '../controllers/AnalysisController';
import { requireAuth } from '../middleware/auth';

const router = Router();
const analysisController = new AnalysisController();

// All routes require authentication
router.use(requireAuth);

// Create or update analysis
router.post('/', analysisController.createOrUpdateAnalysis.bind(analysisController));

// Get all analyses for a session
router.get('/session/:sessionId', analysisController.getSessionAnalyses.bind(analysisController));

// Get analysis by ID
router.get('/:id', analysisController.getAnalysisById.bind(analysisController));

// Delete analysis
router.delete('/:id', analysisController.deleteAnalysis.bind(analysisController));

export default router;

