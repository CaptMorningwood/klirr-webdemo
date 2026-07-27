import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkRoot } from './auth/clerk/ClerkRoot';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkRoot>
      <App />
    </ClerkRoot>
  </React.StrictMode>,
);
