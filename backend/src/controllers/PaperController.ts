import { Request, Response } from 'express';
import { PaperService } from '../services/PaperService';
import { GraphService } from '../services/GraphService';

export class PaperController {
  private paperService: PaperService;
  private graphService: GraphService;

  constructor() {
    this.paperService = new PaperService();
    this.graphService = new GraphService();
  }

  async analyzePapers(req: Request, res: Response) {
    try {
      const { urls } = req.body;

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'URLs array is required' });
      }

      // Fetch papers metadata
      const papers = await this.paperService.fetchPapersFromUrls(urls);
      
      // Generate relationships using AI
      const relations = await this.graphService.generateRelations(papers);
      
      // Convert to graph format
      const graphData = await this.graphService.convertToGraphData(papers, relations);

      res.json({
        papers,
        nodes: graphData.nodes,
        edges: graphData.edges,
      });
    } catch (error) {
      console.error('Error analyzing papers:', error);
      res.status(500).json({ error: 'Failed to analyze papers' });
    }
  }

  /**
   * Analyze papers with advanced semantic citation network extraction
   */
  async analyzePapersWithSemanticCitations(req: Request, res: Response) {
    try {
      const { urls, useSemanticAnalysis = false } = req.body;

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'URLs array is required' });
      }

      console.log(`Analyzing ${urls.length} papers with semantic citation analysis: ${useSemanticAnalysis}`);

      // Step 1: Fetch original papers metadata
      const originalPapers = await this.paperService.fetchPapersFromUrls(urls);
      
      if (originalPapers.length === 0) {
        return res.status(400).json({ error: 'No papers could be fetched from provided URLs' });
      }

      let allPapers = [...originalPapers];
      let semanticRelationships: Array<{
        fromPaper: string;
        toPaper: string;
        relationship: string;
        context: string;
        confidence: number;
      }> = [];

      // Step 2: Extract semantic citation network if requested
      if (useSemanticAnalysis) {
        console.log('Extracting semantic citation network...');
        const semanticNetwork = await this.paperService.extractSemanticCitationNetwork(originalPapers);
        
        allPapers = semanticNetwork.allPapers;
        semanticRelationships = semanticNetwork.semanticRelationships;
        
        // Save new papers to database
        for (const paper of semanticNetwork.citedPapers) {
          try {
            await this.paperService.savePaper(paper);
          } catch (error) {
            console.warn(`Failed to save paper: ${paper.title}`, error);
          }
        }
      }

      console.log(`Total papers in network: ${allPapers.length}`);

      // Step 3: Generate AI relationships for all papers
      const relations = await this.graphService.generateRelations(allPapers);
      
      // Step 4: Convert to graph format
      const graphData = await this.graphService.convertToGraphData(allPapers, relations);

      // Step 5: Enhance graph with semantic relationships
      if (useSemanticAnalysis && semanticRelationships.length > 0) {
        // Add semantic relationship edges to the graph
        for (const semanticRel of semanticRelationships) {
          const fromNode = graphData.nodes.find(n => n.title === semanticRel.fromPaper);
          const toNode = graphData.nodes.find(n => n.title === semanticRel.toPaper);
          
          if (fromNode && toNode) {
            graphData.edges.push({
              id: `semantic_${fromNode.id}_${toNode.id}`,
              from: fromNode.id,
              to: toNode.id,
              label: semanticRel.relationship.replace('_', ' '),
              description: `${semanticRel.context} (confidence: ${semanticRel.confidence})`,
              weight: semanticRel.confidence
            });
          }
        }
      }

      const response: any = {
        papers: allPapers,
        nodes: graphData.nodes,
        edges: graphData.edges,
        originalPapers: originalPapers.map(p => p.id),
        totalPapers: allPapers.length,
        useSemanticAnalysis
      };

      if (useSemanticAnalysis) {
        response.semanticAnalysis = {
          relationshipsFound: semanticRelationships.length,
          relationships: semanticRelationships
        };
      }

      res.json(response);
    } catch (error) {
      console.error('Error analyzing papers with semantic citations:', error);
      res.status(500).json({ 
        error: 'Failed to analyze papers with semantic citations',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getAllPapers(req: Request, res: Response) {
    try {
      const papers = await this.paperService.getAllPapers();
      res.json(papers);
    } catch (error) {
      console.error('Error fetching papers:', error);
      res.status(500).json({ error: 'Failed to fetch papers' });
    }
  }

  async getPaperById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const paper = await this.paperService.getPaperById(id);
      
      if (!paper) {
        return res.status(404).json({ error: 'Paper not found' });
      }

      res.json(paper);
    } catch (error) {
      console.error('Error fetching paper:', error);
      res.status(500).json({ error: 'Failed to fetch paper' });
    }
  }

  async updatePaper(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const updatedPaper = await this.paperService.updatePaper(id, updateData);
      
      if (!updatedPaper) {
        return res.status(404).json({ error: 'Paper not found' });
      }

      res.json(updatedPaper);
    } catch (error) {
      console.error('Error updating paper:', error);
      res.status(500).json({ error: 'Failed to update paper' });
    }
  }

  async deletePaper(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await this.paperService.deletePaper(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Paper not found' });
      }

      res.json({ message: 'Paper deleted successfully' });
    } catch (error) {
      console.error('Error deleting paper:', error);
      res.status(500).json({ error: 'Failed to delete paper' });
    }
  }

  /**
   * Analyze papers with citation network extraction
   * This will fetch the given papers and also find papers they cite and papers that cite them
   */
  async analyzePapersWithCitations(req: Request, res: Response) {
    try {
      const { urls, includeCitations = true, includeReferences = true } = req.body;

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'URLs array is required' });
      }

      console.log(`Analyzing ${urls.length} papers with citation network`);

      // Step 1: Fetch original papers metadata
      const originalPapers = await this.paperService.fetchPapersFromUrls(urls);
      
      if (originalPapers.length === 0) {
        return res.status(400).json({ error: 'No papers could be fetched from provided URLs' });
      }

      let allPapers = [...originalPapers];
      let citationNetwork = null;

      // Step 2: Extract citation network if requested
      if (includeCitations || includeReferences) {
        console.log('Extracting citation network...');
        citationNetwork = await this.paperService.extractCitationNetwork(originalPapers);
        
        // Use all papers from citation network
        allPapers = citationNetwork.allPapers;
        
        // Save new papers to database
        for (const paper of citationNetwork.citedPapers.concat(citationNetwork.citingPapers)) {
          try {
            await this.paperService.savePaper(paper);
          } catch (error) {
            console.warn(`Failed to save paper: ${paper.title}`, error);
          }
        }
      }

      console.log(`Total papers in network: ${allPapers.length}`);

      // Step 3: Generate AI relationships for all papers
      const relations = await this.graphService.generateRelations(allPapers);
      
      // Step 4: Convert to graph format
      const graphData = await this.graphService.convertToGraphData(allPapers, relations);

      // Step 5: Add citation relationship information to response
      const response: any = {
        papers: allPapers,
        nodes: graphData.nodes,
        edges: graphData.edges,
        originalPapers: originalPapers.map(p => p.id),
        totalPapers: allPapers.length
      };

      if (citationNetwork) {
        response.citationNetwork = {
          citedPapers: citationNetwork.citedPapers.length,
          citingPapers: citationNetwork.citingPapers.length,
          citedPaperIds: citationNetwork.citedPapers.map(p => p.id),
          citingPaperIds: citationNetwork.citingPapers.map(p => p.id)
        };
      }

      res.json(response);
    } catch (error) {
      console.error('Error analyzing papers with citations:', error);
      res.status(500).json({ 
        error: 'Failed to analyze papers with citations',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Extract citation network for existing papers
   */
  async extractCitationNetwork(req: Request, res: Response) {
    try {
      const { paperIds } = req.body;

      if (!paperIds || !Array.isArray(paperIds) || paperIds.length === 0) {
        return res.status(400).json({ error: 'Paper IDs array is required' });
      }

      // Fetch papers from database
      const papers = [];
      for (const id of paperIds) {
        const paper = await this.paperService.getPaperById(id);
        if (paper) {
          papers.push(paper);
        }
      }

      if (papers.length === 0) {
        return res.status(400).json({ error: 'No valid papers found for provided IDs' });
      }

      // Extract citation network
      const citationNetwork = await this.paperService.extractCitationNetwork(papers);

      // Save new papers to database
      for (const paper of citationNetwork.citedPapers.concat(citationNetwork.citingPapers)) {
        try {
          await this.paperService.savePaper(paper);
        } catch (error) {
          console.warn(`Failed to save paper: ${paper.title}`, error);
        }
      }

      res.json({
        originalPapers: papers.length,
        citedPapers: citationNetwork.citedPapers.length,
        citingPapers: citationNetwork.citingPapers.length,
        totalPapers: citationNetwork.allPapers.length,
        allPapers: citationNetwork.allPapers
      });
    } catch (error) {
      console.error('Error extracting citation network:', error);
      res.status(500).json({ 
        error: 'Failed to extract citation network',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
