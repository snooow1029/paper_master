import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ResizableSidebarProps {
  children: React.ReactNode;
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  position: 'left' | 'right';
  collapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  onWidthChange?: (width: number) => void;
  collapsedWidth?: number;
  className?: string;
  collapsedButtonLabel?: string;
  collapsedButtonIcon?: React.ReactNode;
}

/**
 * Resizable Sidebar Component
 * Supports:
 * - Collapse/expand functionality
 * - Drag to resize width
 * - Position on left or right side
 */
const ResizableSidebar: React.FC<ResizableSidebarProps> = ({
  children,
  initialWidth,
  minWidth = 200,
  maxWidth = 600,
  position,
  collapsed,
  onCollapseChange,
  onWidthChange,
  collapsedWidth = 50,
  className = '',
  collapsedButtonLabel,
  collapsedButtonIcon,
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Update width when collapsed state changes
  useEffect(() => {
    if (collapsed) {
      setWidth(collapsedWidth);
    } else {
      setWidth(initialWidth);
    }
  }, [collapsed, collapsedWidth, initialWidth]);

  // Notify parent of width changes
  useEffect(() => {
    if (onWidthChange && !collapsed) {
      onWidthChange(width);
    }
  }, [width, collapsed, onWidthChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = position === 'left' 
      ? e.clientX - startXRef.current 
      : startXRef.current - e.clientX;
    
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + deltaX));
    setWidth(newWidth);
  }, [isResizing, position, minWidth, maxWidth]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const currentWidth = collapsed ? collapsedWidth : width;

  return (
    <div
      ref={sidebarRef}
      className={`relative flex flex-col overflow-hidden ${className}`}
      style={{
        width: `${currentWidth}px`,
        minWidth: collapsed ? `${collapsedWidth}px` : `${minWidth}px`,
        maxWidth: collapsed ? `${collapsedWidth}px` : `${maxWidth}px`,
        transition: isResizing ? 'none' : 'width 0.2s ease',
      }}
    >
      {/* Resize Handle */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 bottom-0 z-10 cursor-col-resize ${
            position === 'left' ? 'right-0' : 'left-0'
          }`}
          style={{
            width: '4px',
            backgroundColor: 'transparent',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(100, 200, 100, 0.5)';
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {/* Visual indicator */}
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '2px',
              height: '40px',
              backgroundColor: 'rgba(100, 200, 100, 0.3)',
              borderRadius: '1px',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}

      {/* Sidebar Content */}
      {collapsed ? (
        /* Collapsed state: Show button to expand */
        <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#252525' }}>
          <button
            onClick={() => onCollapseChange(false)}
            className="px-4 py-2 rounded-lg transition-all duration-200 flex flex-col items-center gap-2"
            style={{
              backgroundColor: '#2d2d2d',
              color: '#64c864',
              border: '1px solid rgba(100, 200, 100, 0.3)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 600,
              fontSize: '12px',
              minWidth: '40px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#252525';
              e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2d2d2d';
              e.currentTarget.style.borderColor = 'rgba(100, 200, 100, 0.3)';
            }}
            title={collapsedButtonLabel || 'Expand'}
          >
            {collapsedButtonIcon}
            {collapsedButtonLabel && (
              <span style={{ 
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
                fontSize: '11px',
                lineHeight: '1.2',
              }}>
                {collapsedButtonLabel}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="h-full overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
};

export default ResizableSidebar;

