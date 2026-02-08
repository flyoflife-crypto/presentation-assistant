import React, { useState, useEffect } from 'react';

interface TeleprompterConfig {
  position: { x: number; y: number };
  fontSize: number;
  opacity: number;
  ttlSeconds: number;
  shareSafeMode: boolean;
}

export const TeleprompterWindow: React.FC = () => {
  const [hint, setHint] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [config, setConfig] = useState<TeleprompterConfig>({
    position: { x: 100, y: 100 },
    fontSize: 24,
    opacity: 0.9,
    ttlSeconds: 10,
    shareSafeMode: false,
  });

  useEffect(() => {
    // Load config
    const loadConfig = async () => {
      try {
        const allConfig = await window.api.getAllConfig();
        if (allConfig) {
          setConfig({
            position: allConfig.teleprompterPosition || { x: 100, y: 100 },
            fontSize: allConfig.teleprompterFontSize || 24,
            opacity: allConfig.teleprompterOpacity || 0.9,
            ttlSeconds: allConfig.teleprompterTTL || 10,
            shareSafeMode: allConfig.shareSafeMode || false,
          });
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };

    loadConfig();

    // Listen for hints
    const unsubscribe = window.api.onCoachHint((payload) => {
      if (payload.text) {
        showHint(payload.text);
      }
    });

    return unsubscribe;
  }, []);

  const showHint = (text: string) => {
    setHint(text);
    setIsVisible(true);
    setIsFading(false);

    // Start fade out after TTL
    const fadeTimeout = setTimeout(() => {
      setIsFading(true);
    }, config.ttlSeconds * 1000);

    // Hide completely after fade animation
    const hideTimeout = setTimeout(() => {
      setIsVisible(false);
      setHint(null);
    }, (config.ttlSeconds + 1) * 1000); // +1 for fade duration

    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(hideTimeout);
    };
  };

  if (!isVisible && !config.shareSafeMode) {
    return null;
  }

  return (
    <div
      className="teleprompter-window"
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
      }}
    >
      {isVisible && hint && (
        <div
          className={`hint-container ${isFading ? 'fade-out' : 'fade-in'}`}
          style={{
            position: 'absolute',
            left: config.position.x,
            top: config.position.y,
            fontSize: `${config.fontSize}px`,
            opacity: config.opacity,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            maxWidth: '500px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          {hint}
        </div>
      )}

      {config.shareSafeMode && (
        <div
          className="watermark"
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.3)',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '4px 8px',
            borderRadius: '4px',
            pointerEvents: 'none',
          }}
        >
          Assistant Active
        </div>
      )}
    </div>
  );
};
