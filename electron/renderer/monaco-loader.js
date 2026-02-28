/**
 * Monaco Editor AMD Loader for The Joker
 * Loads Monaco via its built-in AMD require and exposes a helper API.
 */

// eslint-disable-next-line no-unused-vars
const MonacoLoader = {
    _monaco: null,
    _ready: null,

    /**
     * Initialise Monaco AMD loader and resolve when ready.
     * Call once at app boot; subsequent calls return the cached promise.
     */
    init() {
        if (this._ready) return this._ready;

        this._ready = new Promise((resolve, reject) => {
            // Locate the monaco-editor package inside node_modules
            const script = document.createElement('script');
            script.src = '../node_modules/monaco-editor/min/vs/loader.js';
            script.onload = () => {
                // Configure AMD paths
                // @ts-ignore — require is injected by loader.js
                require.config({
                    paths: { vs: '../node_modules/monaco-editor/min/vs' },
                });

                // @ts-ignore
                require(['vs/editor/editor.main'], () => {
                    // @ts-ignore
                    this._monaco = monaco;
                    this._configureTheme();
                    resolve(this._monaco);
                });
            };
            script.onerror = () => reject(new Error('Failed to load Monaco loader'));
            document.head.appendChild(script);
        });

        return this._ready;
    },

    /**
     * Register the custom Joker Dark theme.
     */
    _configureTheme() {
        this._monaco.editor.defineTheme('joker-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6a6a8e', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'c792ea' },
                { token: 'string', foreground: 'c3e88d' },
                { token: 'number', foreground: 'f78c6c' },
                { token: 'type', foreground: 'ffcb6b' },
                { token: 'function', foreground: '82aaff' },
                { token: 'variable', foreground: 'eeffff' },
            ],
            colors: {
                'editor.background': '#0d0d1a',
                'editor.foreground': '#e0e0f0',
                'editor.lineHighlightBackground': '#1a1a2e',
                'editor.selectionBackground': '#2a2a4a',
                'editorCursor.foreground': '#00ff88',
                'editorLineNumber.foreground': '#444466',
                'editorLineNumber.activeForeground': '#888899',
                'editor.inactiveSelectionBackground': '#1a1a2e',
            },
        });
    },

    /**
     * Create an editor instance inside a container element.
     * @param {HTMLElement} container
     * @param {string} value — initial content
     * @param {string} language — e.g. 'javascript', 'html', 'css'
     * @returns {any} Monaco editor instance
     */
    createEditor(container, value = '', language = 'javascript') {
        return this._monaco.editor.create(container, {
            value,
            language,
            theme: 'joker-dark',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            bracketPairColorization: { enabled: true },
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            wordWrap: 'on',
            tabSize: 2,
            readOnly: true,
        });
    },

    /**
     * Infer Monaco language from a file path.
     * @param {string} filePath
     * @returns {string}
     */
    getLanguage(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const map = {
            js: 'javascript', jsx: 'javascript',
            ts: 'typescript', tsx: 'typescript',
            html: 'html', htm: 'html',
            css: 'css', scss: 'scss', less: 'less',
            json: 'json',
            md: 'markdown',
            py: 'python',
            sh: 'shell', bash: 'shell',
            yml: 'yaml', yaml: 'yaml',
            xml: 'xml', svg: 'xml',
            sql: 'sql',
            rs: 'rust',
            go: 'go',
            java: 'java',
            c: 'c', cpp: 'cpp', h: 'c',
        };
        return map[ext] || 'plaintext';
    },
};
