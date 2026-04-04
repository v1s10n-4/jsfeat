import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { startOrientationTracking, lockOrientation } from './lib/videoOrientation';

// iOS orientation correction for video streams
startOrientationTracking();
lockOrientation();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
