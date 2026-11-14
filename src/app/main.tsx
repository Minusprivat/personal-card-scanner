import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

// Neue Versionen übernimmt der Service Worker beim nächsten Start von selbst.
registerSW({ immediate: true });

// Bittet den Browser, die Sammlung nicht bei Speichermangel zu löschen.
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
