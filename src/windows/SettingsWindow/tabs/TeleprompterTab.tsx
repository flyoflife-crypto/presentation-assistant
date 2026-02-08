import React from 'react';
import { Select, Toggle } from '../../../shared/ui';

interface TeleprompterTabProps {
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}

const fontSizeOptions = [
  { value: '14', label: 'Small (14px)' },
  { value: '16', label: 'Medium (16px)' },
  { value: '18', label: 'Large (18px)' },
  { value: '20', label: 'Extra Large (20px)' },
  { value: '24', label: 'Huge (24px)' },
];

const positionOptions = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

export const TeleprompterTab: React.FC<TeleprompterTabProps> = ({ config, onConfigChange }) => {
  const fontSize = config.teleprompterFontSize || '16';
  const opacity = config.teleprompterOpacity || 90;
  const position = config.teleprompterPosition || 'bottom-center';
  const showWatermark = config.teleprompterWatermark !== false;

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange('teleprompterOpacity', parseInt(e.target.value, 10));
  };

  return (
    <div>
      <div className="section-header">Display Settings</div>

      <div className="form-group">
        <label htmlFor="font-size">Font Size</label>
        <Select
          options={fontSizeOptions}
          value={fontSize}
          onChange={(value) => onConfigChange('teleprompterFontSize', value)}
          ariaLabel="Select font size"
        />
        <p className="form-group-description">
          Choose a font size that's readable from your presenting distance
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="opacity">
          Opacity: <span className="range-value">{opacity}%</span>
        </label>
        <input
          id="opacity"
          type="range"
          min="20"
          max="100"
          step="5"
          value={opacity}
          onChange={handleOpacityChange}
          className="range-input"
        />
        <p className="form-group-description">
          Adjust transparency of the teleprompter overlay
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="position">Screen Position</label>
        <Select
          options={positionOptions}
          value={position}
          onChange={(value) => onConfigChange('teleprompterPosition', value)}
          ariaLabel="Select screen position"
        />
        <p className="form-group-description">
          Position of the teleprompter hints on your screen
        </p>
      </div>

      <div className="section-header">Privacy & Sharing</div>

      <div className="form-group">
        <Toggle
          checked={showWatermark}
          onChange={(checked) => onConfigChange('teleprompterWatermark', checked)}
          label="Show 'COACH' watermark"
          ariaLabel="Toggle watermark display"
        />
        <p className="form-group-description">
          Display a subtle watermark to indicate coach hints are visible. 
          Recommended when screen sharing to maintain transparency with your audience.
        </p>
      </div>

      <div className="section-header">Preview</div>

      <div
        style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: 'var(--color-background-secondary)',
          borderRadius: 'var(--border-radius)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            fontSize: `${fontSize}px`,
            opacity: opacity / 100,
            textAlign: position.includes('center') ? 'center' : position.includes('right') ? 'right' : 'left',
            color: 'var(--color-text)',
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          This is a preview of your teleprompter hint
          {showWatermark && (
            <span style={{ 
              marginLeft: '8px',
              fontSize: '10px',
              opacity: 0.4,
              fontWeight: 400,
            }}>
              [COACH]
            </span>
          )}
        </div>
      </div>

      <div className="status-message info" style={{ marginTop: '16px' }}>
        <strong>Tip:</strong> The teleprompter window will appear as a floating overlay during live sessions.
        Press Ctrl+H (Cmd+H on Mac) to quickly hide/show hints.
      </div>
    </div>
  );
};
