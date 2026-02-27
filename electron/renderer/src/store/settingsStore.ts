/**
 * Zustand Store — Settings
 * Persists to localStorage automatically
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings } from '../types';

interface SettingsState extends AppSettings {
    updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
    resetToDefaults: () => void;
}

const defaults: AppSettings = {
    setupCompleted: false,
    lmStudioUrl: 'http://localhost:1234',
    selectedModel: '',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '',
    editorFontSize: 14,
    editorFontFamily: 'JetBrains Mono',
    tabSize: 2,
    wordWrap: false,
    autoSave: true,
    formatOnSave: false,
    showMinimap: true,
    terminalFontSize: 13,
    terminalScrollback: 5000,
    uiScale: 'normal',
    showFileIcons: true,
    showIndentGuides: true,
    enableAnimations: true,
    defaultProjectPath: '',
    defaultPackageManager: 'npm',
    autoOpenBrowser: true,
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            ...defaults,
            updateSetting: (key, value) => set({ [key]: value }),
            resetToDefaults: () => set(defaults),
        }),
        { name: 'vibe-settings' }
    )
);
