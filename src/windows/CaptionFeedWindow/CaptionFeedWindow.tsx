import React, { useState, useEffect, useRef } from 'react';
import { Button, TextArea, StatusBadge } from '../../shared/ui';

interface Caption {
  id: string;
  text: string;
  timestamp: Date;
  source: 'manual' | 'file' | 'adapter';
}

interface CaptionStatus {
  adapterType: string;
  lastIngestTime: Date | null;
  isActive: boolean;
}

export const CaptionFeedWindow: React.FC = () => {
  const [captionInput, setCaptionInput] = useState('');
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [status, setStatus] = useState<CaptionStatus>({
    adapterType: 'manual',
    lastIngestTime: null,
    isActive: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribeStatus = window.api.onCaptionStatus((payload) => {
      setStatus({
        adapterType: payload.source || 'manual',
        lastIngestTime: payload.lastIngestAt ? new Date(payload.lastIngestAt) : null,
        isActive: payload.active || false,
      });
    });

    const unsubscribeTranscript = window.api.onTranscriptSegment((payload) => {
      const newCaption: Caption = {
        id: `${Date.now()}-${Math.random()}`,
        text: payload.text,
        timestamp: new Date(),
        source: 'adapter',
      };
      setCaptions((prev) => [...prev, newCaption]);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeTranscript();
    };
  }, []);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions]);

  const handleSubmit = async () => {
    if (!captionInput.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      await window.api.ingestCaption({
        text: captionInput,
        timestamp: Date.now(),
        source: 'manual',
      });

      const newCaption: Caption = {
        id: `${Date.now()}-${Math.random()}`,
        text: captionInput,
        timestamp: new Date(),
        source: 'manual',
      };
      
      setCaptions((prev) => [...prev, newCaption]);
      setCaptionInput('');
    } catch (error) {
      console.error('Failed to submit caption:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusType = () => {
    if (status.isActive) return 'active';
    if (status.lastIngestTime) return 'warning';
    return 'inactive';
  };

  return (
    <div className="caption-feed-window">
      <div className="caption-header">
        <h1>Caption Feed</h1>
        <div className="status-indicators">
          <StatusBadge
            status={getStatusType()}
            label={status.isActive ? 'Active' : 'Inactive'}
          />
          <span className="adapter-type">
            Source: {status.adapterType}
          </span>
          {status.lastIngestTime && (
            <span className="last-ingest">
              Last: {formatTime(status.lastIngestTime)}
            </span>
          )}
        </div>
      </div>

      <div className="caption-input-section">
        <TextArea
          value={captionInput}
          onChange={setCaptionInput}
          placeholder="Paste or type captions here (Ctrl/Cmd + Enter to submit)"
          rows={3}
          disabled={isSubmitting}
          ariaLabel="Caption input"
        />
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!captionInput.trim() || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Caption'}
        </Button>
      </div>

      <div className="caption-feed">
        <div className="feed-header">
          <h2>Live Feed</h2>
          <span className="caption-count">{captions.length} captions</span>
        </div>
        <div className="feed-content">
          {captions.length === 0 ? (
            <div className="empty-state">
              <p>No captions yet. Submit a caption or start a live session.</p>
            </div>
          ) : (
            captions.map((caption) => (
              <div key={caption.id} className="caption-item">
                <div className="caption-meta">
                  <span className="caption-time">{formatTime(caption.timestamp)}</span>
                  <span className={`caption-source source-${caption.source}`}>
                    {caption.source}
                  </span>
                </div>
                <div className="caption-text">{caption.text}</div>
              </div>
            ))
          )}
          <div ref={feedEndRef} />
        </div>
      </div>
    </div>
  );
};
