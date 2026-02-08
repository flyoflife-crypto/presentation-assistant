import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoomMicCaptureWindow } from './RoomMicCaptureWindow';
import '../../shared/styles/common.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <RoomMicCaptureWindow />
  </React.StrictMode>
);
