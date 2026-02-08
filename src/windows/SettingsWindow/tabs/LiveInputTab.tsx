import React, { useState, useEffect } from 'react';
import { Select } from '../../../shared/ui';

interface LiveInputTabProps {
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}

const captionSourceOptions = [
  { value: 'manual', label: 'Manual Input' },
  { value: 'file', label: 'File Monitor' },
  { value: 'clipboard', label: 'Clipboard Monitor' },
];

export const LiveInputTab: React.FC<LiveInputTabProps> = ({ config, onConfigChange }) => {
  const [micDevices, setMicDevices] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  const liveInputMode = config.liveInputMode || 'CAPTIONS';
  const captionSource = config.captionSource || 'manual';
  const captionFilePath = config.captionFilePath || '';
  const micDeviceId = config.micDeviceId || 'default';

  useEffect(() => {
    if (liveInputMode === 'ROOM_MIC') {
      loadMicDevices();
    }
  }, [liveInputMode]);

  const loadMicDevices = async () => {
    try {
      setIsLoadingDevices(true);
      // Request microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === 'audioinput');
      
      const deviceOptions = audioInputs.map((device) => ({
        value: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
      }));

      // Add default option
      deviceOptions.unshift({ value: 'default', label: 'Default Microphone' });
      
      setMicDevices(deviceOptions);
      
      // Stop the stream
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.error('Failed to load microphone devices:', error);
      setMicDevices([{ value: 'default', label: 'Default Microphone' }]);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleFilePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange('captionFilePath', e.target.value);
  };

  const handleBrowseFile = async () => {
    // Note: Electron's dialog would be used here in production
    // For now, just alert that this would trigger a file picker
    alert('File picker would open here (requires Electron IPC implementation)');
  };

  return (
    <div>
      <div className="section-header">Input Source</div>

      <div className="form-group">
        <label>Live Input Mode</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="liveInputMode"
              value="CAPTIONS"
              checked={liveInputMode === 'CAPTIONS'}
              onChange={() => onConfigChange('liveInputMode', 'CAPTIONS')}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px' }}>Captions Mode</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="liveInputMode"
              value="ROOM_MIC"
              checked={liveInputMode === 'ROOM_MIC'}
              onChange={() => onConfigChange('liveInputMode', 'ROOM_MIC')}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px' }}>Room Microphone Mode</span>
          </label>
        </div>
        <p className="form-group-description">
          {liveInputMode === 'CAPTIONS'
            ? 'Use external captions (Zoom, Teams, OBS) as the speech input source'
            : 'Use a room microphone to capture live audio for transcription'}
        </p>
      </div>

      {liveInputMode === 'CAPTIONS' && (
        <>
          <div className="section-header">Caption Adapter</div>

          <div className="form-group">
            <label htmlFor="caption-source">Caption Source</label>
            <Select
              options={captionSourceOptions}
              value={captionSource}
              onChange={(value) => onConfigChange('captionSource', value)}
              ariaLabel="Select caption source"
            />
            <p className="form-group-description">
              {captionSource === 'manual' && 'Enter captions manually via the Caption Feed window'}
              {captionSource === 'file' && 'Monitor a file for new caption lines (e.g., OBS output)'}
              {captionSource === 'clipboard' && 'Automatically detect captions copied to clipboard'}
            </p>
          </div>

          {captionSource === 'file' && (
            <div className="form-group">
              <label htmlFor="caption-file">Caption File Path</label>
              <div className="input-with-button">
                <input
                  id="caption-file"
                  type="text"
                  value={captionFilePath}
                  onChange={handleFilePathChange}
                  placeholder="/path/to/captions.txt"
                />
                <button className="btn btn-secondary" onClick={handleBrowseFile}>
                  Browse
                </button>
              </div>
              <p className="form-group-description">
                Select a text file to monitor for caption updates
              </p>
            </div>
          )}
        </>
      )}

      {liveInputMode === 'ROOM_MIC' && (
        <>
          <div className="section-header">Microphone Settings</div>

          <div className="form-group">
            <label htmlFor="mic-device">Microphone Device</label>
            <Select
              options={micDevices}
              value={micDeviceId}
              onChange={(value) => onConfigChange('micDeviceId', value)}
              ariaLabel="Select microphone device"
              disabled={isLoadingDevices}
            />
            <p className="form-group-description">
              {isLoadingDevices
                ? 'Loading available microphones...'
                : 'Select the microphone device to capture room audio'}
            </p>
          </div>

          {micDevices.length === 0 && !isLoadingDevices && (
            <div className="status-message error">
              No microphone devices found. Please ensure a microphone is connected and permissions are granted.
            </div>
          )}
        </>
      )}
    </div>
  );
};
