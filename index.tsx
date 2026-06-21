
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DatabaseProvider } from './contexts/DatabaseContext';
import GoalAnimationPreview from './components/animation/GoalAnimationPreview';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Rota isolada de preview da animação de gol (sem login). Apenas para
// visualização/aprovação antes de integrar ao fluxo ao vivo.
if (window.location.pathname.startsWith('/animation')) {
  root.render(
    <React.StrictMode>
      <GoalAnimationPreview />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <DatabaseProvider>
          <App />
      </DatabaseProvider>
    </React.StrictMode>
  );
}
