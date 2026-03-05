/**
 * Zustand Store — Build Pipeline
 */

import { create } from 'zustand';
import type { BuildStep, BuildStepStatus } from '../types';

const DEFAULT_STEPS: BuildStep[] = [
    { id: 'analyze', name: 'analyze', label: 'Analyzing your idea...', icon: '🧠', status: 'pending' },
    { id: 'plan', name: 'plan', label: 'Planning project structure...', icon: '📋', status: 'pending' },
    { id: 'navigate', name: 'navigate', label: 'Setting up project directory...', icon: '📁', status: 'pending' },
    { id: 'scaffold', name: 'scaffold', label: 'Scaffolding project', icon: '🏗️', status: 'pending' },
    { id: 'generate', name: 'generate', label: 'Generating components...', icon: '🔧', status: 'pending' },
    { id: 'write', name: 'write', label: 'Writing files...', icon: '📝', status: 'pending' },
    { id: 'install', name: 'install', label: 'Installing dependencies...', icon: '📦', status: 'pending' },
    { id: 'launch', name: 'launch', label: 'Starting development server...', icon: '🚀', status: 'pending' },
];

interface BuildState {
    steps: BuildStep[];
    isBuilding: boolean;
    currentProjectPath: string | null;
    overallProgress: number;
    devServerUrl: string | null;
    startBuild: (projectPath?: string) => void;
    updateStep: (id: string, update: Partial<BuildStep>) => void;
    completeBuild: (devServerUrl?: string) => void;
    failBuild: (stepId: string, error: string) => void;
    reset: () => void;
}

export const useBuildStore = create<BuildState>((set, get) => ({
    steps: [],
    isBuilding: false,
    currentProjectPath: null,
    overallProgress: 0,
    devServerUrl: null,

    startBuild: (projectPath) => {
        set({
            steps: DEFAULT_STEPS.map((s) => ({ ...s, status: 'pending' as BuildStepStatus, startTime: undefined, endTime: undefined, logs: [], detail: undefined, error: undefined })),
            isBuilding: true,
            currentProjectPath: projectPath || null,
            overallProgress: 0,
            devServerUrl: null,
        });
    },

    updateStep: (id, update) => {
        set((state) => {
            const steps = state.steps.map((s) => {
                if (s.id !== id) return s;
                const merged = { ...s, ...update };
                if (update.status === 'running' && !s.startTime) {
                    merged.startTime = Date.now();
                }
                if (update.status === 'complete' || update.status === 'error') {
                    merged.endTime = Date.now();
                }
                return merged;
            });
            const completed = steps.filter((s) => s.status === 'complete').length;
            return {
                steps,
                overallProgress: Math.round((completed / steps.length) * 100),
            };
        });
    },

    completeBuild: (devServerUrl) => set({ isBuilding: false, overallProgress: 100, devServerUrl: devServerUrl || null }),

    failBuild: (stepId, error) => {
        const { updateStep } = get();
        updateStep(stepId, { status: 'error', error });
        set({ isBuilding: false });
    },

    reset: () => set({ steps: [], isBuilding: false, currentProjectPath: null, overallProgress: 0, devServerUrl: null }),
}));
