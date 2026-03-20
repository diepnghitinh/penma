'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  side,
  defaultWidth,
  minWidth = 180,
  maxWidth = 480,
  className = '',
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = side === 'left'
        ? startWidth.current + delta
        : startWidth.current - delta;
      setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [side, minWidth, maxWidth]);

  return (
    <div className={`flex flex-shrink-0 ${className}`} style={{ width, zIndex: 'var(--z-sidebar)', position: 'relative' }}>
      {/* Handle on left side for right panels */}
      {side === 'right' && (
        <div className="penma-resize-handle" onMouseDown={handleMouseDown} />
      )}

      <div
        data-panel={side}
        className="flex-1 overflow-hidden bg-[var(--penma-surface)] penma-scrollbar"
      >
        {children}
      </div>

      {/* Handle on right side for left panels */}
      {side === 'left' && (
        <div className="penma-resize-handle" onMouseDown={handleMouseDown} />
      )}
    </div>
  );
};
