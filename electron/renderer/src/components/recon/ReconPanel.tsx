import React from 'react';
import { Network } from 'lucide-react';

export const ReconPanel: React.FC = () => {
    return (
        <div className="h-full flex flex-col bg-app-sidebar items-center justify-center p-6 text-center select-none">
            <div className="w-16 h-16 rounded-full bg-app-accent/10 text-app-accent flex items-center justify-center mb-4">
                <Network size={32} />
            </div>
            <h2 className="text-sm font-semibold text-app-text mb-2">Recon & Scrape</h2>
            <p className="text-[12px] text-app-textMuted max-w-[200px]">
                Web scraping and reconnaissance tools will be available here using the configured AI model.
            </p>
            <button className="mt-6 px-4 py-2 bg-app-panel border border-app-border rounded-lg text-[12px] hover:border-app-accent hover:text-app-accent transition-colors" disabled>
                Coming Soon
            </button>
        </div>
    );
};
