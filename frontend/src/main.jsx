import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Fonts bundled from npm so the app works offline (FRONTEND_PROMPT §1)
import '@fontsource/fraunces/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/document.css';
import './styles/print.css';

import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Opt in to the React Router v7 behaviours now (silences the v6 "future flag" console warnings) */}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
