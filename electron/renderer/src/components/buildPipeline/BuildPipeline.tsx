/**
 * BuildPipeline — Visual build progress display with timeline
 */

import React from 'react';
import { useBuildStore } from '../../store';
import { BuildStep } from './BuildStep';

export const BuildPipeline: React.FC = () => {
    const { steps, isBuilding, overallProgress } = useBuildStore();

    if (steps.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 animate-fade-slide-in">
            {/* Progress Bar */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-app-border rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-app-accent to-blue-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${overallProgress}%` }}
                    />
                </div>
                <span className="text-[11px] text-app-textMuted w-8 text-right">{overallProgress}%</span>
            </div>

            {/* Steps */}
            <div className="space-y-0.5">
                {steps.map((step, index) => (
                    <BuildStep key={step.id} step={step} index={index} />
                ))}
            </div>

            {/* Completion Banner */}
            {!isBuilding && overallProgress === 100 && (
                <div className="mt-2 p-3 bg-app-success/10 border border-app-success/30 rounded-lg flex items-center gap-2 animate-fade-slide-in">
                    <span className="text-app-success text-lg">🎉</span>
                    <div>
                        <p className="text-[13px] font-medium text-app-success">Build Complete!</p>
                        <p className="text-[11px] text-app-textMuted">Your project is ready. Check the terminal for the dev server URL.</p>
                    </div>
                </div>
            )}

            {/* Error Banner */}
            {!isBuilding && steps.some(s => s.status === 'error') && (
                <div className="mt-2 p-3 bg-app-error/10 border border-app-error/30 rounded-lg animate-fade-slide-in">
                    <p className="text-[13px] font-medium text-app-error">Build Failed</p>
                    <p className="text-[11px] text-app-textMuted mt-1">
                        {steps.find(s => s.status === 'error')?.error || 'An error occurred during the build process.'}
                    </p>
                </div>
            )}
        </div>
    );
};
