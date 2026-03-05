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
                { token: 'keyword', foreground: '34d399' },
                { token: 'string', foreground: 'fbbf24' },
                { token: 'number', foreground: 'f59e0b' },
                { token: 'type', foreground: '60a5fa' },
                { token: 'function', foreground: '67e8f9' },
                { token: 'variable', foreground: 'e2e8f0' },
                { token: 'constant', foreground: 'fb923c' },
                { token: 'tag', foreground: 'ef4444' },
                { token: 'attribute.name', foreground: '5eead4' },
                { token: 'attribute.value', foreground: 'fbbf24' },
                { token: 'delimiter', foreground: '94a3b8' },
                { token: 'operator', foreground: '06b6d4' },
            ],
            colors: {
                'editor.background': '#151b18',
                'editor.foreground': '#e2e8f0',
                'editor.lineHighlightBackground': '#24302840',
                'editor.selectionBackground': '#00d47b40',
                'editor.inactiveSelectionBackground': '#00d47b20',
                'editorCursor.foreground': '#00d47b',
                'editorLineNumber.foreground': '#64748b',
                'editorLineNumber.activeForeground': '#34d399',
                'editorIndentGuide.background': '#24302850',
                'editorIndentGuide.activeBackground': '#243028',
                'editorBracketMatch.background': '#00d47b30',
                'editorBracketMatch.border': '#00d47b50',
                'editorGutter.background': '#151b18',
                'scrollbar.shadow': '#00000000',
                'scrollbarSlider.background': '#24302880',
                'scrollbarSlider.hoverBackground': '#243028a0',
                'scrollbarSlider.activeBackground': '#00d47b60',
                'editorWidget.background': '#0e1310',
                'editorWidget.border': '#243028',
                'editorSuggestWidget.background': '#0e1310',
                'editorSuggestWidget.border': '#243028',
                'editorSuggestWidget.selectedBackground': '#00d47b30',
                'editorHoverWidget.background': '#0e1310',
                'editorHoverWidget.border': '#243028',
                'minimap.background': '#0e1310',
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
