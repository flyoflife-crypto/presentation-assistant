import React from 'react';
import { TextAreaProps } from '../types';
import '../styles/common.css';

export const TextArea: React.FC<TextAreaProps> = ({
  value,
  onChange,
  placeholder = '',
  maxLength,
  showCounter = false,
  rows = 4,
  disabled = false,
  ariaLabel,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const currentLength = value.length;
  const isLimitReached = maxLength !== undefined && currentLength >= maxLength;

  return (
    <div className={`textarea-container ${className}`.trim()}>
      <textarea
        className="textarea"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      {showCounter && maxLength !== undefined && (
        <div className={`textarea-counter ${isLimitReached ? 'limit-reached' : ''}`}>
          {currentLength} / {maxLength}
        </div>
      )}
    </div>
  );
};
