/**
 * AnimatedCheck — Animated checkmark component
 */

import React from 'react';
import { Check } from 'lucide-react';

interface Props {
    size?: number;
}

export const AnimatedCheck: React.FC<Props> = ({ size = 16 }) => {
    return (
        <div className="animate-fade-slide-in">
            <Check size={size} className="text-app-success" />
        </div>
    );
};
