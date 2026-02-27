import React from 'react';
import { AppShell } from './components/layout/AppShell';
import { SetupScreen } from './components/setup/SetupScreen';
import { useSettingsStore } from './store';

function App() {
    const { setupCompleted, updateSetting } = useSettingsStore();

    if (!setupCompleted) {
        return <SetupScreen onComplete={() => updateSetting('setupCompleted', true)} />;
    }

    return <AppShell />;
}

export default App;
