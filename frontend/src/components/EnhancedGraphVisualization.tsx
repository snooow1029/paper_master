/**
 * Enhanced Graph Visualization Component - Simplified Version
 * 使用深度論文關係分析的增強圖可視化組件（簡化版）
 */

import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface DeepRelationshipEdge {
  source: string;
  target: string;
  relationship: string;
  strength: number;
  evidence: string;
  description: string;
  analysisDetails: {
    discourseDimensions: {
      methodological: { strength: number; description: string };
      theoretical: { strength: number; description: string };
      empirical: { strength: number; description: string };
      comparative: { strength: number; description: string };
    };
    citationPattern: {
      frequency: number;
      distribution: string;
      prominence: number;
      context_diversity: number;
    };
    semanticRelation: {
      agreement: number;
      novelty: number;
      dependency: number;
      complementarity: number;
    };
    keyEvidence: Array<{
      text: string;
      section: string;
      importance: number;
      evidence_type: string;
    }>;
  };
}

interface EnhancedPaperNode {
  id: string;
  title: string;
  authors: string[];
  year: string;
  abstract?: string;
  venue?: string;
  category?: string;
  structuredAnalysis?: {
    contributions: string[];
    limitations: string[];
    methodology: string;
    novelty_score: number;
    influence_score: number;
  };
}

interface EnhancedPaperGraph {
  nodes: EnhancedPaperNode[];
  edges: DeepRelationshipEdge[];
  graphMetrics: {
    totalNodes: number;
    totalEdges: number;
    averageRelationshipStrength: number;
    dominantRelationshipTypes: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    semanticClusters: Array<{
      name: string;
      papers: string[];
      centralPaper: string;
      avgInternalStrength: number;
    }>;
    influenceRanking: Array<{
      paperId: string;
      influenceScore: number;
      incomingConnections: number;
      outgoingConnections: number;
    }>;
  };
}

const EnhancedGraphVisualization: React.FC = () => {
  const [paperUrls, setPaperUrls] = useState<string[]>(['']);
  const [graph, setGraph] = useState<EnhancedPaperGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DeepRelationshipEdge | null>(null);
  const [selectedNode, setSelectedNode] = useState<EnhancedPaperNode | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // 添加新的論文URL輸入框
  const addPaperUrl = () => {
    if (paperUrls.length < 10) {
      setPaperUrls([...paperUrls, '']);
    }
  };

  // 移除論文URL輸入框
  const removePaperUrl = (index: number) => {
    if (paperUrls.length > 1) {
      const newUrls = paperUrls.filter((_, i) => i !== index);
      setPaperUrls(newUrls);
    }
  };

  // 更新論文URL
  const updatePaperUrl = (index: number, url: string) => {
    const newUrls = [...paperUrls];
    newUrls[index] = url;
    setPaperUrls(newUrls);
  };

  // 構建增強圖
  const buildEnhancedGraph = async () => {
    const validUrls = paperUrls.filter(url => url.trim().length > 0);
    
    if (validUrls.length === 0) {
      setError('請至少輸入一個論文URL');
      return;
    }

    setLoading(true);
    setError(null);
    setGraph(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/enhanced-graph/build`, {
        papers: validUrls
      });

      if (response.data.success) {
        console.log('📊 Graph data received:', response.data.graph);
        console.log('📚 Nodes:', response.data.graph.nodes);
        response.data.graph.nodes.forEach((node: any, index: number) => {
          console.log(`Node ${index}:`, {
            id: node.id,
            title: node.title,
            authors: node.authors,
            year: node.year,
            venue: node.venue,
            citationCount: node.citationCount,
            citationCountType: typeof node.citationCount
          });
        });
        setGraph(response.data.graph);
      } else {
        setError(response.data.error || '構建圖失敗');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || '網絡錯誤');
    } finally {
      setLoading(false);
    }
  };

  // 檢查系統狀態
  const checkSystemStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/enhanced-graph/status`);
      setSystemStatus(response.data);
    } catch (err) {
      console.error('Failed to check system status:', err);
    }
  };

  // 格式化關係類型
  const formatRelationshipType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'builds_on': '基於構建',
      'extends': '擴展',
      'applies': '應用',
      'compares': '比較',
      'surveys': '綜述',
      'critiques': '批評'
    };
    return typeMap[type] || type;
  };

  // 獲取關係強度顏色
  const getRelationshipColor = (strength: number): string => {
    if (strength > 0.8) return '#d63031';      // 強關係 - 紅色
    if (strength > 0.6) return '#e17055';      // 中強關係 - 橙紅色
    if (strength > 0.4) return '#fdcb6e';      // 中等關係 - 黃色
    if (strength > 0.2) return '#a7e0a7';      // 弱關係 - 淺綠色
    return '#ddd';                             // 很弱關係 - 灰色
  };

  React.useEffect(() => {
    checkSystemStatus();
  }, []);

  return (
    <div className="enhanced-graph-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>🚀 深度論文關係分析</h2>
      
      {/* 系統狀態 */}
      {systemStatus && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '10px', 
          backgroundColor: systemStatus.status === 'healthy' ? '#d1f2eb' : '#fadbd8',
          borderRadius: '5px'
        }}>
          <strong>系統狀態: </strong>
          <span style={{ color: systemStatus.status === 'healthy' ? '#27ae60' : '#e74c3c' }}>
            {systemStatus.status === 'healthy' ? '🟢 正常' : '🔴 異常'}
          </span>
          {systemStatus.recommendations && systemStatus.recommendations.length > 0 && (
            <div style={{ marginTop: '5px', fontSize: '0.9em' }}>
              <strong>建議:</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {systemStatus.recommendations.map((rec: string, i: number) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 論文URL輸入 */}
      <div style={{ marginBottom: '20px' }}>
        <h3>📚 輸入論文URL (最多10篇):</h3>
        {paperUrls.map((url, index) => (
          <div key={index} style={{ display: 'flex', marginBottom: '10px', alignItems: 'center' }}>
            <input
              type="url"
              value={url}
              onChange={(e) => updatePaperUrl(index, e.target.value)}
              placeholder={`arXiv URL ${index + 1} (例如: https://arxiv.org/abs/2301.00001)`}
              style={{ 
                flex: 1, 
                padding: '8px', 
                marginRight: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            {paperUrls.length > 1 && (
              <button 
                onClick={() => removePaperUrl(index)}
                style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#e74c3c', 
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                移除
              </button>
            )}
          </div>
        ))}
        
        <div style={{ marginTop: '10px' }}>
          {paperUrls.length < 10 && (
            <button 
              onClick={addPaperUrl}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#3498db', 
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              + 添加論文
            </button>
          )}
          
          <button 
            onClick={buildEnhancedGraph}
            disabled={loading}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: loading ? '#95a5a6' : '#27ae60', 
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '🔄 分析中...' : '🚀 開始深度分析'}
          </button>
        </div>
      </div>

      {/* 加載狀態 */}
      {loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <div>🔄 正在進行深度分析...</div>
          <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
            這可能需要幾分鐘，我們正在：
            <ul style={{ textAlign: 'left', marginTop: '10px', maxWidth: '400px', margin: '10px auto' }}>
              <li>📄 使用GROBID解析PDF內容</li>
              <li>🔍 提取結構化論文信息</li>
              <li>🤖 使用LLM分析論文關係</li>
              <li>📊 計算關係強度和語義維度</li>
            </ul>
          </div>
        </div>
      )}

      {/* 錯誤信息 */}
      {error && (
        <div style={{ 
          backgroundColor: '#fadbd8', 
          color: '#c0392b', 
          padding: '15px', 
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <strong>❌ 錯誤:</strong> {error}
        </div>
      )}

      {/* 圖結果 */}
      {graph && (
        <div>
          {/* 圖指標總覽 */}
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '20px', 
            borderRadius: '5px',
            marginBottom: '20px'
          }}>
            <h3>📊 圖分析總覽</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <strong>論文數量:</strong> {graph.graphMetrics.totalNodes}
              </div>
              <div>
                <strong>關係數量:</strong> {graph.graphMetrics.totalEdges}
              </div>
              <div>
                <strong>平均關係強度:</strong> {graph.graphMetrics.averageRelationshipStrength.toFixed(3)}
              </div>
              <div>
                <strong>主要關係類型:</strong> {
                  graph.graphMetrics.dominantRelationshipTypes[0] ? 
                  `${formatRelationshipType(graph.graphMetrics.dominantRelationshipTypes[0].type)} (${graph.graphMetrics.dominantRelationshipTypes[0].percentage.toFixed(1)}%)` :
                  '無'
                }
              </div>
            </div>
          </div>

          {/* 論文節點 */}
          <div style={{ marginBottom: '20px' }}>
            <h3>📚 論文節點</h3>
            <div style={{ display: 'grid', gap: '15px' }}>
              {graph.nodes.map((node) => (
                <div 
                  key={node.id}
                  onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                  style={{ 
                    border: '1px solid #ddd', 
                    borderRadius: '5px', 
                    padding: '15px',
                    cursor: 'pointer',
                    backgroundColor: selectedNode?.id === node.id ? '#e3f2fd' : 'white'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                        {node.title}
                      </h4>
                      <p style={{ margin: '5px 0', color: '#7f8c8d', fontSize: '0.9em' }}>
                        <strong>作者:</strong> {
                          node.authors && node.authors.length > 0 
                            ? node.authors.join(', ') 
                            : '暫無作者信息'
                        }
                      </p>
                      <p style={{ margin: '5px 0', color: '#7f8c8d', fontSize: '0.9em' }}>
                        <strong>年份:</strong> {node.year} | <strong>類別:</strong> {node.category}
                      </p>
                    </div>
                    <div style={{ marginLeft: '15px', textAlign: 'center' }}>
                      {node.structuredAnalysis && (
                        <div>
                          <div style={{ fontSize: '0.8em', color: '#27ae60' }}>
                            新穎性: {(node.structuredAnalysis.novelty_score * 100).toFixed(0)}%
                          </div>
                          <div style={{ fontSize: '0.8em', color: '#3498db' }}>
                            影響力: {(node.structuredAnalysis.influence_score * 100).toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {selectedNode?.id === node.id && node.structuredAnalysis && (
                    <div style={{ 
                      marginTop: '15px', 
                      padding: '15px', 
                      backgroundColor: '#f8f9fa',
                      borderRadius: '5px'
                    }}>
                      <h5>🔬 深度分析結果:</h5>
                      
                      {node.structuredAnalysis.contributions.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <strong>主要貢獻:</strong>
                          <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                            {node.structuredAnalysis.contributions.map((contrib, i) => (
                              <li key={i} style={{ fontSize: '0.9em' }}>{contrib}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {node.structuredAnalysis.limitations.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <strong>局限性:</strong>
                          <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                            {node.structuredAnalysis.limitations.map((limit, i) => (
                              <li key={i} style={{ fontSize: '0.9em' }}>{limit}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {node.structuredAnalysis.methodology && (
                        <div>
                          <strong>方法論:</strong>
                          <p style={{ fontSize: '0.9em', margin: '5px 0' }}>
                            {node.structuredAnalysis.methodology}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 關係邊 */}
          {graph.edges.length > 0 && (
            <div>
              <h3>🔗 論文關係 ({graph.edges.length})</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {graph.edges.map((edge, index) => {
                  const sourceNode = graph.nodes.find(n => n.id === edge.source);
                  const targetNode = graph.nodes.find(n => n.id === edge.target);
                  
                  return (
                    <div 
                      key={index}
                      onClick={() => setSelectedEdge(selectedEdge === edge ? null : edge)}
                      style={{ 
                        border: '1px solid #ddd', 
                        borderRadius: '5px', 
                        padding: '15px',
                        cursor: 'pointer',
                        backgroundColor: selectedEdge === edge ? '#fff3cd' : 'white',
                        borderLeft: `4px solid ${getRelationshipColor(edge.strength)}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{sourceNode?.title.substring(0, 40)}...</strong>
                          <span style={{ margin: '0 10px', color: '#e67e22' }}>
                            {formatRelationshipType(edge.relationship)}
                          </span>
                          <strong>{targetNode?.title.substring(0, 40)}...</strong>
                        </div>
                        <div style={{ 
                          backgroundColor: getRelationshipColor(edge.strength),
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '3px',
                          fontSize: '0.8em'
                        }}>
                          {edge.strength.toFixed(3)}
                        </div>
                      </div>
                      
                      <p style={{ margin: '10px 0 0 0', color: '#666', fontSize: '0.9em' }}>
                        {edge.description}
                      </p>
                      
                      {selectedEdge === edge && (
                        <div style={{ 
                          marginTop: '15px', 
                          padding: '15px', 
                          backgroundColor: '#f8f9fa',
                          borderRadius: '5px'
                        }}>
                          <h5>🔍 詳細分析:</h5>
                          
                          {/* 論述維度 */}
                          <div style={{ marginBottom: '15px' }}>
                            <strong>論述維度分析:</strong>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '5px' }}>
                              <div>方法論: {(edge.analysisDetails.discourseDimensions.methodological.strength * 100).toFixed(0)}%</div>
                              <div>理論性: {(edge.analysisDetails.discourseDimensions.theoretical.strength * 100).toFixed(0)}%</div>
                              <div>實證性: {(edge.analysisDetails.discourseDimensions.empirical.strength * 100).toFixed(0)}%</div>
                              <div>比較性: {(edge.analysisDetails.discourseDimensions.comparative.strength * 100).toFixed(0)}%</div>
                            </div>
                          </div>
                          
                          {/* 引用模式 */}
                          <div style={{ marginBottom: '15px' }}>
                            <strong>引用模式:</strong>
                            <div style={{ marginTop: '5px', fontSize: '0.9em' }}>
                              頻率: {edge.analysisDetails.citationPattern.frequency} | 
                              分布: {edge.analysisDetails.citationPattern.distribution} | 
                              顯著性: {(edge.analysisDetails.citationPattern.prominence * 100).toFixed(0)}%
                            </div>
                          </div>
                          
                          {/* 語義關係 */}
                          <div style={{ marginBottom: '15px' }}>
                            <strong>語義關係:</strong>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '5px', marginTop: '5px', fontSize: '0.9em' }}>
                              <div>同意度: {(edge.analysisDetails.semanticRelation.agreement * 100).toFixed(0)}%</div>
                              <div>新穎性: {(edge.analysisDetails.semanticRelation.novelty * 100).toFixed(0)}%</div>
                              <div>依賴性: {(edge.analysisDetails.semanticRelation.dependency * 100).toFixed(0)}%</div>
                              <div>互補性: {(edge.analysisDetails.semanticRelation.complementarity * 100).toFixed(0)}%</div>
                            </div>
                          </div>
                          
                          {/* 關鍵證據 */}
                          {edge.analysisDetails.keyEvidence.length > 0 && (
                            <div>
                              <strong>關鍵證據:</strong>
                              <div style={{ marginTop: '5px' }}>
                                {edge.analysisDetails.keyEvidence.slice(0, 3).map((evidence, i) => (
                                  <div key={i} style={{ 
                                    margin: '5px 0', 
                                    padding: '8px', 
                                    backgroundColor: 'white',
                                    borderRadius: '3px',
                                    fontSize: '0.85em',
                                    border: '1px solid #eee'
                                  }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>
                                      {evidence.section} ({evidence.evidence_type})
                                    </div>
                                    <div>"{evidence.text.substring(0, 200)}..."</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 語義聚類 */}
          {graph.graphMetrics.semanticClusters.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3>🧩 語義聚類</h3>
              <div style={{ display: 'grid', gap: '15px' }}>
                {graph.graphMetrics.semanticClusters.map((cluster, index) => (
                  <div key={index} style={{ 
                    border: '1px solid #ddd', 
                    borderRadius: '5px', 
                    padding: '15px',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <h4>{cluster.name}</h4>
                    <p><strong>中心論文:</strong> {graph.nodes.find(n => n.id === cluster.centralPaper)?.title}</p>
                    <p><strong>包含論文:</strong> {cluster.papers.length}篇</p>
                    <p><strong>內部連接強度:</strong> {cluster.avgInternalStrength.toFixed(3)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 影響力排名 */}
          <div style={{ marginTop: '20px' }}>
            <h3>🏆 影響力排名</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {graph.graphMetrics.influenceRanking.slice(0, 5).map((ranking, index) => {
                const node = graph.nodes.find(n => n.id === ranking.paperId);
                return (
                  <div key={ranking.paperId} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '10px',
                    backgroundColor: index < 3 ? '#fff3cd' : '#f8f9fa',
                    borderRadius: '5px',
                    border: '1px solid #ddd'
                  }}>
                    <div style={{ 
                      marginRight: '15px', 
                      fontSize: '1.5em',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && `${index + 1}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong>{node?.title}</strong>
                      <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
                        影響力分數: {ranking.influenceScore.toFixed(3)} | 
                        被引用: {ranking.incomingConnections} | 
                        引用他人: {ranking.outgoingConnections}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedGraphVisualization;
