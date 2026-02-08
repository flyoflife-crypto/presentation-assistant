import React, { useState, useEffect } from 'react';
import { Button } from '../../shared/ui';
import { OpenAISetupTab } from './tabs/OpenAISetupTab';
import { AssistantScriptTab } from './tabs/AssistantScriptTab';
import { LiveInputTab } from './tabs/LiveInputTab';
import { TeleprompterTab } from './tabs/TeleprompterTab';
import { GazeTrainerTab } from './tabs/GazeTrainerTab';
import { PrivacyTab } from './tabs/PrivacyTab';

type TabName = 'openai' | 'script' | 'input' | 'teleprompter' | 'gaze' | 'privacy';

interface TabConfig {
  id: TabName;
  label: string;
  component: React.ComponentType<any>;
}

const tabs: TabConfig[] = [
  { id: 'openai', label: 'OpenAI Setup', component: OpenAISetupTab },
  { id: 'script', label: 'Assistant Script', component: AssistantScriptTab },
  { id: 'input', label: 'Live Input', component: LiveInputTab },
  { id: 'teleprompter', label: 'Teleprompter', component: TeleprompterTab },
  { id: 'gaze', label: 'Gaze Trainer', component: GazeTrainerTab },
  { id: 'privacy', label: 'Privacy', component: PrivacyTab },
];

export const SettingsWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('openai');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const allConfig = await window.api.getAllConfig();
      setConfig(allConfig || {});
    } catch (error) {
      console.error('Failed to load config:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveStatus(null);

      // Save each config key
      for (const [key, value] of Object.entries(config)) {
        await window.api.setConfig({ key, value });
      }

      setSaveStatus({ type: 'success', message: 'Settings saved successfully!' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartLive = async () => {
    try {
      // Save current settings before starting
      await handleSave();
      
      // Start session with current config
      await window.api.startSession({
        mode: config.liveInputMode || 'CAPTIONS',
        systemPrompt: config.systemPrompt || '',
        micDeviceId: config.micDeviceId,
        captionSource: config.captionSource || 'manual',
        captionFilePath: config.captionFilePath,
      });
    } catch (error) {
      console.error('Failed to start live session:', error);
      setSaveStatus({ type: 'error', message: 'Failed to start live session' });
    }
  };

  const handleStop = async () => {
    try {
      await window.api.stopSession();
    } catch (error) {
      console.error('Failed to stop session:', error);
      setSaveStatus({ type: 'error', message: 'Failed to stop session' });
    }
  };

  const handleOpenPrepChat = async () => {
    try {
      await window.api.openPrepChat();
    } catch (error) {
      console.error('Failed to open prep chat:', error);
    }
  };

  const handleOpenPostAnalysis = async () => {
    try {
      await window.api.openPostAnalysis();
    } catch (error) {
      console.error('Failed to open post-analysis:', error);
    }
  };

  const ActiveTabComponent = tabs.find((tab) => tab.id === activeTab)?.component;

  if (isLoading) {
    return (
      <div className="settings-window">
        <div className="settings-header">
          <h1>Settings</h1>
        </div>
        <div className="settings-content">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
            <p style={{ marginTop: '16px', color: 'var(--color-text-secondary)' }}>Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-window">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        <div className="tab-content">
          {ActiveTabComponent && (
            <ActiveTabComponent
              config={config}
              onConfigChange={handleConfigChange}
            />
          )}
        </div>
      </div>

      <div className="settings-footer">
        <div className="footer-left">
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={handleStartLive}>
            Start Live
          </Button>
          <Button variant="danger" onClick={handleStop}>
            Stop
          </Button>
        </div>
        <div className="footer-right">
          <Button variant="secondary" onClick={handleOpenPrepChat}>
            Open Prep Chat
          </Button>
          <Button variant="secondary" onClick={handleOpenPostAnalysis}>
            Open Post-Analysis
          </Button>
        </div>
      </div>

      {saveStatus && (
        <div style={{ position: 'fixed', bottom: '70px', right: '20px', zIndex: 1000 }}>
          <div className={`status-message ${saveStatus.type}`}>
            {saveStatus.message}
          </div>
        </div>
      )}
    </div>
  );
};
