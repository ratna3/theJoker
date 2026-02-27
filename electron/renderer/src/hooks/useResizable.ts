/**
 * useResizable — Hook for resizable panel logic
 */

import { useState, useCallback } from 'react';

interface UseResizableOptions {
    defaultSize: number;
    minSize: number;
    maxSize: number;
    direction: 'horizontal' | 'vertical';
    storageKey?: string;
}

export function useResizable(options: UseResizableOptions) {
    const { defaultSize, minSize, maxSize, storageKey } = options;

    const [size, setSize] = useState(() => {
        if (storageKey) {
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) return Math.max(minSize, Math.min(maxSize, parseInt(saved)));
            } catch { }
        }
        return defaultSize;
    });

    const handleResize = useCallback((delta: number) => {
        setSize((prev) => {
            const next = Math.max(minSize, Math.min(maxSize, prev + delta));
            if (storageKey) localStorage.setItem(storageKey, String(next));
            return next;
        });
    }, [minSize, maxSize, storageKey]);

    return { size, handleResize, setSize };
}
