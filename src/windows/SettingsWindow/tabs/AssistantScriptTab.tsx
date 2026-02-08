import React from 'react';
import { TextArea } from '../../../shared/ui';

interface AssistantScriptTabProps {
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert presentation coach assistant. Your role is to provide real-time, actionable feedback to help presenters improve their delivery during live presentations.

Guidelines:
1. Be concise and specific - hints should be under 20 words
2. Focus on one improvement at a time
3. Use encouraging, constructive language
4. Prioritize critical issues (e.g., long pauses, filler words, pacing)
5. Adapt feedback based on the context and content being presented

Common areas to monitor:
- Pacing (too fast/slow)
- Filler words (um, uh, like, you know)
- Engagement (rhetorical questions, pauses for effect)
- Clarity (jargon, complex sentences)
- Energy level
- Transitions between topics

Example hints:
- "Slow down slightly, give audience time to process"
- "Great energy! Keep it up"
- "Try reducing 'um' usage"
- "Pause here for emphasis"`;

export const AssistantScriptTab: React.FC<AssistantScriptTabProps> = ({ config, onConfigChange }) => {
  const systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const handleReset = () => {
    onConfigChange('systemPrompt', DEFAULT_SYSTEM_PROMPT);
  };

  return (
    <div>
      <div className="form-group">
        <label htmlFor="system-prompt">System Prompt</label>
        <TextArea
          value={systemPrompt}
          onChange={(value) => onConfigChange('systemPrompt', value)}
          placeholder="Enter your custom system prompt..."
          maxLength={4000}
          showCounter={true}
          rows={20}
          ariaLabel="System prompt editor"
        />
        <p className="form-group-description">
          This prompt defines how the AI assistant will behave during live presentations.
          It guides the type and style of coaching hints provided.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          className="btn btn-secondary"
          onClick={handleReset}
          style={{ fontSize: '12px', padding: '4px 12px' }}
        >
          Reset to Default
        </button>
      </div>

      <div className="section-header">Tips for Customization</div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Keep instructions clear and specific</li>
          <li>Define the tone and style of feedback you prefer</li>
          <li>Specify which aspects to focus on or ignore</li>
          <li>Include example hints to guide the AI's response format</li>
          <li>Consider your audience and presentation context</li>
        </ul>
      </div>
    </div>
  );
};
