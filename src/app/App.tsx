import { useState } from 'react';
import { CardDetail } from './CardDetail';
import { CollectionView } from './CollectionView';
import { FilesView } from './FilesView';
import { useAvailableUpdate, useCatalog, usePrices, useRoute, useStock } from './hooks';

const APK_URL = 'https://github.com/Minusprivat/personal-card-scanner/releases/download/apk/card-scanner.apk';
const DISMISSED_UPDATE = 'dismissedUpdate';

export function App() {
  const catalog = useCatalog();
  const stock = useStock();
  const route = useRoute();
  const prices = usePrices();
  const update = useAvailableUpdate();
  // Nicht jede neue Version bringt etwas Sichtbares; der Hinweis lässt sich je Version wegklicken.
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_UPDATE));
  const dismiss = (version: string) => {
    localStorage.setItem(DISMISSED_UPDATE, version);
    setDismissed(version);
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          Card Scanner
        </a>
        <nav>
          <a href="#/" aria-current={route.page !== 'files' ? 'page' : undefined}>
            Sammlung
          </a>
          <a href="#/datei" aria-current={route.page === 'files' ? 'page' : undefined}>
            Sicherung
          </a>
        </nav>
      </header>

      {update && update !== dismissed && (
        <p className="notice ok">
          Version {update} ist verfügbar.{' '}
          <a className="textlink" href={APK_URL} target="_blank" rel="noopener">
            Neue APK laden
          </a>{' '}
          und über die vorhandene App installieren; die Sammlung bleibt erhalten.{' '}
          <button type="button" className="link" onClick={() => dismiss(update)}>
            Später
          </button>
        </p>
      )}

      {catalog.status === 'loading' && <p className="notice">Katalog wird geladen …</p>}
      {catalog.status === 'error' && (
        <p className="notice error">
          Der Katalog ließ sich nicht laden ({catalog.message}). Beim ersten Start braucht die App eine
          Internetverbindung.
        </p>
      )}
      {catalog.status === 'ready' && (
        <>
          {/* Die Sammlung bleibt im Hintergrund erhalten, damit Filter und Position nicht verloren gehen. */}
          <main hidden={route.page === 'files'}>
            <CollectionView index={catalog.index} stock={stock} prices={prices} />
          </main>
          {route.page === 'files' && (
            <main>
              <FilesView index={catalog.index} stock={stock} />
            </main>
          )}
          {route.page === 'card' && (
            <CardDetail index={catalog.index} stock={stock} prices={prices} cardId={route.cardId} />
          )}
        </>
      )}
    </div>
  );
}
