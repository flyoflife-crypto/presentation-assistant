import React from 'react';
import { ButtonProps } from '../types';
import '../styles/common.css';

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  disabled = false,
  onClick,
  children,
  type = 'button',
  className = '',
}) => {
  const buttonClass = `btn btn-${variant} ${className}`.trim();

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
