/**
 * SettingsPanel — Full settings form displayed in sidebar
 */

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store';
import { Wifi, WifiOff, RefreshCw, RotateCcw, Check } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
    const settings = useSettingsStore();
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
    const [models, setModels] = useState<string[]>([]);

    const testConnection = async () => {
        setConnectionStatus('testing');
        try {
            const result = await window.electronAPI?.system?.testLMConnection(settings.lmStudioUrl);
            setConnectionStatus(result?.connected ? 'connected' : 'failed');
            if (result?.connected) {
                const m = await window.electronAPI.system.getLMStudioModels(settings.lmStudioUrl);
                setModels(m);
            }
        } catch {
            setConnectionStatus('failed');
        }
    };

    useEffect(() => { testConnection(); }, []);

    return (
        <div className="h-full overflow-y-auto px-3 py-3 space-y-4 settings-panel">
            <h2 className="text-[13px] font-semibold text-app-text">Settings</h2>

            {/* AI Connection */}
            <Section title="AI Connection">
                <Label text="LM Studio URL">
                    <input
                        value={settings.lmStudioUrl}
                        onChange={(e) => settings.updateSetting('lmStudioUrl', e.target.value)}
                        className="input-field"
                    />
                </Label>

                <div className="flex gap-2">
                    <button onClick={testConnection} className="btn-sm flex items-center gap-1">
                        <RefreshCw size={12} className={connectionStatus === 'testing' ? 'animate-spin' : ''} />
                        Test
                    </button>
                    <span className={`flex items-center gap-1 text-[11px] ${connectionStatus === 'connected' ? 'text-app-success' :
                            connectionStatus === 'failed' ? 'text-app-error' : 'text-app-textMuted'
                        }`}>
                        {connectionStatus === 'connected' && <><Wifi size={12} /> Connected</>}
                        {connectionStatus === 'failed' && <><WifiOff size={12} /> Failed</>}
                        {connectionStatus === 'testing' && 'Testing...'}
                    </span>
                </div>

                <Label text="Model">
                    <select
                        value={settings.selectedModel}
                        onChange={(e) => settings.updateSetting('selectedModel', e.target.value)}
                        className="input-field"
                    >
                        <option value="">Auto-detect</option>
                        {models.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                </Label>

                <Label text={`Temperature: ${settings.temperature}`}>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={settings.temperature}
                        onChange={(e) => settings.updateSetting('temperature', parseFloat(e.target.value))}
                        className="w-full accent-app-accent"
                    />
                </Label>

                <Label text="Max Tokens">
                    <input
                        type="number"
                        value={settings.maxTokens}
                        onChange={(e) => settings.updateSetting('maxTokens', parseInt(e.target.value) || 4096)}
                        className="input-field"
                    />
                </Label>
            </Section>

            {/* Editor */}
            <Section title="Editor">
                <Label text={`Font Size: ${settings.editorFontSize}`}>
                    <input
                        type="range" min="10" max="24" value={settings.editorFontSize}
                        onChange={(e) => settings.updateSetting('editorFontSize', parseInt(e.target.value))}
                        className="w-full accent-app-accent"
                    />
                </Label>

                <Label text="Font Family">
                    <select value={settings.editorFontFamily} onChange={(e) => settings.updateSetting('editorFontFamily', e.target.value)} className="input-field">
                        <option value="JetBrains Mono">JetBrains Mono</option>
                        <option value="Fira Code">Fira Code</option>
                        <option value="Cascadia Code">Cascadia Code</option>
                        <option value="Monaco">Monaco</option>
                        <option value="Consolas">Consolas</option>
                    </select>
                </Label>

                <Toggle label="Auto Save" checked={settings.autoSave} onChange={(v) => settings.updateSetting('autoSave', v)} />
                <Toggle label="Word Wrap" checked={settings.wordWrap} onChange={(v) => settings.updateSetting('wordWrap', v)} />
                <Toggle label="Minimap" checked={settings.showMinimap} onChange={(v) => settings.updateSetting('showMinimap', v)} />
            </Section>

            {/* Terminal */}
            <Section title="Terminal">
                <Label text={`Font Size: ${settings.terminalFontSize}`}>
                    <input
                        type="range" min="10" max="20" value={settings.terminalFontSize}
                        onChange={(e) => settings.updateSetting('terminalFontSize', parseInt(e.target.value))}
                        className="w-full accent-app-accent"
                    />
                </Label>
            </Section>

            {/* Project Defaults */}
            <Section title="Project Defaults">
                <Label text="Package Manager">
                    <select value={settings.defaultPackageManager} onChange={(e) => settings.updateSetting('defaultPackageManager', e.target.value as any)} className="input-field">
                        <option value="npm">npm</option>
                        <option value="yarn">yarn</option>
                        <option value="pnpm">pnpm</option>
                    </select>
                </Label>
                <Toggle label="Animations" checked={settings.enableAnimations} onChange={(v) => settings.updateSetting('enableAnimations', v)} />
            </Section>

            {/* Reset */}
            <button onClick={settings.resetToDefaults} className="btn-sm w-full flex items-center justify-center gap-1 text-app-warning">
                <RotateCcw size={12} /> Reset to Defaults
            </button>
        </div>
    );
};

// Helper components
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-2">
        <h3 className="text-[11px] font-semibold text-app-textMuted uppercase tracking-wider">{title}</h3>
        <div className="space-y-2">{children}</div>
    </div>
);

const Label: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
    <label className="block">
        <span className="text-[11px] text-app-textMuted mb-1 block">{text}</span>
        {children}
    </label>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between">
        <span className="text-[12px] text-app-text">{label}</span>
        <button
            onClick={() => onChange(!checked)}
            className={`w-8 h-4 rounded-full transition-colors relative ${checked ? 'bg-app-accent' : 'bg-app-border'}`}
        >
            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
    </div>
);

// Add global input styles
const inputStyles = `
.input-field {
  width: 100%;
  background: #0d0d1a;
  border: 1px solid #2d2d4e;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: #e2e8f0;
  outline: none;
  transition: border-color 150ms;
}
.input-field:focus { border-color: #7c3aed; }
.btn-sm {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid #2d2d4e;
  border-radius: 6px;
  background: #1a1a2e;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 150ms;
}
.btn-sm:hover { border-color: #7c3aed; background: #7c3aed10; }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = inputStyles;
    document.head.appendChild(style);
}
