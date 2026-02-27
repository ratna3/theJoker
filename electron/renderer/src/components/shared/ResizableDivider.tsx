/**
 * ResizableDivider — Draggable resize handle between panels
 */

import React, { useCallback, useRef, useEffect } from 'react';

interface Props {
    direction: 'horizontal' | 'vertical';
    onResize: (delta: number) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
}

export const ResizableDivider: React.FC<Props> = ({ direction, onResize, onResizeStart, onResizeEnd }) => {
    const isDragging = useRef(false);
    const lastPos = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
        onResizeStart?.();
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
    }, [direction, onResizeStart]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
            const delta = currentPos - lastPos.current;
            lastPos.current = currentPos;
            onResize(delta);
        };

        const handleMouseUp = () => {
            if (isDragging.current) {
                isDragging.current = false;
                onResizeEnd?.();
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [direction, onResize, onResizeEnd]);

    return (
        <div
            onMouseDown={handleMouseDown}
            className={`
        flex-shrink-0 relative z-10 group
        ${direction === 'horizontal'
                    ? 'w-[3px] cursor-col-resize hover:w-[5px]'
                    : 'h-[3px] cursor-row-resize hover:h-[5px]'
                }
        bg-app-border transition-all duration-150
        hover:bg-app-accent
        active:bg-app-accent
      `}
        >
            <div className={`
        absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity
        ${direction === 'horizontal'
                    ? 'w-[5px] -left-[1px]'
                    : 'h-[5px] -top-[1px]'
                }
        bg-app-accent/30
      `} />
        </div>
    );
};
