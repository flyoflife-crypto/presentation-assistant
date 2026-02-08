import React from 'react';
import { createRoot } from 'react-dom/client';

const PlaceholderWindow: React.FC = () => {
  return <div>Window placeholder - to be implemented</div>;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<PlaceholderWindow />);
}
