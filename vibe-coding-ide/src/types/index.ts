/**
 * Vibe Coding IDE — TypeScript Type Definitions
 * All shared interfaces and types used across the application
 */

// ── File System Types ──

export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    extension?: string;
    size?: number;
    modified?: string;
    children?: FileNode[];
    isExpanded?: boolean;
    depth: number;
    gitStatus?: GitStatus;
}

export type GitStatus = 'modified' | 'untracked' | 'deleted' | 'clean' | null;

export interface FileChangeEvent {
    type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
    path: string;
}

export interface FileReadResult {
    content: string | null;
    encoding: string;
    size: number;
    isBinary: boolean;
}

// ── Terminal Types ──

export interface TerminalSession {
    id: string;
    name: string;
    cwd: string;
    isActive: boolean;
    createdAt: number;
}

// ── Editor Types ──

export interface EditorTab {
    id: string;
    filePath: string;
    fileName: string;
    language: string;
    content: string;
    isModified: boolean;
    isActive: boolean;
}

export interface EditorState {
    openTabs: EditorTab[];
    activeTabId: string | null;
}

// ── Chat / AI Types ──

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    timestamp: number;
    isStreaming?: boolean;
    modifiedFiles?: string[];
    context?: ChatContext;
}

export interface ChatContext {
    filePath?: string;
    fileName?: string;
    selectedCode?: string;
    terminalErrors?: string;
}

export interface SlashCommand {
    name: string;
    description: string;
    icon: string;
}

export interface AIStreamConfig {
    messages: Array<{ role: ChatRole; content: string }>;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
    currentFile?: { path: string; content: string };
    selectedCode?: string;
    terminalErrors?: string;
    onToken: (token: string) => void;
    onComplete: (fullResponse: string) => void;
    onError: (error: string) => void;
}

// ── Build Pipeline Types ──

export type BuildStepStatus = 'pending' | 'running' | 'complete' | 'error';

export interface BuildStep {
    id: string;
    name: string;
    label: string;
    icon: string;
    status: BuildStepStatus;
    detail?: string;
    error?: string;
    startTime?: number;
    endTime?: number;
    logs?: string[];
}

export interface BuildPipelineState {
    steps: BuildStep[];
    isBuilding: boolean;
    currentProjectPath: string | null;
    overallProgress: number;
}

// ── Project Types ──

export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    features: string[];
    scaffoldCommand: string | null;
}

export interface ProjectConfig {
    name: string;
    description: string;
    template: string;
    targetDir: string;
    userPrompt: string;
}

export interface ProjectPlan {
    projectName: string;
    description: string;
    components: string[];
    pages: string[];
    features: string[];
    dependencies: string[];
    fileStructure: Array<{ path: string; purpose: string }>;
}

// ── Settings Types ──

export interface LMStudioConfig {
    url: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
}

export interface AppSettings {
    // AI
    lmStudioUrl: string;
    selectedModel: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    // Editor
    editorFontSize: number;
    editorFontFamily: string;
    tabSize: 2 | 4;
    wordWrap: boolean;
    autoSave: boolean;
    formatOnSave: boolean;
    showMinimap: boolean;
    // Terminal
    terminalFontSize: number;
    terminalScrollback: number;
    // Appearance
    uiScale: 'compact' | 'normal' | 'comfortable';
    showFileIcons: boolean;
    showIndentGuides: boolean;
    enableAnimations: boolean;
    // Project
    defaultProjectPath: string;
    defaultPackageManager: 'npm' | 'yarn' | 'pnpm';
    autoOpenBrowser: boolean;
}

// ── AI Action Types ──

export interface FileAction {
    type: 'file-write';
    filePath: string;
    content: string;
    language: string;
}

export interface TerminalAction {
    type: 'terminal-command';
    command: string;
}

export type AIAction = FileAction | TerminalAction;

export interface AIActionResult {
    action: AIAction;
    success: boolean;
    error?: string;
}

// ── Toast / Notification Types ──

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

// ── Global Window type augmentation ──

declare global {
    interface Window {
        electronAPI: {
            terminal: {
                create: (id: string, cwd?: string) => Promise<{ success: boolean; error?: string }>;
                write: (id: string, data: string) => Promise<void>;
                resize: (id: string, cols: number, rows: number) => Promise<void>;
                destroy: (id: string) => Promise<void>;
                execute: (options: { command: string; cwd: string; sessionId?: string; timeout?: number }) =>
                    Promise<{ success: boolean; output: string; exitCode: number; commandId: string; error?: string }>;
                launchDevServer: (options: { command: string; cwd: string; sessionId?: string; port: number; timeout?: number }) =>
                    Promise<{ success: boolean; url: string; error?: string }>;
                checkCommandStatus: (commandId: string) =>
                    Promise<{ found: boolean; running: boolean; exitCode: number | null; output?: string }>;
                killCommand: (commandId: string) => Promise<{ success: boolean; error?: string }>;
                onData: (id: string, callback: (data: string) => void) => () => void;
                onExit: (id: string, callback: (exitCode: number) => void) => () => void;
            };
            fs: {
                readDir: (dirPath: string) => Promise<FileNode[]>;
                readFile: (filePath: string) => Promise<FileReadResult>;
                writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
                deleteItem: (itemPath: string) => Promise<{ success: boolean; error?: string }>;
                rename: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
                createItem: (parentPath: string, name: string, type: 'file' | 'directory') => Promise<FileNode>;
                watchStart: (dirPath: string) => Promise<void>;
                watchStop: () => Promise<void>;
                onFileChange: (callback: (event: FileChangeEvent) => void) => () => void;
            };
            ai: {
                streamStart: (config: any) => Promise<void>;
                streamStop: () => Promise<void>;
                planProject: (prompt: string, template: string, baseUrl?: string) => Promise<any>;
                generateFiles: (plan: any, baseUrl?: string) => Promise<any>;
                applyFile: (projectRoot: string, relativePath: string, content: string) => Promise<{ success: boolean; resolvedPath: string; error?: string }>;
                runTerminal: (terminalId: string, command: string) => Promise<{ success: boolean; error?: string }>;
                readTerminalOutput: (terminalId: string, maxLines?: number) => Promise<{ success: boolean; output: string; error?: string }>;
                listProjectFiles: (projectRoot: string) => Promise<{ success: boolean; files: string[]; error?: string }>;
                onToken: (callback: (token: string) => void) => () => void;
                onComplete: (callback: (response: string) => void) => () => void;
                onError: (callback: (error: string) => void) => () => void;
            };
            project: {
                create: (config: any) => Promise<any>;
                installDependencies: (projectPath: string, terminalId: string) => Promise<any>;
                onProgress: (callback: (step: any) => void) => () => void;
            };
            dialog: {
                openFolder: () => Promise<string | null>;
            };
            system: {
                getHomeDir: () => Promise<string>;
                getPlatform: () => Promise<string>;
                getLMStudioModels: (baseUrl: string) => Promise<string[]>;
                testLMConnection: (baseUrl: string) => Promise<{ connected: boolean; error?: string }>;
                openExternal: (url: string) => Promise<void>;
            };
            onMenuEvent: (event: string, callback: () => void) => () => void;
        };
    }
}

export { };
