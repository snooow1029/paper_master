import { Router } from 'express';
import { PaperController } from '../controllers/PaperController';

const router = Router();
const paperController = new PaperController();

// Analyze multiple papers and generate graph
router.post('/analyze', paperController.analyzePapers.bind(paperController));

// Analyze papers with citation network extraction
router.post('/analyze-with-citations', paperController.analyzePapersWithCitations.bind(paperController));

// Analyze papers with advanced semantic citation analysis
router.post('/analyze-with-semantic-citations', paperController.analyzePapersWithSemanticCitations.bind(paperController));

// Extract citation network for existing papers
router.post('/extract-citations', paperController.extractCitationNetwork.bind(paperController));

// Get all papers
router.get('/', paperController.getAllPapers.bind(paperController));

// Get paper by ID
router.get('/:id', paperController.getPaperById.bind(paperController));

// Update paper
router.put('/:id', paperController.updatePaper.bind(paperController));

// Delete paper
router.delete('/:id', paperController.deletePaper.bind(paperController));

export default router;
