import { Router } from 'express';
import { SessionController } from '../controllers/SessionController';
import { requireAuth } from '../middleware/auth';

const router = Router();
const sessionController = new SessionController();

// All routes require authentication
router.use(requireAuth);

// Create session
router.post('/', sessionController.createSession.bind(sessionController));

// Get all sessions for current user
router.get('/', sessionController.getUserSessions.bind(sessionController));

// Get session by ID
router.get('/:id', sessionController.getSessionById.bind(sessionController));

// Get session graph data
router.get('/:id/graph', sessionController.getSessionGraphData.bind(sessionController));

// Update session graph data
router.put('/:id/update-graph', sessionController.updateSessionGraph.bind(sessionController));

// Update session
router.put('/:id', sessionController.updateSession.bind(sessionController));

// Delete session
router.delete('/:id', sessionController.deleteSession.bind(sessionController));

export default router;

