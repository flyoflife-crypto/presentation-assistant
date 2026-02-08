import React, { useState, useEffect, useRef } from 'react';
import { Button, StatusBadge } from '../../shared/ui';

type GazeStatus = 'idle' | 'initializing' | 'calibrating' | 'active' | 'paused' | 'error';

interface GazePoint {
  x: number;
  y: number;
}

interface CalibrationPoint {
  x: number;
  y: number;
  completed: boolean;
}

export const GazeTrainerWindow: React.FC = () => {
  const [status, setStatus] = useState<GazeStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gazePosition, setGazePosition] = useState<GazePoint>({ x: 0, y: 0 });
  const [confidence, setConfidence] = useState<number>(0);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [currentCalibrationIndex, setCurrentCalibrationIndex] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Initialize calibration points (3x3 grid)
    const points: CalibrationPoint[] = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        points.push({
          x: (col + 1) * 25, // 25%, 50%, 75%
          y: (row + 1) * 25, // 25%, 50%, 75%
          completed: false,
        });
      }
    }
    setCalibrationPoints(points);
  }, []);

  const initializeWebGazer = async () => {
    try {
      setStatus('initializing');
      setErrorMessage(null);

      // Check if camera is available
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus('calibrating');
    } catch (error) {
      console.error('Failed to initialize camera:', error);
      setErrorMessage('Failed to access camera. Please grant camera permissions.');
      setStatus('error');
    }
  };

  const startCalibration = () => {
    setStatus('calibrating');
    setCurrentCalibrationIndex(0);
    setCalibrationPoints((prev) =>
      prev.map((point) => ({ ...point, completed: false }))
    );
  };

  const handleCalibrationClick = (index: number) => {
    if (status !== 'calibrating' || index !== currentCalibrationIndex) return;

    // Mark point as completed
    setCalibrationPoints((prev) =>
      prev.map((point, i) =>
        i === index ? { ...point, completed: true } : point
      )
    );

    // Move to next point
    if (index < calibrationPoints.length - 1) {
      setCurrentCalibrationIndex(index + 1);
    } else {
      // Calibration complete
      setStatus('active');
      startTracking();
    }
  };

  const startTracking = () => {
    setStatus('active');
    
    // Simulate gaze tracking (in real implementation, use WebGazer.js)
    const trackingInterval = setInterval(() => {
      // Simulate gaze data
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      const conf = 0.7 + Math.random() * 0.3;

      setGazePosition({ x, y });
      setConfidence(conf);

      // Send gaze metrics via API
      window.api.sendGazeMetric({
        x,
        y,
        confidence: conf,
        timestamp: Date.now(),
      });

      // Draw gaze dot
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.fillStyle = `rgba(0, 122, 255, ${conf})`;
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }, 100);

    return () => clearInterval(trackingInterval);
  };

  const handlePause = () => {
    setStatus('paused');
  };

  const handleResume = () => {
    startTracking();
  };

  const handleStop = () => {
    setStatus('idle');
    setGazePosition({ x: 0, y: 0 });
    setConfidence(0);
    
    // Stop video stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const getStatusBadgeType = () => {
    switch (status) {
      case 'active':
        return 'active';
      case 'calibrating':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'inactive';
    }
  };

  return (
    <div className="gaze-trainer-window">
      <div className="gaze-header">
        <h1>Gaze Trainer</h1>
        <StatusBadge status={getStatusBadgeType()} label={status} />
      </div>

      <div className="gaze-content">
        {status === 'idle' && (
          <div className="idle-state">
            <h2>Eye Tracking Setup</h2>
            <p>
              This tool uses your webcam to track where you're looking during your presentation.
              You'll need to calibrate by looking at several points on the screen.
            </p>
            <Button variant="primary" onClick={initializeWebGazer}>
              Start Setup
            </Button>
          </div>
        )}

        {status === 'initializing' && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Initializing camera...</p>
          </div>
        )}

        {status === 'calibrating' && (
          <div className="calibration-container">
            <div className="calibration-instructions">
              <h3>Calibration</h3>
              <p>
                Click each point while looking directly at it. Progress: {currentCalibrationIndex + 1} / {calibrationPoints.length}
              </p>
            </div>
            <div className="calibration-grid">
              {calibrationPoints.map((point, index) => (
                <div
                  key={index}
                  className={`calibration-point ${
                    point.completed ? 'completed' : ''
                  } ${index === currentCalibrationIndex ? 'active' : ''}`}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                  }}
                  onClick={() => handleCalibrationClick(index)}
                >
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        )}

        {(status === 'active' || status === 'paused') && (
          <>
            <div className="tracking-overlay">
              <canvas
                ref={canvasRef}
                width={window.innerWidth}
                height={window.innerHeight}
                className="gaze-canvas"
              />
            </div>
            <div className="metrics-panel">
              <div className="metric">
                <span className="metric-label">Gaze X:</span>
                <span className="metric-value">{Math.round(gazePosition.x)}px</span>
              </div>
              <div className="metric">
                <span className="metric-label">Gaze Y:</span>
                <span className="metric-value">{Math.round(gazePosition.y)}px</span>
              </div>
              <div className="metric">
                <span className="metric-label">Confidence:</span>
                <span className="metric-value">{(confidence * 100).toFixed(1)}%</span>
              </div>
            </div>
          </>
        )}

        {status === 'error' && (
          <div className="error-state">
            <h3>Error</h3>
            <p>{errorMessage}</p>
            <Button variant="primary" onClick={() => setStatus('idle')}>
              Try Again
            </Button>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          className={`camera-preview ${status === 'active' || status === 'paused' ? 'small' : ''}`}
        />
      </div>

      <div className="gaze-footer">
        {status === 'calibrating' && (
          <Button variant="secondary" onClick={handleStop}>
            Cancel
          </Button>
        )}
        {status === 'active' && (
          <>
            <Button variant="secondary" onClick={handlePause}>
              Pause
            </Button>
            <Button variant="secondary" onClick={startCalibration}>
              Recalibrate
            </Button>
            <Button variant="danger" onClick={handleStop}>
              Stop
            </Button>
          </>
        )}
        {status === 'paused' && (
          <>
            <Button variant="primary" onClick={handleResume}>
              Resume
            </Button>
            <Button variant="danger" onClick={handleStop}>
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
