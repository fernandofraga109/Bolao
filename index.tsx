
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DatabaseProvider } from './contexts/DatabaseContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <DatabaseProvider>
        <App />
    </DatabaseProvider>
  </React.StrictMode>
);
