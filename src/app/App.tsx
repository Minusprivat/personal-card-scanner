import { useState } from 'react';
import { needsBackupReminder } from '../data/auto-backup';
import { formatDay } from '../data/prices';
import { backupMark } from './auto-backup';
import { CardDetail } from './CardDetail';
import { CollectionView } from './CollectionView';
import { db } from './db';
import { FilesView } from './FilesView';
import {
  useAppUpdate,
  useAutoBackup,
  useCatalog,
  usePrices,
  useRestoreOffer,
  useRoute,
  useSession,
  useStock,
} from './hooks';
import { useLocalStore } from './local-store';
import { isNativeApp } from './save';
import { ScanView } from './scan/ScanView';
import { APK_URL } from './updater';

const DISMISSED_UPDATE = 'dismissedUpdate';

export function App() {
  const catalog = useCatalog();
  const stock = useStock();
  const route = useRoute();
  const prices = usePrices();
  const session = useSession();
  const sessionQty = session.reduce((n, r) => n + r.qty, 0);
  const updates = useAppUpdate();
  const { update } = updates;
  // Der Hinweis auf eine neue APK lässt sich je Version wegklicken.
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_UPDATE));
  const dismiss = (version: string) => {
    localStorage.setItem(DISMISSED_UPDATE, version);
    setDismissed(version);
  };

  useAutoBackup(catalog.status === 'ready' ? catalog.index : null);
  const restore = useRestoreOffer();
  // Die Web-App kann nicht von selbst sichern; sie erinnert nach größeren Änderungen daran.
  const mark = useLocalStore(backupMark);
  const cards = [...stock.values()].reduce((a, b) => a + b, 0);
  const remind = !isNativeApp() && cards > 0 && route.page !== 'files' && needsBackupReminder(cards, mark);

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
          {update.native
            ? `Version ${update.version} ist geladen und wird beim nächsten Öffnen der App aktiv.`
            : `Version ${update.version} wird geladen; die Seite lädt gleich von selbst neu.`}{' '}
          <button type="button" className="link" onClick={update.apply}>
            {update.native ? 'Jetzt neu starten' : 'Jetzt neu laden'}
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

      {restore.offer && cards === 0 && (
        <p className="notice ok" role="status">
          Die Sammlung auf diesem Gerät ist leer. Im Ordner „Dokumente/CardScanner“ liegt eine Sicherung vom{' '}
          {formatDay(restore.offer.day)} mit {restore.offer.cards} Karten.{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              const { state } = restore.offer!;
              void db.replaceCollection(state).then(restore.dismiss);
            }}
          >
            Wiederherstellen
          </button>{' '}
          <button type="button" className="link" onClick={restore.dismiss}>
            Nicht jetzt
          </button>
        </p>
      )}
      {remind && (
        <p className="notice" role="status">
          {mark?.at
            ? `Seit der letzten Sicherung am ${formatDay(mark.at)} hat sich die Sammlung um ${Math.abs(cards - mark.cards)} Karten geändert.`
            : `Deine Sammlung mit ${cards} Karten liegt nur in diesem Browser und ist noch nicht gesichert.`}{' '}
          <a className="textlink" href="#/datei">
            Zur Sicherung
          </a>{' '}
          <button type="button" className="link" onClick={() => backupMark.set({ at: mark?.at ?? null, cards })}>
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
              <FilesView index={catalog.index} stock={stock} updates={updates} />
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
