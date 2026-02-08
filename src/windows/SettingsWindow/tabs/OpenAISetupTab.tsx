import React, { useState } from 'react';
import { Button, Select } from '../../../shared/ui';

interface OpenAISetupTabProps {
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}

const modelOptions = [
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

const latencyTargetOptions = [
  { value: '500', label: 'Very Fast (500ms)' },
  { value: '1000', label: 'Fast (1s)' },
  { value: '2000', label: 'Balanced (2s)' },
  { value: '3000', label: 'Detailed (3s)' },
];

export const OpenAISetupTab: React.FC<OpenAISetupTabProps> = ({ config, onConfigChange }) => {
  const [apiKey, setApiKey] = useState(config.openaiApiKey || '');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    onConfigChange('openaiApiKey', value);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    try {
      setIsTestingConnection(true);
      setTestResult(null);

      const result = await window.api.testOpenAIConnection({ apiKey });

      if (result.success) {
        setTestResult({
          success: true,
          message: `Connection successful! Latency: ${result.latency}ms`,
          latency: result.latency,
        });
        // Also save the key if test is successful
        await window.api.saveOpenAIKey({ apiKey });
      } else {
        setTestResult({
          success: false,
          message: `Connection failed: ${result.error || 'Unknown error'}`,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div>
      <div className="form-group">
        <label htmlFor="api-key">OpenAI API Key</label>
        <div className="input-with-button">
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder="sk-..."
            disabled={isTestingConnection}
          />
          <Button
            variant="secondary"
            onClick={handleTestConnection}
            disabled={isTestingConnection || !apiKey.trim()}
          >
            {isTestingConnection ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
        <p className="form-group-description">
          Your OpenAI API key is stored securely in the system keychain
        </p>
        {testResult && (
          <div className={`status-message ${testResult.success ? 'success' : 'error'}`}>
            {testResult.message}
          </div>
        )}
      </div>

      <div className="section-header">Model Configuration</div>

      <div className="form-group">
        <label htmlFor="coach-model">Coach Model</label>
        <Select
          options={modelOptions}
          value={config.coachModel || 'gpt-4-turbo'}
          onChange={(value) => onConfigChange('coachModel', value)}
          ariaLabel="Select coach model"
        />
        <p className="form-group-description">
          Model used for real-time coaching hints during presentations
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="prep-model">Prep Chat Model</label>
        <Select
          options={modelOptions}
          value={config.prepModel || 'gpt-4'}
          onChange={(value) => onConfigChange('prepModel', value)}
          ariaLabel="Select prep chat model"
        />
        <p className="form-group-description">
          Model used for pre-presentation preparation conversations
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="analysis-model">Post-Analysis Model</label>
        <Select
          options={modelOptions}
          value={config.analysisModel || 'gpt-4'}
          onChange={(value) => onConfigChange('analysisModel', value)}
          ariaLabel="Select analysis model"
        />
        <p className="form-group-description">
          Model used for post-presentation analysis and feedback
        </p>
      </div>

      <div className="section-header">Performance</div>

      <div className="form-group">
        <label htmlFor="latency-target">Latency Target</label>
        <Select
          options={latencyTargetOptions}
          value={config.latencyTarget || '2000'}
          onChange={(value) => onConfigChange('latencyTarget', value)}
          ariaLabel="Select latency target"
        />
        <p className="form-group-description">
          Target response time for coaching hints. Lower values may reduce response detail.
        </p>
      </div>
    </div>
  );
};
