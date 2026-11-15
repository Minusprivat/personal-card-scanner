import { decideUpdate, parsePublished, type PublishedVersion } from '../data/update';
import { isNativeApp } from './save';

/**
 * Selbst-Update der Android-App. Die Web-App im Browser braucht das nicht; dort
 * übernimmt der Service Worker neue Versionen.
 *
 * Ablauf: Beim Start fragt die App die Versionsdatei auf GitHub Pages ab. Gibt es eine
 * neuere Version, lädt der Update-Baustein (Capgo Capacitor Updater, im Handbetrieb) das
 * Paket mit dem Web-Teil und merkt es für den nächsten Start vor. Der Baustein spricht
 * dabei nur GitHub Pages an; seine eigenen Server sind in capacitor.config.ts abgeschaltet.
 *
 * Startet ein nachgeladenes Paket nicht (kein `markAppReady` innerhalb von zehn Sekunden),
 * kehrt der Baustein von selbst zum vorigen Stand zurück.
 */

const PAGES = 'https://minusprivat.github.io/personal-card-scanner/';
const TRIES_KEY = 'updateTries';

export type AppUpdate =
  | { kind: 'none' }
  /** Das Paket ist geladen und wird beim nächsten Start aktiv; `apply` startet sofort neu. */
  | { kind: 'ready'; version: string; apply: () => void }
  /** Diese Version braucht eine neue APK. */
  | { kind: 'apk'; version: string };

const plugin = async () => (await import('@capgo/capacitor-updater')).CapacitorUpdater;

/**
 * Meldet dem Update-Baustein, dass die App läuft. Bleibt die Meldung nach einem Update aus,
 * gilt das Paket als kaputt und wird zurückgenommen.
 */
export function markAppReady(): void {
  if (!isNativeApp()) return;
  void plugin()
    .then((updater) => updater.notifyAppReady())
    .catch(() => undefined);
}

function readTries(version: string): number {
  try {
    const saved = JSON.parse(localStorage.getItem(TRIES_KEY) ?? 'null') as { version?: string; tries?: number } | null;
    return saved?.version === version && typeof saved.tries === 'number' ? saved.tries : 0;
  } catch {
    return 0;
  }
}

async function loadPublished(): Promise<PublishedVersion | null> {
  const res = await fetch(`${PAGES}data/version.json`, { cache: 'no-store' });
  return res.ok ? parsePublished(await res.json()) : null;
}

/**
 * Prüft einmal auf eine neue Version und lädt sie, wenn möglich. Fehler (kein Netz,
 * Abbruch beim Laden) bleiben still; der nächste Start versucht es erneut.
 */
export async function checkForUpdate(running: string): Promise<AppUpdate> {
  if (!isNativeApp() || running === 'dev') return { kind: 'none' };
  try {
    const published = await loadPublished();
    if (!published) return { kind: 'none' };

    const updater = await plugin();
    const installed = await updater
      .current()
      .then((c) => c.native)
      .catch(() => null);
    const tries = readTries(published.version);
    const step = decideUpdate({ running, installed, published, failedTries: tries });
    if (step === 'none') return { kind: 'none' };
    if (step === 'apk') return { kind: 'apk', version: published.version };

    // Liegt das Paket von einem früheren Start schon bereit, wird es nicht noch einmal geladen.
    const known = (await updater.list()).bundles.find((b) => b.version === published.version && b.status !== 'error');
    const bundle =
      known ??
      (await updater.download({
        url: `${PAGES}bundle/app-${published.version}.zip`,
        version: published.version,
      }));
    await updater.next({ id: bundle.id });
    localStorage.setItem(TRIES_KEY, JSON.stringify({ version: published.version, tries: tries + 1 }));
    return {
      kind: 'ready',
      version: published.version,
      apply: () => void updater.set({ id: bundle.id }).catch(() => undefined),
    };
  } catch {
    return { kind: 'none' };
  }
}
