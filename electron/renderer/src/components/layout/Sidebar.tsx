/**
 * Sidebar — Contains file explorer and navigation icons
 */

import React, { useState } from 'react';
import { Files, MessageSquare, Palette, Settings, Rocket, Network } from 'lucide-react';
import { FileExplorer } from '../fileExplorer/FileExplorer';
import { SettingsPanel } from '../settings/SettingsPanel';
import { VibeCodingPrompt } from '../vibeCoding/VibeCodingPrompt';
import { ChatPanel } from '../chat/ChatPanel';
import { ReconPanel } from '../recon/ReconPanel';

type SidebarView = 'files' | 'vibe' | 'chat' | 'recon' | 'settings';

export const Sidebar: React.FC = () => {
    const [activeView, setActiveView] = useState<SidebarView>('files');

    const navItems: { id: SidebarView; icon: React.ElementType; label: string }[] = [
        { id: 'files', icon: Files, label: 'Explorer' },
        { id: 'vibe', icon: Rocket, label: 'Vibe Coding IDE' },
        { id: 'chat', icon: MessageSquare, label: 'Chat' },
        { id: 'recon', icon: Network, label: 'Recon / Scrape' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="h-full flex bg-app-sidebar">
            {/* Icon Bar */}
            <div className="w-[48px] flex-shrink-0 flex flex-col items-center pt-2 gap-1 border-r border-app-border bg-app-bg/50">
                {navItems.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => setActiveView(id)}
                        data-tooltip={label}
                        className={`
              tooltip w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150
              ${activeView === id
                                ? 'bg-app-accent/20 text-app-accent border-l-2 border-app-accent'
                                : 'text-app-textMuted hover:text-app-text hover:bg-white/5'
                            }
            `}
                    >
                        <Icon size={20} />
                    </button>
                ))}
            </div>

            {/* Panel Content */}
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                {activeView === 'files' && <FileExplorer />}
                {activeView === 'vibe' && <VibeCodingPrompt />}
                {activeView === 'chat' && <ChatPanel />}
                {activeView === 'recon' && <ReconPanel />}
                {activeView === 'settings' && <SettingsPanel />}
            </div>
        </div>
    );
};
