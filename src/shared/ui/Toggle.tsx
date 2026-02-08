import React from 'react';
import { ToggleProps } from '../types';
import '../styles/common.css';

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  ariaLabel,
  className = '',
}) => {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const switchClass = `toggle-switch ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`.trim();

  return (
    <div className={`toggle-container ${className}`.trim()}>
      <div
        className={switchClass}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label}
        tabIndex={disabled ? -1 : 0}
      >
        <div className="toggle-slider" />
      </div>
      {label && (
        <span className="toggle-label" onClick={handleClick}>
          {label}
        </span>
      )}
    </div>
  );
};
