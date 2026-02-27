import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, ChevronRight, Settings } from 'lucide-react';
import jokerLogo from '../../assets/theJoker.png';

export const SetupScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const settings = useSettingsStore();
    const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    const [models, setModels] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState('');

    const testConnection = async () => {
        setStatus('testing');
        setErrorMsg('');
        try {
            const result = await window.electronAPI?.system?.testLMConnection(settings.lmStudioUrl);
            if (result?.connected) {
                setStatus('success');
                const m = await window.electronAPI.system.getLMStudioModels(settings.lmStudioUrl);
                setModels(m);
                if (m.length > 0 && !settings.selectedModel) {
                    settings.updateSetting('selectedModel', m[0]);
                }
            } else {
                setStatus('failed');
                setErrorMsg('Could not connect to LM Studio at the provided URL.');
            }
        } catch (err: any) {
            setStatus('failed');
            setErrorMsg(err.message || 'Connection failed.');
        }
    };

    // Auto-test on mount if a URL exists
    useEffect(() => {
        if (settings.lmStudioUrl) {
            testConnection();
        }
    }, []);

    // Also consider passing if everything is basically good and user clicks continue
    const handleContinue = () => {
        if (status === 'success' && settings.selectedModel) {
            // Signal to App.tsx that setup is done
            settings.updateSetting('setupCompleted', true);
            onComplete();
        }
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-app-bg text-app-text select-none">
            <div className="w-[480px] bg-app-sidebar border border-app-border rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-scale-fade-in relative">
                {/* Decorative glow */}
                <div className="absolute -top-32 -left-32 w-64 h-64 bg-app-accent/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-app-accent/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="p-8 relative z-10 flex flex-col items-center">
                    {/* Header */}
                    <div className="w-20 h-20 rounded-2xl bg-app-bg border border-app-border flex items-center justify-center shadow-lg mb-6">
                        <img src={jokerLogo} alt="The Joker" className="w-16 h-16 object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold font-sans gradient-text mb-2">Welcome to The Joker</h1>
                    <p className="text-[13px] text-app-textMuted text-center max-w-sm">
                        Let's connect your local AI backend. Make sure LM Studio is running.
                    </p>

                    {/* Inputs */}
                    <div className="w-full mt-8 space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-medium text-app-textMuted flex items-center gap-1.5">
                                <Settings size={14} /> LM Studio Base URL
                            </label>
                            <input
                                type="text"
                                className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-[13px] focus:outline-none focus:border-app-accent/50 transition-colors"
                                value={settings.lmStudioUrl}
                                onChange={(e) => settings.updateSetting('lmStudioUrl', e.target.value)}
                                placeholder="http://localhost:1234"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[12px] font-medium text-app-textMuted flex items-center justify-between">
                                AI Model
                                <button
                                    onClick={testConnection}
                                    className="text-app-accent hover:text-app-accentHover flex items-center gap-1 text-[11px] transition-colors"
                                >
                                    <RefreshCw size={10} className={status === 'testing' ? 'animate-spin' : ''} />
                                    Test & Refresh
                                </button>
                            </label>
                            <select
                                className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-[13px] focus:outline-none focus:border-app-accent/50 transition-colors appearance-none cursor-pointer"
                                value={settings.selectedModel}
                                onChange={(e) => settings.updateSetting('selectedModel', e.target.value)}
                                disabled={models.length === 0}
                            >
                                {models.length === 0 ? (
                                    <option value="">No models found...</option>
                                ) : (
                                    models.map(m => <option key={m} value={m}>{m}</option>)
                                )}
                            </select>
                        </div>
                    </div>

                    {/* Status Box */}
                    {status !== 'idle' && (
                        <div className={`w-full mt-6 p-3 rounded-lg flex items-center gap-3 text-[13px] border ${status === 'success' ? 'bg-app-success/10 border-app-success/20 text-app-success' :
                            status === 'failed' ? 'bg-app-error/10 border-app-error/20 text-app-error' :
                                'bg-app-accent/10 border-app-accent/20 text-app-accent'
                            }`}>
                            {status === 'success' && <CheckCircle2 size={16} />}
                            {status === 'failed' && <WifiOff size={16} />}
                            {status === 'testing' && <RefreshCw size={16} className="animate-spin" />}

                            <div className="flex-1">
                                {status === 'success' && 'Successfully connected to LM Studio!'}
                                {status === 'failed' && (errorMsg || 'Connection failed. Please check the URL.')}
                                {status === 'testing' && 'Testing connection...'}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="w-full mt-8">
                        <button
                            onClick={handleContinue}
                            disabled={status !== 'success' || !settings.selectedModel}
                            className={`
                                w-full py-3 rounded-lg flex items-center justify-center gap-2 text-[14px] font-medium transition-all
                                ${status === 'success' && settings.selectedModel
                                    ? 'bg-app-accent hover:bg-app-accentHover text-white shadow-lg shadow-app-accent/20 cursor-pointer'
                                    : 'bg-app-panel text-app-textMuted border border-app-border cursor-not-allowed'
                                }
                            `}
                        >
                            Continue to IDE <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
