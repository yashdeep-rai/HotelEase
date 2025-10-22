import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Theme , ThemePanel } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Theme grayColor="olive" radius="large">
      <App />
      <ThemePanel />
    </Theme>
  </React.StrictMode>
);