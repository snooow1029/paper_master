import React, { useState } from 'react';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';

interface ProgressUpdate {
  progress: number;
  step?: string;
  currentStep?: string;
  details?: string;
  metadata?: Record<string, any>;
}

interface AnalysisProgressProps {
  progress: number;
  progressInfo?: ProgressUpdate;
  isOverlay?: boolean; // 是否為覆蓋模式（半透明）
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ 
  progress, 
  progressInfo,
  isOverlay = false 
}) => {
  const [expanded, setExpanded] = useState(false);

  const stepLabels: Record<string, string> = {
    'initializing': 'Initializing',
    'extracting': 'Extracting Papers',
    'analyzing': 'Analyzing Relationships',
    'building': 'Building Graph'
  };

  const currentStepLabel = progressInfo?.step ? stepLabels[progressInfo.step] || progressInfo.step : '';
  const currentStep = progressInfo?.currentStep || 'Processing...';
  const details = progressInfo?.details || '';

  const containerStyle: React.CSSProperties = {
    position: isOverlay ? 'absolute' : 'relative',
    top: isOverlay ? '20px' : 'auto',
    left: isOverlay ? '20px' : 'auto',
    right: isOverlay ? '20px' : 'auto',
    zIndex: isOverlay ? 1000 : 'auto',
    backgroundColor: isOverlay 
      ? 'rgba(30, 30, 30, 0.95)' // Obsidian 深色背景，高透明度
      : '#1e1e1e', // Obsidian 深色背景（非覆蓋模式）
    backdropFilter: isOverlay ? 'blur(8px)' : 'none',
    padding: isOverlay ? '24px' : '20px',
    borderRadius: isOverlay ? '12px' : '8px',
    margin: isOverlay ? '0' : '0 0 20px 0',
    color: '#e8e8e8', // Obsidian 淺色文字
    minHeight: isOverlay ? 'auto' : '140px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: isOverlay 
      ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
      : '0 2px 8px rgba(0, 0, 0, 0.2)',
    border: isOverlay ? '1px solid rgba(100, 200, 100, 0.2)' : '1px solid rgba(100, 200, 100, 0.1)'
  };

  const progressBarStyle: React.CSSProperties = {
    width: '100%',
    height: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Obsidian 風格深色背景
    borderRadius: '6px',
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid rgba(100, 200, 100, 0.2)'
  };

  const progressFillStyle: React.CSSProperties = {
    width: `${progress}%`,
    height: '100%',
    background: 'linear-gradient(90deg, #64c864 0%, #4ade80 50%, #22c55e 100%)', // Obsidian 綠色漸變
    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '6px',
    boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)', // 綠色光暈效果
    position: 'relative'
  };

  return (
    <div style={containerStyle}>
      {/* 主要進度信息 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '17px', 
            fontWeight: 600, 
            marginBottom: '6px',
            color: '#e8e8e8', // Obsidian 淺色文字
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: '0.3px'
          }}>
            {currentStepLabel && `${currentStepLabel}...`}
            {!currentStepLabel && 'Analyzing Papers...'}
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: 'rgba(232, 232, 232, 0.9)', // Obsidian 次要文字，提高對比度
            marginBottom: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            lineHeight: '1.6',
            fontWeight: 500 // 稍微加粗以提高可讀性
          }}>
            {currentStep}
          </div>
        </div>
        <div style={{ 
          fontSize: '20px', 
          fontWeight: 700,
          color: '#64c864', // Obsidian 綠色強調
          minWidth: '60px',
          textAlign: 'right',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: '0.5px'
        }}>
          {Math.round(progress)}%
        </div>
      </div>

      {/* 進度條 */}
      <div style={progressBarStyle}>
        <div style={progressFillStyle} />
      </div>

      {/* 詳細信息（可展開） */}
      {details && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: 'rgba(232, 232, 232, 0.7)', // Obsidian 次要文字
              cursor: 'pointer',
              fontSize: '13px',
              padding: '6px 0',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#64c864'; // Hover 時變綠色
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(232, 232, 232, 0.7)';
            }}
          >
            {expanded ? <ExpandLessIcon style={{ fontSize: '16px' }} /> : <ExpandMoreIcon style={{ fontSize: '16px' }} />}
            {expanded ? 'Hide Details' : 'Show Details'}
          </button>
          {expanded && (
            <div style={{
              marginTop: '10px',
              padding: '14px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)', // Obsidian 深色背景
              borderRadius: '8px',
              fontSize: '13px',
              color: 'rgba(232, 232, 232, 0.85)',
              lineHeight: '1.7',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              border: '1px solid rgba(100, 200, 100, 0.15)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {details}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalysisProgress;

