import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

interface GraphData {
  nodes: {
    id: string;
    title: string;
    authors: string[];
    abstract: string;
    introduction: string;
    url: string;
    tags: string[];
    year?: string;
    venue?: string;
    conference?: string;
    citationCount?: number;
    doi?: string;
    arxivId?: string;
  }[];
  edges: {
    source: string;
    target: string;
    relationship: string;
    strength: number;
    evidence: string;
    description: string;
  }[];
}

export class ObsidianSyncService {
  private obsidianVaultPath: string;
  private paperFolderName: string = 'Papers';
  private graphFolderName: string = 'Paper_Graphs';

  constructor(vaultPath?: string) {
    this.obsidianVaultPath = vaultPath || process.env.OBSIDIAN_VAULT_PATH || path.join(process.cwd(), 'obsidian_sync');
  }

  setVaultPath(vaultPath: string) {
    // Remove quotes and normalize path
    let cleanPath = vaultPath.trim().replace(/^["']|["']$/g, '');
    
    // If path is absolute (starts with drive letter on Windows or / on Unix), use it directly
    // Otherwise, treat as relative to current working directory
    if (path.isAbsolute(cleanPath)) {
      this.obsidianVaultPath = cleanPath;
    } else {
      // If relative path, resolve it relative to current working directory
      this.obsidianVaultPath = path.resolve(process.cwd(), cleanPath);
    }
    
    console.log(`Obsidian vault path set to: ${this.obsidianVaultPath}`);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async syncGraphToObsidian(graphData: GraphData, graphName: string = 'Paper Graph'): Promise<{
    success: boolean;
    message: string;
    files?: string[];
  }> {
    try {
      const paperFolderPath = path.join(this.obsidianVaultPath, this.paperFolderName);
      const graphFolderPath = path.join(this.obsidianVaultPath, this.graphFolderName);
      
      this.ensureDirectoryExists(paperFolderPath);
      this.ensureDirectoryExists(graphFolderPath);

      const createdFiles: string[] = [];

      // Create individual paper files
      for (const node of graphData.nodes) {
        const paperContent = this.generatePaperMarkdown(node, graphData);
        const safeFileName = this.generateSafeFileName(node.title);
        const paperFilePath = path.join(paperFolderPath, `${safeFileName}.md`);
        
        this.ensureDirectoryExists(path.dirname(paperFilePath));
        fs.writeFileSync(paperFilePath, paperContent, 'utf8');
        createdFiles.push(paperFilePath);
      }

      // Create overview file
      const timestamp = new Date().toISOString().split('T')[0];
      const overviewContent = this.generateGraphOverview(graphData, graphName);
      const safeGraphName = this.generateSafeFileName(graphName, 30);
      const overviewFileName = `${safeGraphName}_${timestamp}.md`;
      const overviewFilePath = path.join(graphFolderPath, overviewFileName);
      
      this.ensureDirectoryExists(path.dirname(overviewFilePath));
      fs.writeFileSync(overviewFilePath, overviewContent, 'utf8');
      createdFiles.push(overviewFilePath);

      return {
        success: true,
        message: `同步成功: ${graphData.nodes.length} 篇論文, ${graphData.edges.length} 個關係`,
        files: createdFiles
      };

    } catch (error) {
      console.error('Obsidian sync error:', error);
      return {
        success: false,
        message: `同步失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      };
    }
  }

  private generateSafeFileName(title: string, maxLength: number = 80): string {
    // 處理特殊字符，統一使用底線和英文風格
    let safeName = title
      .replace(/[<>:"/\\|?*]/g, '') // 移除文件系統禁止字符
      .replace(/'/g, '') // 移除單引號
      .replace(/\//g, '_') // 斜線改為底線
      .replace(/\s+/g, '_') // 所有空格改為底線
      .replace(/[-–—]+/g, '_') // 破折號改為底線
      .replace(/_+/g, '_') // 多個底線合併為一個
      .replace(/^_+|_+$/g, '') // 移除開頭和結尾的底線
      .trim();
    
    // 如果標題太長，智能截取
    if (safeName.length > maxLength) {
      // 優先在底線、句號處截斷
      const breakPoints = ['.', '_', '-'];
      let bestCutPoint = -1;
      
      for (const breakPoint of breakPoints) {
        const index = safeName.lastIndexOf(breakPoint, maxLength - 1);
        if (index > maxLength * 0.6) { // 確保截取點不會太早
          bestCutPoint = index;
          break;
        }
      }
      
      if (bestCutPoint > 0) {
        safeName = safeName.substring(0, bestCutPoint);
      } else {
        // 直接截取
        safeName = safeName.substring(0, maxLength);
      }
    }
    
    return safeName;
  }

  private generatePaperMarkdown(node: GraphData['nodes'][0], graphData: GraphData): string {
    const incomingEdges = graphData.edges.filter(edge => edge.target === node.id);
    const outgoingEdges = graphData.edges.filter(edge => edge.source === node.id);

    // Generate YAML frontmatter with Juggl and Dataview compatibility
    const authors = node.authors.length > 0 ? node.authors : ['Unknown'];
    const authorsYaml = authors.map(author => `  - "${author}"`).join('\n');
    
    // Build outgoing links for Juggl
    const outgoingLinks = outgoingEdges.map(edge => {
      const targetNode = graphData.nodes.find(n => n.id === edge.target);
      return targetNode?.title || 'Unknown';
    });
    
    // Build incoming links for graph view
    const incomingLinks = incomingEdges.map(edge => {
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      return sourceNode?.title || 'Unknown';
    });
    
    return `---
title: "${node.title}"
year: ${node.year || 'Unknown'}
authors:
${authorsYaml}
tags: [Paper, Research]
cssclasses: [juggl-node-paper]
url: "${node.url || ''}"
abstract: "${(node.abstract || '').replace(/"/g, '\\"')}"
outgoing:: [${outgoingLinks.map(title => `"${title}"`).join(', ')}]
incoming:: [${incomingLinks.map(title => `"${title}"`).join(', ')}]
---

# ${node.title}

## Abstract
${node.abstract || '無摘要資訊'}

---

## Relationships

### Cites (Outgoing Links)
${outgoingEdges.length > 0 ? outgoingEdges.map(edge => {
  const targetNode = graphData.nodes.find(n => n.id === edge.target);
  const sanitizedTitle = targetNode?.title || 'Unknown';
  const relationshipType = edge.relationship || 'references';
  const context = edge.evidence || 'Context not available';
  const explanation = edge.description || 'Relationship explanation not available';
  
  return `- **[[${sanitizedTitle}]]**
  - type:: \`${relationshipType}\`
  - strength:: ${edge.strength || 0.5}
  - context:: "${context.replace(/"/g, '\\"')}"
  - explanation:: "${explanation.replace(/"/g, '\\"')}"`;
}).join('\n') : '- No outgoing citations found'}

### Cited By (Incoming Links)
${incomingEdges.length > 0 ? incomingEdges.map(edge => {
  const sourceNode = graphData.nodes.find(n => n.id === edge.source);
  const sanitizedTitle = sourceNode?.title || 'Unknown';
  const relationshipType = edge.relationship || 'references';
  const context = edge.evidence || 'Context not available';
  const explanation = edge.description || 'Relationship explanation not available';
  
  return `- **[[${sanitizedTitle}]]**
  - type:: \`${relationshipType}\`
  - strength:: ${edge.strength || 0.5}
  - context:: "${context.replace(/"/g, '\\"')}"
  - explanation:: "${explanation.replace(/"/g, '\\"')}"`;
}).join('\n') : '- No incoming citations found'}

---

## Metadata
- **Papers Count**: ${graphData.nodes.length}
- **Relationships Count**: ${graphData.edges.length}
- **Generated**: ${new Date().toISOString()}

## My Notes
<!-- 此處留給使用者手動添加筆記 -->

---
*Auto-generated at ${new Date().toLocaleString('zh-TW')}*
`;
  }

  private generateGraphOverview(graphData: GraphData, graphName: string): string {
    return `---
title: "${graphName}"
type: "Knowledge Graph Overview"
tags: [Graph, Overview, Research]
cssclasses: [juggl-graph-overview]
papers_count: ${graphData.nodes.length}
relationships_count: ${graphData.edges.length}
generated_date: "${new Date().toISOString()}"
---

# ${graphName}

## 📊 Graph Statistics
- **Papers Count**: ${graphData.nodes.length}
- **Relationships Count**: ${graphData.edges.length}
- **Generated**: ${new Date().toLocaleString('zh-TW')}

## 📚 Papers in This Graph
\`\`\`dataview
TABLE 
  authors as "Authors",
  year as "Year",
  length(file.outlinks) as "Citations Out",
  length(file.inlinks) as "Citations In"
FROM #Paper 
SORT year DESC
\`\`\`

### Paper List
${graphData.nodes.map(node => {
  const year = node.year ? `(${node.year})` : '';
  const authors = node.authors.length > 0 ? node.authors.join(', ') : 'Unknown';
  return `- **[[${node.title}]]** ${year} - ${authors}`;
}).join('\n')}

## 🔗 Relationship Analysis

### Relationship Type Distribution
${this.getRelationshipStats(graphData)}

### Detailed Relationships
\`\`\`dataview
TABLE 
  file.link as "Source Paper",
  choice(type, type, "references") as "Relationship Type",
  strength as "Strength"
FROM [[]]
WHERE contains(tags, "Paper")
FLATTEN file.outlinks as outlink
FLATTEN outlink.type as type
FLATTEN outlink.strength as strength
SORT strength DESC
\`\`\`

## 🎨 Interactive Visualization

### Mermaid Network Diagram
\`\`\`mermaid
graph TD
${graphData.edges.map(edge => {
  const sourceNode = graphData.nodes.find(n => n.id === edge.source);
  const targetNode = graphData.nodes.find(n => n.id === edge.target);
  const sourceLabel = this.sanitizeNodeId(sourceNode?.title || String(edge.source));
  const targetLabel = this.sanitizeNodeId(targetNode?.title || String(edge.target));
  const sourceTitle = this.truncateTitle(sourceNode?.title || 'Unknown', 30);
  const targetTitle = this.truncateTitle(targetNode?.title || 'Unknown', 30);
  const relationshipLabel = edge.relationship || 'related';
  const strength = edge.strength || 0.5;
  const edgeStyle = strength > 0.7 ? 'stroke-width:3px' : strength > 0.4 ? 'stroke-width:2px' : 'stroke-width:1px';
  return `    ${sourceLabel}["${sourceTitle}"] -->|${relationshipLabel}| ${targetLabel}["${targetTitle}"]
    style ${sourceLabel} fill:#64c864,stroke:#2d5016,stroke-width:2px
    style ${targetLabel} fill:#64c864,stroke:#2d5016,stroke-width:2px`;
}).join('\n')}

classDef paper fill:#64c864,stroke:#2d5016,stroke-width:2px,color:#fff
classDef cited fill:#7b68ee,stroke:#4b0082,stroke-width:2px,color:#fff
\`\`\`

### Obsidian Graph View
> **Tip**: Open this note in Obsidian and use the built-in Graph View (Ctrl+G / Cmd+G) to see an interactive visualization of all paper relationships. The graph will automatically show connections based on the \`[[links]]\` in each paper file.

### Juggl Interactive Graph
\`\`\`juggl
${graphData.nodes.map(node => {
  const nodeId = this.sanitizeNodeId(node.title);
  const outgoing = graphData.edges
    .filter(e => e.source === node.id)
    .map(e => {
      const target = graphData.nodes.find(n => n.id === e.target);
      return target ? this.sanitizeNodeId(target.title) : null;
    })
    .filter(Boolean)
    .join(',');
  return `  ${nodeId} -> {${outgoing}}`;
}).filter(line => line.includes('->')).join('\n')}
\`\`\`

## 📋 Relationship Details
${graphData.edges.map((edge, index) => {
  console.log(`Edge ${index}: source=${edge.source}, target=${edge.target}`);
  console.log('Available node IDs:', graphData.nodes.map(n => n.id));
  
  const sourceNode = graphData.nodes.find(n => n.id === edge.source);
  const targetNode = graphData.nodes.find(n => n.id === edge.target);
  
  console.log(`Found sourceNode: ${sourceNode?.title}, targetNode: ${targetNode?.title}`);
  
  const sourceTitle = sourceNode?.title || `Unknown (ID: ${edge.source})`;
  const targetTitle = targetNode?.title || `Unknown (ID: ${edge.target})`;
  const strength = edge.strength ? ` (強度: ${edge.strength.toFixed(2)})` : '';
  const evidence = edge.evidence ? `\n  - **Evidence**: ${edge.evidence}` : '';
  const description = edge.description ? `\n  - **Description**: ${edge.description}` : '';
  
  return `### Relationship ${index + 1}: ${edge.relationship}
- **Source**: [[${sourceTitle}]]
- **Target**: [[${targetTitle}]]${strength}${evidence}${description}`;
}).join('\n\n')}

## 🎯 Juggl Configuration
> **For Juggl Plugin**: 
> - Install the [Juggl plugin](https://github.com/HEmile/juggl) from Obsidian Community Plugins
> - Node styles are defined via \`cssclasses: [juggl-node-paper]\`
> - Relationship types are stored in \`type::\` fields
> - Strength values are available in \`strength::\` fields
> - Use the Juggl code block above to render an interactive graph view
> - Click on any paper node to see its details and relationships

### How to View the Graph:
1. **Obsidian Native Graph View**: Press \`Ctrl+G\` (Windows/Linux) or \`Cmd+G\` (Mac) to open the global graph view
2. **Juggl Plugin**: Install Juggl from Community Plugins, then open this note to see the interactive graph
3. **Mermaid Diagram**: The Mermaid diagram above renders automatically in Obsidian

## 📝 My Analysis Notes
<!-- Add your manual analysis and insights here -->

---
*Knowledge graph auto-generated on ${new Date().toLocaleString('zh-TW')}*
*Compatible with Obsidian Juggl & Dataview plugins*
`;
  }

  private getRelationshipStats(graphData: GraphData): string {
    const relationshipCounts: { [key: string]: number } = {};
    
    graphData.edges.forEach(edge => {
      relationshipCounts[edge.relationship] = (relationshipCounts[edge.relationship] || 0) + 1;
    });

    return Object.entries(relationshipCounts)
      .map(([type, count]) => `- **${type}**: ${count}`)
      .join('\n');
  }

  private truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
  }

  private sanitizeNodeId(title: string | undefined): string {
    if (!title || typeof title !== 'string') {
      return 'unknown';
    }
    return title
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '')
      .substring(0, 10);
  }

  getVaultPath(): string {
    return this.obsidianVaultPath;
  }

  /**
   * Generate ZIP file with all Obsidian markdown files
   * This is useful for deployment scenarios where direct file system access is not available
   */
  async generateZipFile(graphData: GraphData, graphName: string = 'Paper Graph'): Promise<{
    success: boolean;
    message: string;
    zipBuffer?: Buffer;
    fileName?: string;
  }> {
    return new Promise((resolve, reject) => {
      try {
        // Create a temporary directory structure in memory
        const tempDir = path.join(process.cwd(), 'temp_obsidian_export');
        const paperFolderPath = path.join(tempDir, this.paperFolderName);
        const graphFolderPath = path.join(tempDir, this.graphFolderName);
        
        // Clean up temp dir if it exists
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        this.ensureDirectoryExists(paperFolderPath);
        this.ensureDirectoryExists(graphFolderPath);

        // Create individual paper files
        for (const node of graphData.nodes) {
          const paperContent = this.generatePaperMarkdown(node, graphData);
          const safeFileName = this.generateSafeFileName(node.title);
          const paperFilePath = path.join(paperFolderPath, `${safeFileName}.md`);
          fs.writeFileSync(paperFilePath, paperContent, 'utf8');
        }

        // Create overview file
        const timestamp = new Date().toISOString().split('T')[0];
        const overviewContent = this.generateGraphOverview(graphData, graphName);
        const safeGraphName = this.generateSafeFileName(graphName, 30);
        const overviewFileName = `${safeGraphName}_${timestamp}.md`;
        const overviewFilePath = path.join(graphFolderPath, overviewFileName);
        fs.writeFileSync(overviewFilePath, overviewContent, 'utf8');

        // Create ZIP file
        const zipFileName = `${safeGraphName}_${timestamp}.zip`;
        const output = fs.createWriteStream(path.join(tempDir, zipFileName));
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });

        output.on('close', () => {
          const zipBuffer = fs.readFileSync(path.join(tempDir, zipFileName));
          
          // Clean up temp directory
          fs.rmSync(tempDir, { recursive: true, force: true });
          
          resolve({
            success: true,
            message: `ZIP 文件生成成功: ${graphData.nodes.length} 篇論文, ${graphData.edges.length} 個關係`,
            zipBuffer,
            fileName: zipFileName
          });
        });

        archive.on('error', (err: Error) => {
          // Clean up on error
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
          reject(err);
        });

        archive.pipe(output);
        
        // Add files to archive
        archive.directory(paperFolderPath, this.paperFolderName);
        archive.directory(graphFolderPath, this.graphFolderName);
        
        archive.finalize();
      } catch (error) {
        console.error('ZIP generation error:', error);
        reject(error);
      }
    });
  }
}
