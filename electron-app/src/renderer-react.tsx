import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Create root element
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// Render the app
// Disable StrictMode to prevent double execution of effects
root.render(
  <App />
);