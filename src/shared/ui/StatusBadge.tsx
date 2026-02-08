import React from 'react';
import { StatusBadgeProps } from '../types';
import '../styles/common.css';

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
}) => {
  const badgeClass = `status-badge status-badge-${status} ${className}`.trim();

  const defaultLabels: Record<typeof status, string> = {
    active: 'Active',
    inactive: 'Inactive',
    error: 'Error',
    warning: 'Warning',
  };

  const displayLabel = label || defaultLabels[status];

  return (
    <div className={badgeClass} role="status" aria-label={`Status: ${displayLabel}`}>
      <span className="status-badge-dot" />
      <span>{displayLabel}</span>
    </div>
  );
};
