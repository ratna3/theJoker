/**
 * TerminalTab — Single xterm.js terminal instance
 */

import React, { useRef, useEffect } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface Props {
    sessionId: string;
}

export const TerminalTab: React.FC<Props> = ({ sessionId }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!containerRef.current || initializedRef.current) return;
        initializedRef.current = true;

        const term = new Terminal({
            theme: {
                background: '#0d0d1a',
                foreground: '#e2e8f0',
                cursor: '#7c3aed',
                cursorAccent: '#0d0d1a',
                selectionBackground: '#7c3aed40',
                black: '#1a1a2e',
                brightBlack: '#2d2d4e',
                red: '#ef4444',
                brightRed: '#f87171',
                green: '#10b981',
                brightGreen: '#34d399',
                yellow: '#f59e0b',
                brightYellow: '#fbbf24',
                blue: '#3b82f6',
                brightBlue: '#60a5fa',
                magenta: '#7c3aed',
                brightMagenta: '#a78bfa',
                cyan: '#06b6d4',
                brightCyan: '#22d3ee',
                white: '#e2e8f0',
                brightWhite: '#f8fafc',
            },
            fontFamily: 'JetBrains Mono, Fira Code, Cascadia Code, monospace',
            fontSize: 13,
            lineHeight: 1.4,
            cursorBlink: true,
            cursorStyle: 'bar',
            scrollback: 5000,
            allowTransparency: true,
            convertEol: true,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);

        term.open(containerRef.current);
        fitAddon.fit();

        terminalRef.current = term;
        fitAddonRef.current = fitAddon;

        // Create PTY process
        window.electronAPI?.terminal?.create(sessionId).then((result) => {
            if (!result.success) {
                term.writeln(`\x1b[31mFailed to start terminal: ${result.error}\x1b[0m`);
            }
        });

        // Listen for PTY data → write to xterm
        const removeDataListener = window.electronAPI?.terminal?.onData(sessionId, (data) => {
            term.write(data);
        });

        // Listen for PTY exit
        const removeExitListener = window.electronAPI?.terminal?.onExit(sessionId, (exitCode) => {
            term.writeln(`\r\n\x1b[90mProcess exited with code ${exitCode}\x1b[0m`);
        });

        // xterm input → write to PTY
        const dataDisposable = term.onData((data) => {
            window.electronAPI?.terminal?.write(sessionId, data);
        });

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            try {
                fitAddon.fit();
                const dims = fitAddon.proposeDimensions();
                if (dims) {
                    window.electronAPI?.terminal?.resize(sessionId, dims.cols, dims.rows);
                }
            } catch { }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            dataDisposable.dispose();
            removeDataListener?.();
            removeExitListener?.();
            term.dispose();
            window.electronAPI?.terminal?.destroy(sessionId);
            initializedRef.current = false;
        };
    }, [sessionId]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full"
            style={{ padding: '4px 0 0 4px' }}
        />
    );
};
