/**
 * BuildStep — Individual step row with animated status
 */

import React, { useState } from 'react';
import { Check, X, Loader2, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import type { BuildStep as BuildStepType } from '../../types';

interface Props {
    step: BuildStepType;
    index: number;
}

export const BuildStep: React.FC<Props> = ({ step, index }) => {
    const [expanded, setExpanded] = useState(false);

    const elapsed = step.startTime
        ? ((step.endTime || Date.now()) - step.startTime) / 1000
        : 0;

    const StatusIcon = () => {
        switch (step.status) {
            case 'pending':
                return <Clock size={14} className="text-app-textMuted" />;
            case 'running':
                return <Loader2 size={14} className="text-app-accent animate-spin" />;
            case 'complete':
                return <Check size={14} className="text-app-success" />;
            case 'error':
                return <X size={14} className="text-app-error" />;
        }
    };

    return (
        <div
            className={`
        build-step-enter rounded-md overflow-hidden transition-all
        ${step.status === 'running' ? 'build-step-running' : ''}
        ${step.status === 'complete' ? 'build-step-complete' : ''}
        ${step.status === 'error' ? 'border-l-2 border-app-error' : ''}
      `}
            style={{ animationDelay: `${index * 50}ms` }}
        >
            <div
                onClick={() => setExpanded(!expanded)}
                className={`
          flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors
          ${step.status === 'running'
                        ? 'bg-app-accent/5'
                        : step.status === 'error'
                            ? 'bg-app-error/5'
                            : 'hover:bg-white/3'
                    }
        `}
            >
                {/* Connection Line */}
                <div className={`
          w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
          ${step.status === 'complete' ? 'bg-app-success border-app-success' :
                        step.status === 'running' ? 'border-app-accent' :
                            step.status === 'error' ? 'bg-app-error border-app-error' :
                                'border-app-border'
                    }
        `}>
                    <StatusIcon />
                </div>

                {/* Icon + Label */}
                <span className="text-sm flex-shrink-0">{step.icon}</span>
                <span className={`
          text-[12px] font-medium flex-1
          ${step.status === 'pending' ? 'text-app-textMuted' :
                        step.status === 'running' ? 'text-app-accent' :
                            step.status === 'complete' ? 'text-app-success' :
                                'text-app-error'
                    }
        `}>
                    {step.label}
                </span>

                {/* Detail */}
                {step.detail && (
                    <span className="text-[11px] text-app-textMuted truncate max-w-[200px]">
                        {step.detail}
                    </span>
                )}

                {/* Timer */}
                {step.status !== 'pending' && (
                    <span className="text-[10px] text-app-textMuted flex-shrink-0">
                        {elapsed.toFixed(1)}s
                    </span>
                )}

                {/* Expand/Collapse */}
                {step.logs && step.logs.length > 0 && (
                    <span className="text-app-textMuted flex-shrink-0">
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                )}
            </div>

            {/* Expanded Log */}
            {expanded && step.logs && step.logs.length > 0 && (
                <div className="px-3 py-2 bg-app-bg text-[11px] font-mono text-app-textMuted max-h-[200px] overflow-auto border-t border-app-border/30">
                    {step.logs.map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const BuildProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
    <div className="h-1 bg-app-border rounded-full overflow-hidden">
        <div
            className="h-full bg-app-accent rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
        />
    </div>
);
