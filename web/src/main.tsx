import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

/**
 * HashRouter, а не BrowserRouter — сознательно.
 * Сборка должна открываться двойным кликом с флешки в школьном кабинете,
 * где нет ни сервера, ни интернета. На file:// history-API не работает,
 * а хеш-маршруты работают.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
