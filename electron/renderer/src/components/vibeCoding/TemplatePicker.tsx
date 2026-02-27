/**
 * TemplatePicker — Template selection grid with details
 */

import React from 'react';
import type { ProjectTemplate } from '../../types';

const TEMPLATES: ProjectTemplate[] = [
    {
        id: 'nextjs',
        name: 'Next.js App',
        description: 'React framework with SSR, routing, and API routes',
        icon: '⚡',
        features: ['TypeScript', 'Tailwind CSS', 'App Router', 'ESLint'],
        scaffoldCommand: 'npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir',
    },
    {
        id: 'react-vite',
        name: 'React + Vite',
        description: 'Fast React SPA with Vite bundler',
        icon: '⚛️',
        features: ['TypeScript', 'Fast HMR', 'Lightweight'],
        scaffoldCommand: 'npm create vite@latest . -- --template react-ts',
    },
    {
        id: 'express',
        name: 'Express API',
        description: 'Node.js REST API with Express',
        icon: '🚀',
        features: ['TypeScript', 'Express', 'Nodemon'],
        scaffoldCommand: null,
    },
    {
        id: 'fullstack',
        name: 'Full-Stack',
        description: 'Next.js + Prisma + PostgreSQL',
        icon: '🏗️',
        features: ['Next.js', 'Prisma ORM', 'PostgreSQL', 'NextAuth'],
        scaffoldCommand: 'npx create-next-app@latest . --typescript --tailwind --app',
    },
    {
        id: 'static',
        name: 'Static HTML',
        description: 'Simple HTML/CSS/JS site',
        icon: '🌐',
        features: ['HTML5', 'CSS3', 'Vanilla JS'],
        scaffoldCommand: null,
    },
];

interface Props {
    selected: string;
    onSelect: (id: string) => void;
}

export const TemplatePicker: React.FC<Props> = ({ selected, onSelect }) => {
    return (
        <div className="space-y-2">
            <h3 className="text-[11px] font-semibold text-app-textMuted uppercase tracking-wider">
                Choose a Template
            </h3>
            <div className="grid gap-2">
                {TEMPLATES.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => onSelect(template.id)}
                        className={`
              flex items-start gap-3 p-3 rounded-lg border text-left transition-all
              ${selected === template.id
                                ? 'bg-app-accent/10 border-app-accent/50'
                                : 'bg-app-bg border-app-border hover:border-app-accent/30'
                            }
            `}
                    >
                        <span className="text-2xl flex-shrink-0 mt-0.5">{template.icon}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-app-text">{template.name}</p>
                            <p className="text-[11px] text-app-textMuted mt-0.5">{template.description}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {template.features.map((f) => (
                                    <span key={f} className="px-1.5 py-0.5 text-[9px] bg-app-panel border border-app-border rounded text-app-textMuted">
                                        {f}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
