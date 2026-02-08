import React, { useState, useEffect, useRef } from 'react';
import { Button, Select, StatusBadge } from '../../shared/ui';

type CaptureStatus = 'idle' | 'capturing' | 'processing' | 'error';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export const RoomMicCaptureWindow: React.FC = () => {
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isVAD, setIsVAD] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    loadAudioDevices();
    return () => {
      stopCapture();
    };
  }, []);

  const loadAudioDevices = async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = deviceList
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        }));
      
      setDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedDevice) {
        setSelectedDevice(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Failed to enumerate audio devices:', error);
      setErrorMessage('Failed to load audio devices');
    }
  };

  const startCapture = async () => {
    try {
      setStatus('capturing');
      setErrorMessage(null);

      const constraints: MediaStreamConstraints = {
        audio: selectedDevice
          ? { deviceId: { exact: selectedDevice } }
          : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Setup audio context and analyser
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      analyserRef.current = analyser;

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          setStatus('processing');
          
          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            
            // Convert base64 to ArrayBuffer
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            try {
              await window.api.sendAudioChunk({
                buffer: bytes.buffer,
                timestamp: Date.now(),
                sampleRate: 48000, // Default sample rate
              });
            } catch (error) {
              console.error('Failed to send audio chunk:', error);
            }
            
            setStatus('capturing');
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Record in chunks
      mediaRecorder.start(1000); // 1 second chunks

      // Start audio level monitoring
      monitorAudioLevel();

    } catch (error) {
      console.error('Failed to start capture:', error);
      setErrorMessage('Failed to access microphone. Please check permissions.');
      setStatus('error');
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average level
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedLevel = average / 255;
      
      setAudioLevel(normalizedLevel);

      // Voice Activity Detection (simple threshold)
      const vadThreshold = 0.1;
      const isActive = normalizedLevel > vadThreshold;
      
      if (isActive !== isVAD) {
        setIsVAD(isActive);
        
        // Send VAD event
        window.api.sendAudioVAD({
          isSpeech: isActive,
          confidence: normalizedLevel,
          timestamp: Date.now(),
        });
      }

      animationFrameRef.current = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  };

  const stopCapture = () => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setStatus('idle');
    setAudioLevel(0);
    setIsVAD(false);
  };

  const getStatusBadgeType = () => {
    switch (status) {
      case 'capturing':
        return 'active';
      case 'processing':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'inactive';
    }
  };

  return (
    <div className="room-mic-window">
      <div className="mic-header">
        <h1>Room Mic Capture</h1>
        <StatusBadge status={getStatusBadgeType()} label={status} />
      </div>

      <div className="mic-content">
        <div className="device-section">
          <div className="form-group">
            <label>Microphone Device</label>
            <Select
              options={devices.map((d) => ({ value: d.deviceId, label: d.label }))}
              value={selectedDevice}
              onChange={setSelectedDevice}
              disabled={status !== 'idle'}
              placeholder="Select microphone..."
            />
            {devices.length === 0 && (
              <p className="help-text">No microphone devices found</p>
            )}
          </div>
        </div>

        <div className="visualizer-section">
          <h3>Audio Level</h3>
          <div className="audio-level-meter">
            <div
              className="audio-level-bar"
              style={{
                width: `${audioLevel * 100}%`,
                backgroundColor: isVAD ? 'var(--color-success)' : 'var(--color-primary)',
              }}
            />
          </div>
          <div className="level-info">
            <span className="level-value">{(audioLevel * 100).toFixed(1)}%</span>
            {isVAD && <span className="vad-indicator">🎤 Voice Detected</span>}
          </div>
        </div>

        {errorMessage && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}

        <div className="info-section">
          <h3>Status Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className="info-value">{status}</span>
            </div>
            <div className="info-item">
              <span className="info-label">VAD:</span>
              <span className="info-value">{isVAD ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Device:</span>
              <span className="info-value">
                {devices.find((d) => d.deviceId === selectedDevice)?.label || 'None'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mic-footer">
        {status === 'idle' ? (
          <Button
            variant="primary"
            onClick={startCapture}
            disabled={!selectedDevice || devices.length === 0}
          >
            Start Capture
          </Button>
        ) : (
          <Button variant="danger" onClick={stopCapture}>
            Stop Capture
          </Button>
        )}
      </div>
    </div>
  );
};
