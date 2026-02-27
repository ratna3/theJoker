/**
 * MonacoEditor — Monaco editor wrapper with custom theme
 */

import React, { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { useEditorStore, useSettingsStore } from '../../store';

interface Props {
    filePath: string;
    language: string;
    content: string;
    tabId: string;
}

export const MonacoEditor: React.FC<Props> = ({ filePath, language, content, tabId }) => {
    const { updateContent, saveFile } = useEditorStore();
    const { editorFontSize, editorFontFamily, tabSize, wordWrap, autoSave, showMinimap } = useSettingsStore();
    const editorRef = useRef<any>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        // Define custom dark theme
        monaco.editor.defineTheme('vibe-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'c084fc' },
                { token: 'string', foreground: '34d399' },
                { token: 'number', foreground: 'fbbf24' },
                { token: 'type', foreground: '60a5fa' },
                { token: 'function', foreground: '818cf8' },
                { token: 'variable', foreground: 'e2e8f0' },
                { token: 'constant', foreground: 'f59e0b' },
                { token: 'tag', foreground: 'ef4444' },
                { token: 'attribute.name', foreground: 'a78bfa' },
                { token: 'attribute.value', foreground: '34d399' },
                { token: 'delimiter', foreground: '94a3b8' },
                { token: 'operator', foreground: '06b6d4' },
            ],
            colors: {
                'editor.background': '#1a1a2e',
                'editor.foreground': '#e2e8f0',
                'editor.lineHighlightBackground': '#2d2d4e40',
                'editor.selectionBackground': '#7c3aed40',
                'editor.inactiveSelectionBackground': '#7c3aed20',
                'editorCursor.foreground': '#7c3aed',
                'editorLineNumber.foreground': '#64748b',
                'editorLineNumber.activeForeground': '#a78bfa',
                'editorIndentGuide.background': '#2d2d4e50',
                'editorIndentGuide.activeBackground': '#2d2d4e',
                'editorBracketMatch.background': '#7c3aed30',
                'editorBracketMatch.border': '#7c3aed50',
                'editorGutter.background': '#1a1a2e',
                'scrollbar.shadow': '#00000000',
                'scrollbarSlider.background': '#2d2d4e80',
                'scrollbarSlider.hoverBackground': '#2d2d4ea0',
                'scrollbarSlider.activeBackground': '#7c3aed60',
                'editorWidget.background': '#12122a',
                'editorWidget.border': '#2d2d4e',
                'editorSuggestWidget.background': '#12122a',
                'editorSuggestWidget.border': '#2d2d4e',
                'editorSuggestWidget.selectedBackground': '#7c3aed30',
                'editorHoverWidget.background': '#12122a',
                'editorHoverWidget.border': '#2d2d4e',
                'minimap.background': '#12122a',
            },
        });

        monaco.editor.setTheme('vibe-dark');
        editor.focus();

        // Save keyboard shortcut
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            saveFile(tabId);
        });
    };

    const handleChange: OnChange = useCallback((value) => {
        if (value !== undefined) {
            updateContent(tabId, value);

            // Auto-save with debounce
            if (autoSave) {
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = setTimeout(() => {
                    saveFile(tabId);
                }, 1000);
            }
        }
    }, [tabId, updateContent, saveFile, autoSave]);

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    return (
        <Editor
            height="100%"
            language={language}
            value={content}
            onChange={handleChange}
            onMount={handleMount}
            theme="vibe-dark"
            loading={
                <div className="flex items-center justify-center h-full bg-app-panel">
                    <div className="text-app-textMuted text-sm">Loading editor...</div>
                </div>
            }
            options={{
                minimap: { enabled: showMinimap, side: 'right' },
                fontSize: editorFontSize,
                fontFamily: `${editorFontFamily}, monospace`,
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize,
                insertSpaces: true,
                wordWrap: wordWrap ? 'on' : 'off',
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
                suggest: { showKeywords: true },
                formatOnPaste: true,
                formatOnType: false,
                smoothScrolling: true,
                padding: { top: 8 },
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                renderWhitespace: 'selection',
            }}
        />
    );
};
