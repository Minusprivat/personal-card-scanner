import { buildNumber, decideUpdate, parsePublished, type PublishedVersion } from '../data/update';
import { isNativeApp } from './save';

/**
 * Update-Prüfung für beide Fassungen der App.
 *
 * Android-App: Sie fragt die Versionsdatei auf GitHub Pages ab. Gibt es eine neuere Version,
 * lädt der Update-Baustein (Capgo Capacitor Updater, im Handbetrieb) das Paket mit dem
 * Web-Teil und merkt es für den nächsten Start vor. Der Baustein spricht dabei nur GitHub
 * Pages an; seine eigenen Server sind in capacitor.config.ts abgeschaltet. Startet ein
 * nachgeladenes Paket nicht (kein `markAppReady` innerhalb von zehn Sekunden), kehrt der
 * Baustein von selbst zum vorigen Stand zurück.
 *
 * Web-App: Neue Versionen übernimmt der Service Worker. Die Prüfung stößt ihn nur an,
 * damit eine lange offen gebliebene App nicht auf dem alten Stand bleibt.
 *
 * Geprüft wird beim Start (Android-App), beim Zurückkehren in die App nach längerer Pause
 * und über den Knopf „Nach Updates suchen“.
 */

const PAGES = 'https://minusprivat.github.io/personal-card-scanner/';
export const APK_URL = 'https://github.com/Minusprivat/personal-card-scanner/releases/download/apk/card-scanner.apk';
const TRIES_KEY = 'updateTries';

export type AppUpdate =
  /** Noch nicht geprüft. */
  | { kind: 'none' }
  /** Lokale Entwicklung: Hier gibt es keine Versionen. */
  | { kind: 'unavailable' }
  /** Geprüft: Die App ist aktuell. */
  | { kind: 'current'; version: string }
  /** Die Prüfung oder das Laden ist gescheitert, meist ohne Netz. `reason` nennt die Meldung. */
  | { kind: 'failed'; reason?: string }
  /**
   * Die neue Version ist geladen. Android-App (`native`): Sie wird beim nächsten Start aktiv,
   * `apply` startet sofort neu. Web-App: Die Seite lädt gleich von selbst neu, `apply` sofort.
   */
  | { kind: 'ready'; version: string; native: boolean; apply: () => void }
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

/** Version der installierten APK (der Hülle); null in der Web-App oder wenn sie sich nicht ermitteln lässt. */
export async function installedApkVersion(): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    return (await (await plugin()).current()).native || null;
  } catch {
    return null;
  }
}

function readTries(version: string): number {
  try {
    const saved = JSON.parse(localStorage.getItem(TRIES_KEY) ?? 'null') as { version?: string; tries?: number } | null;
    return saved?.version === version && typeof saved.tries === 'number' ? saved.tries : 0;
  } catch {
    return 0;
  }
}

/** Versionsdatei: Die Android-App fragt GitHub Pages, die Web-App ihren eigenen Server. */
async function loadPublished(): Promise<PublishedVersion | null> {
  const base = isNativeApp() ? PAGES : import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/version.json`, { cache: 'no-store' });
  return res.ok ? parsePublished(await res.json()) : null;
}

/**
 * Ein in diesem Lauf schon vorgemerktes Paket. Wiederholte Prüfungen laden es nicht noch
 * einmal und zählen auch keinen weiteren Fehlversuch.
 */
let prepared: { version: string; update: AppUpdate } | null = null;

async function prepareBundle(running: string, published: PublishedVersion): Promise<AppUpdate> {
  if (prepared?.version === published.version) return prepared.update;

  const updater = await plugin();
  const installed = await updater
    .current()
    .then((c) => c.native)
    .catch(() => null);
  const tries = readTries(published.version);
  const step = decideUpdate({ running, installed, published, failedTries: tries });
  if (step === 'none') return { kind: 'current', version: running };
  if (step === 'apk') return { kind: 'apk', version: published.version };

  // Liegt das Paket von einem früheren Start schon bereit, wird es nicht noch einmal geladen.
  const known = (await updater.list()).bundles.find((b) => b.version === published.version && b.status !== 'error');
  const bundle =
    known ??
    (await updater.download({
      url: `${PAGES}bundle/app-${published.version}.zip`,
      version: published.version,
      // Pflicht: Ohne Prüfsumme lehnt der Baustein das Laden ab („Checksum required“).
      // decideUpdate lässt den Weg „bundle“ nur mit Prüfsumme zu.
      checksum: published.sha256 ?? '',
    }));
  await updater.next({ id: bundle.id });
  localStorage.setItem(TRIES_KEY, JSON.stringify({ version: published.version, tries: tries + 1 }));
  const update: AppUpdate = {
    kind: 'ready',
    version: published.version,
    native: true,
    apply: () => void updater.set({ id: bundle.id }).catch(() => undefined),
  };
  prepared = { version: published.version, update };
  return update;
}

/** Stößt den Service Worker an; er lädt die neue Version und die Seite lädt danach neu. */
async function prepareWebApp(running: string, published: PublishedVersion): Promise<AppUpdate> {
  if (!(buildNumber(published.version) > buildNumber(running))) return { kind: 'current', version: running };
  const registration = await navigator.serviceWorker?.getRegistration();
  await registration?.update().catch(() => undefined);
  return { kind: 'ready', version: published.version, native: false, apply: () => window.location.reload() };
}

/** Prüft auf eine neue Version und lädt sie, wenn möglich. Wirft nicht. */
export async function checkForUpdate(running: string): Promise<AppUpdate> {
  if (Number.isNaN(buildNumber(running))) return { kind: 'unavailable' };
  try {
    const published = await loadPublished();
    if (!published) return { kind: 'failed', reason: 'Die Versionsdatei ließ sich nicht lesen.' };
    return await (isNativeApp() ? prepareBundle(running, published) : prepareWebApp(running, published));
  } catch (err) {
    // Die Meldung bleibt sichtbar: Ein still verschluckter Fehler hat das Selbst-Update
    // bis Version 0.1.13 unbemerkt verhindert.
    return { kind: 'failed', reason: err instanceof Error ? err.message : String(err) };
  }
}
