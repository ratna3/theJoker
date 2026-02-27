/**
 * VibeCodingPrompt — Main prompt UI for AI project builder
 */

import React, { useState, useCallback } from 'react';
import { Sparkles, Folder } from 'lucide-react';
import { BuildPipeline } from '../buildPipeline/BuildPipeline';
import { TemplatePicker } from './TemplatePicker';
import { useBuildStore, useFileStore, useTerminalStore, useSettingsStore } from '../../store';
import jokerLogo from '../../assets/theJoker.png';

const TEMPLATES = [
    { id: 'nextjs', name: 'Next.js', icon: '⚡' },
    { id: 'react-vite', name: 'React + Vite', icon: '⚛️' },
    { id: 'express', name: 'Express API', icon: '🚀' },
    { id: 'static', name: 'Static HTML', icon: '🌐' },
];

export const VibeCodingPrompt: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('nextjs');
    const [targetDir, setTargetDir] = useState('');
    const { isBuilding, steps, startBuild, updateStep, completeBuild, failBuild } = useBuildStore();
    const { openFolder } = useFileStore();
    const { createSession, setActiveSession } = useTerminalStore();
    const { defaultProjectPath } = useSettingsStore();

    // Init target dir
    React.useEffect(() => {
        const init = async () => {
            if (defaultProjectPath) {
                setTargetDir(defaultProjectPath);
            } else {
                const home = await window.electronAPI?.system?.getHomeDir();
                setTargetDir(home ? `${home}\\Desktop` : '');
            }
        };
        init();
    }, [defaultProjectPath]);

    const handleChangeDir = useCallback(async () => {
        const dir = await window.electronAPI?.dialog?.openFolder();
        if (dir) setTargetDir(dir);
    }, []);

    const handleBuild = useCallback(async () => {
        if (!prompt.trim() || isBuilding) return;

        startBuild(targetDir);

        try {
            // Step 1: Analyze
            updateStep('analyze', { status: 'running', detail: 'Analyzing your idea...' });
            const planResult = await window.electronAPI?.ai?.planProject(prompt, selectedTemplate);

            if (!planResult?.success) {
                failBuild('analyze', planResult?.error || 'Failed to analyze');
                return;
            }
            updateStep('analyze', { status: 'complete', detail: planResult.plan.projectName });
            updateStep('plan', { status: 'complete', detail: 'Plan ready' });

            // Step 2: Navigate + Scaffold
            updateStep('navigate', { status: 'running', detail: 'Setting up directory...' });
            const createResult = await window.electronAPI?.project?.create({
                name: planResult.plan.projectName,
                template: selectedTemplate,
                targetDir,
                userPrompt: prompt,
            });
            updateStep('navigate', { status: 'complete' });

            if (!createResult?.success) {
                failBuild('scaffold', createResult?.error || 'Scaffolding failed');
                return;
            }
            updateStep('scaffold', { status: 'complete', detail: `${selectedTemplate} scaffolded` });

            // Step 3: Generate files
            updateStep('generate', { status: 'running', detail: 'Generating components...' });
            const genResult = await window.electronAPI?.ai?.generateFiles(planResult.plan);
            if (genResult?.success) {
                const files = genResult.files;
                updateStep('generate', { status: 'complete', detail: `${Object.keys(files).length} files` });

                // Step 4: Write files
                updateStep('write', { status: 'running', detail: `Writing files...` });
                const projectPath = createResult.projectPath;
                for (const [filePath, content] of Object.entries(files)) {
                    const fullPath = `${projectPath}/${filePath}`;
                    await window.electronAPI.fs.writeFile(fullPath, content as string);
                }
                updateStep('write', { status: 'complete', detail: `${Object.keys(files).length} written` });
            } else {
                updateStep('generate', { status: 'complete', detail: 'Using template defaults' });
                updateStep('write', { status: 'complete', detail: 'Template files ready' });
            }

            // Step 5: Install dependencies
            updateStep('install', { status: 'running', detail: 'Installing dependencies...' });
            const termId = createSession(createResult.projectPath);
            setActiveSession(termId);

            const installResult = await window.electronAPI?.project?.installDependencies(
                createResult.projectPath,
                termId
            );

            if (installResult?.success) {
                updateStep('install', { status: 'complete', detail: installResult.packageManager });
            } else {
                failBuild('install', installResult?.error || 'Install failed');
                return;
            }

            // Step 6: Launch
            updateStep('launch', { status: 'running', detail: 'Starting dev server...' });
            await window.electronAPI.terminal.write(termId, 'npm run dev\n');
            updateStep('launch', { status: 'complete' });
            completeBuild();

            // Open in explorer
            openFolder(createResult.projectPath);

        } catch (err: any) {
            failBuild('analyze', err.message);
        }
    }, [prompt, selectedTemplate, targetDir, isBuilding]);

    return (
        <div className="h-full overflow-y-auto px-3 py-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                    <img src={jokerLogo} alt="The Joker" className="w-8 h-8 object-contain" />
                </div>
                <div>
                    <h2 className="text-[14px] font-bold gradient-text">The Joker — Vibe Coding</h2>
                    <p className="text-[11px] text-app-textMuted">Describe an app and I'll build it from scratch</p>
                </div>
            </div>

            {/* Prompt */}
            {!isBuilding && steps.length === 0 && (
                <>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="build me a blog website with dark mode, animations, and a CMS..."
                        rows={3}
                        className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-[13px] text-app-text placeholder:text-app-textMuted resize-none focus:outline-none focus:border-app-accent transition-colors mb-3"
                    />

                    {/* Template Select */}
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                        {TEMPLATES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTemplate(t.id)}
                                className={`
                  flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] border transition-all
                  ${selectedTemplate === t.id
                                        ? 'bg-app-accent/15 border-app-accent/50 text-app-text'
                                        : 'bg-app-bg border-app-border text-app-textMuted hover:border-app-accent/30'
                                    }
                `}
                            >
                                <span>{t.icon}</span>
                                <span>{t.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Target Dir */}
                    <div className="flex items-center gap-2 mb-4">
                        <Folder size={14} className="text-app-textMuted flex-shrink-0" />
                        <span className="text-[11px] text-app-textMuted truncate flex-1">{targetDir || 'Select location...'}</span>
                        <button onClick={handleChangeDir} className="text-[10px] text-app-accent hover:underline flex-shrink-0">
                            Change
                        </button>
                    </div>

                    {/* Build Button */}
                    <button
                        onClick={handleBuild}
                        disabled={!prompt.trim() || !targetDir}
                        className={`
              w-full py-2.5 rounded-lg font-medium text-[13px] flex items-center justify-center gap-2 transition-all
              ${prompt.trim() && targetDir
                                ? 'bg-gradient-to-r from-app-accent to-purple-600 hover:from-app-accentHover hover:to-purple-700 text-white shadow-lg shadow-app-accent/20'
                                : 'bg-app-panel text-app-textMuted cursor-not-allowed'
                            }
            `}
                    >
                        <Sparkles size={16} />
                        Build
                    </button>
                </>
            )}

            {/* Build Progress */}
            {(isBuilding || steps.length > 0) && (
                <BuildPipeline />
            )}
        </div>
    );
};
