import { useState } from 'react';
import { CardDetail } from './CardDetail';
import { CollectionView } from './CollectionView';
import { FilesView } from './FilesView';
import { useAppUpdate, useCatalog, usePrices, useRoute, useSession, useStock } from './hooks';
import { ScanView } from './scan/ScanView';

const APK_URL = 'https://github.com/Minusprivat/personal-card-scanner/releases/download/apk/card-scanner.apk';
const DISMISSED_UPDATE = 'dismissedUpdate';

export function App() {
  const catalog = useCatalog();
  const stock = useStock();
  const route = useRoute();
  const prices = usePrices();
  const session = useSession();
  const sessionQty = session.reduce((n, r) => n + r.qty, 0);
  const update = useAppUpdate();
  // Der Hinweis auf eine neue APK lässt sich je Version wegklicken.
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
          <a href="#/" aria-current={route.page === 'collection' || route.page === 'card' ? 'page' : undefined}>
            Sammlung
          </a>
          <a href="#/scan" aria-current={route.page === 'scan' ? 'page' : undefined}>
            Scannen{sessionQty > 0 && <span className="nav-count">{sessionQty}</span>}
          </a>
          <a href="#/datei" aria-current={route.page === 'files' ? 'page' : undefined}>
            Sicherung
          </a>
        </nav>
      </header>

      {update.kind === 'ready' && (
        <p className="notice ok">
          Version {update.version} ist geladen und wird beim nächsten Öffnen der App aktiv.{' '}
          <button type="button" className="link" onClick={update.apply}>
            Jetzt neu starten
          </button>
        </p>
      )}
      {update.kind === 'apk' && update.version !== dismissed && (
        <p className="notice ok">
          Version {update.version} lässt sich nicht von selbst einspielen.{' '}
          <a className="textlink" href={APK_URL} target="_blank" rel="noopener">
            Neue APK laden
          </a>{' '}
          und über die vorhandene App installieren; die Sammlung bleibt erhalten.{' '}
          <button type="button" className="link" onClick={() => dismiss(update.version)}>
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
          <main hidden={route.page === 'files' || route.page === 'scan'}>
            <CollectionView index={catalog.index} stock={stock} prices={prices} />
          </main>
          {route.page === 'files' && (
            <main>
              <FilesView index={catalog.index} stock={stock} />
            </main>
          )}
          {/* Die Scan-Seite wird nur bei Bedarf aufgebaut: Sie schaltet die Kamera ein und lädt OpenCV. */}
          {route.page === 'scan' && (
            <main>
              <ScanView index={catalog.index} stock={stock} prices={prices} session={session} />
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
