import fs from 'fs';
import path from 'path';

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
    this.obsidianVaultPath = vaultPath;
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
    
    return `---
title: "${node.title}"
year: ${node.year || 'Unknown'}
authors:
${authorsYaml}
tags: [Paper, Research]
cssclasses: [juggl-node-paper]
url: "${node.url || ''}"
abstract: "${(node.abstract || '').replace(/"/g, '\\"')}"
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
  
  return `- **[[${sanitizedTitle}]]**
  - (關係的詳細定義在引用方的文件中)`;
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
  return `    ${sourceLabel}["${sourceTitle}"] -->|${relationshipLabel}| ${targetLabel}["${targetTitle}"]`;
}).join('\n')}

classDef paper fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
classDef cited fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
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
> - Node styles are defined via \`cssclasses: [juggl-node-paper]\`
> - Relationship types are stored in \`type::\` fields
> - Strength values are available in \`strength::\` fields

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
}
