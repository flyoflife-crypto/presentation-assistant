import React from 'react';
import { Toggle } from '../../../shared/ui';

interface PrivacyTabProps {
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}

export const PrivacyTab: React.FC<PrivacyTabProps> = ({ config, onConfigChange }) => {
  const saveTranscripts = config.saveTranscripts !== false;
  const saveRecordings = config.saveRecordings !== false;
  const showStatusIndicators = config.showStatusIndicators !== false;
  const showRecordingIndicator = config.showRecordingIndicator !== false;
  const autoDeleteAfterDays = config.autoDeleteAfterDays || 30;

  const handleAutoDeleteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange('autoDeleteAfterDays', parseInt(e.target.value, 10));
  };

  return (
    <div>
      <div className="section-header">Session Data</div>

      <div className="form-group">
        <Toggle
          checked={saveTranscripts}
          onChange={(checked) => onConfigChange('saveTranscripts', checked)}
          label="Save Session Transcripts"
          ariaLabel="Toggle save transcripts"
        />
        <p className="form-group-description">
          Save text transcripts of your presentations for post-session analysis and review.
          Transcripts are stored locally on your device.
        </p>
      </div>

      <div className="form-group">
        <Toggle
          checked={saveRecordings}
          onChange={(checked) => onConfigChange('saveRecordings', checked)}
          label="Save Audio Recordings"
          ariaLabel="Toggle save recordings"
        />
        <p className="form-group-description">
          Save audio recordings of presentations when using Room Microphone mode.
          Recordings are stored locally and can be used for detailed post-analysis.
        </p>
      </div>

      {(saveTranscripts || saveRecordings) && (
        <div className="form-group">
          <label htmlFor="auto-delete">
            Auto-delete after: <span className="range-value">{autoDeleteAfterDays} days</span>
          </label>
          <input
            id="auto-delete"
            type="range"
            min="7"
            max="365"
            step="1"
            value={autoDeleteAfterDays}
            onChange={handleAutoDeleteChange}
            className="range-input"
          />
          <p className="form-group-description">
            Automatically delete saved transcripts and recordings after this many days.
            Set to 365 for long-term storage.
          </p>
        </div>
      )}

      <div className="section-header">Status Indicators</div>

      <div className="form-group">
        <Toggle
          checked={showStatusIndicators}
          onChange={(checked) => onConfigChange('showStatusIndicators', checked)}
          label="Show Live Session Indicators"
          ariaLabel="Toggle status indicators"
        />
        <p className="form-group-description">
          Display visual indicators when a live coaching session is active.
          Helps you quickly identify when the assistant is listening.
        </p>
      </div>

      <div className="form-group">
        <Toggle
          checked={showRecordingIndicator}
          onChange={(checked) => onConfigChange('showRecordingIndicator', checked)}
          label="Show Recording Indicator"
          ariaLabel="Toggle recording indicator"
        />
        <p className="form-group-description">
          Display a recording indicator when audio is being captured and saved.
          Important for transparency and compliance in professional settings.
        </p>
      </div>

      <div className="section-header">Data Location & Security</div>

      <div style={{ 
        padding: '16px', 
        backgroundColor: 'var(--color-background-secondary)', 
        borderRadius: 'var(--border-radius)',
        fontSize: '12px',
        lineHeight: '1.6',
        color: 'var(--color-text-secondary)',
      }}>
        <p style={{ margin: '0 0 12px 0' }}>
          <strong>Local Storage:</strong> All session data (transcripts, recordings, settings) 
          is stored locally on your device. Nothing is sent to external servers except OpenAI 
          API calls for AI processing.
        </p>
        <p style={{ margin: '0 0 12px 0' }}>
          <strong>API Key Security:</strong> Your OpenAI API key is stored in your system's 
          secure credential storage (Keychain on macOS, Credential Manager on Windows).
        </p>
        <p style={{ margin: '0' }}>
          <strong>Data Path:</strong> Session data is stored in your user directory at:<br />
          <code style={{ 
            fontSize: '11px', 
            padding: '2px 6px',
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
            fontFamily: 'monospace',
          }}>
            ~/Library/Application Support/presentation-assistant/
          </code>
        </p>
      </div>

      <div className="section-header">Compliance & Best Practices</div>

      <div className="status-message warning" style={{ marginTop: '16px' }}>
        <strong>Important:</strong> When presenting to others, especially in professional or 
        recorded settings, inform participants that you're using AI-assisted coaching tools. 
        This maintains transparency and may be required by company policies or regulations.
      </div>
    </div>
  );
};
