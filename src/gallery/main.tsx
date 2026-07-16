import '@fontsource-variable/newsreader';
import '@fontsource/ibm-plex-mono/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Gallery root element is missing.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
