import React, { useState, useEffect, useRef } from 'react';
import { Button, TextArea } from '../../shared/ui';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const PrepChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // For now, use a simple echo response
      // In real implementation, this would call a chat API endpoint
      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: `I received your message: "${input}". This is a placeholder response. Connect to OpenAI Responses API for real chat functionality.`,
        timestamp: new Date(),
      };
      
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      
      // Add error message to chat
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: '⚠️ Failed to get response. Please check your OpenAI API key in Settings.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClear = () => {
    if (window.confirm('Clear all messages?')) {
      setMessages([]);
      setError(null);
    }
  };

  return (
    <div className="prep-chat-window">
      <div className="chat-header">
        <h1>Prep Chat</h1>
        <div className="header-actions">
          {messages.length > 0 && (
            <Button variant="secondary" onClick={handleClear}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Welcome to Prep Chat</h3>
            <p>
              Use this chat to prepare for your presentation. Ask questions, practice responses,
              or discuss your presentation strategy.
            </p>
            <p className="hint">Start by typing a message below.</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`message message-${message.role}`}>
                <div className="message-header">
                  <span className="message-role">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                  <span className="message-time">{formatTime(message.timestamp)}</span>
                </div>
                <div className="message-content">{message.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message message-assistant loading">
                <div className="message-header">
                  <span className="message-role">Assistant</span>
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-section">
        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}
        <div className="input-wrapper">
          <TextArea
            value={input}
            onChange={setInput}
            placeholder="Type your message... (Ctrl/Cmd + Enter to send)"
            rows={3}
            disabled={isLoading}
            ariaLabel="Chat message input"
          />
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
};
