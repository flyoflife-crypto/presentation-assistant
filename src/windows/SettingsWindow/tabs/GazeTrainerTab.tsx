import React, { useState } from 'react';
import { Button, Toggle } from '../../../shared/ui';

interface GazeTrainerTabProps {
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}

export const GazeTrainerTab: React.FC<GazeTrainerTabProps> = ({ config, onConfigChange }) => {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStatus, setCalibrationStatus] = useState<string | null>(null);

  const gazeEnabled = config.gazeTrainerEnabled !== false;
  const lookAwayThreshold = config.gazeLookAwayThreshold || 3000; // ms
  const attentionThreshold = config.gazeAttentionThreshold || 60; // percentage

  const handleStartCalibration = async () => {
    try {
      setIsCalibrating(true);
      setCalibrationStatus('Initializing camera...');

      // Simulate calibration process
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setCalibrationStatus('Look at point 1 of 9...');
      
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setCalibrationStatus('Calibration complete!');
      
      setTimeout(() => {
        setCalibrationStatus(null);
        setIsCalibrating(false);
      }, 2000);
    } catch (error) {
      setCalibrationStatus('Calibration failed. Please try again.');
      setIsCalibrating(false);
    }
  };

  const handleLookAwayThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange('gazeLookAwayThreshold', parseInt(e.target.value, 10));
  };

  const handleAttentionThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange('gazeAttentionThreshold', parseInt(e.target.value, 10));
  };

  return (
    <div>
      <div className="form-group">
        <Toggle
          checked={gazeEnabled}
          onChange={(checked) => onConfigChange('gazeTrainerEnabled', checked)}
          label="Enable Gaze Tracking"
          ariaLabel="Toggle gaze tracking"
        />
        <p className="form-group-description">
          Monitor your eye contact with the camera during presentations and receive alerts
          when you look away for too long.
        </p>
      </div>

      {gazeEnabled && (
        <>
          <div className="section-header">Calibration</div>

          <div className="form-group">
            <Button
              variant="primary"
              onClick={handleStartCalibration}
              disabled={isCalibrating}
            >
              {isCalibrating ? 'Calibrating...' : 'Start Calibration'}
            </Button>
            {calibrationStatus && (
              <div className={`status-message ${isCalibrating ? 'info' : 'success'}`}>
                {calibrationStatus}
              </div>
            )}
            <p className="form-group-description">
              Calibrate the gaze tracker before your first presentation. This helps the system
              understand your natural eye movement and improve accuracy.
            </p>
          </div>

          <div className="section-header">Alert Thresholds</div>

          <div className="form-group">
            <label htmlFor="look-away-threshold">
              Look-Away Threshold: <span className="range-value">{(lookAwayThreshold / 1000).toFixed(1)}s</span>
            </label>
            <input
              id="look-away-threshold"
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={lookAwayThreshold}
              onChange={handleLookAwayThresholdChange}
              className="range-input"
            />
            <p className="form-group-description">
              Time before alerting you when you're not looking at the camera
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="attention-threshold">
              Attention Threshold: <span className="range-value">{attentionThreshold}%</span>
            </label>
            <input
              id="attention-threshold"
              type="range"
              min="30"
              max="90"
              step="5"
              value={attentionThreshold}
              onChange={handleAttentionThresholdChange}
              className="range-input"
            />
            <p className="form-group-description">
              Minimum percentage of time looking at camera to maintain "good" attention rating
            </p>
          </div>

          <div className="section-header">Privacy Notice</div>

          <div className="status-message info">
            <strong>Privacy:</strong> Gaze tracking uses your webcam but all processing happens locally
            on your device. No video or gaze data is sent to external servers or stored permanently.
          </div>
        </>
      )}

      {!gazeEnabled && (
        <div className="placeholder-content">
          <h3>Gaze Tracking Disabled</h3>
          <p>
            Enable gaze tracking to receive real-time feedback about your eye contact
            and audience engagement during presentations.
          </p>
        </div>
      )}
    </div>
  );
};
