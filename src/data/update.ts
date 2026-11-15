/**
 * Selbst-Update der Android-App: reine Entscheidungslogik.
 *
 * Die Android-App besteht aus zwei Teilen. Die Hülle (APK) bringt Kamera-Freigabe,
 * Dateizugriff und den Update-Baustein mit; der Web-Teil ist die eigentliche App.
 * Fast jede neue Version ändert nur den Web-Teil – den lädt die App selbst nach.
 * Nur wenn sich die Hülle geändert hat, braucht es eine neue APK.
 */

export interface PublishedVersion {
  /** Zuletzt veröffentlichte Version, z. B. "0.1.12". */
  version: string;
  /**
   * Bau-Nummer der ältesten APK, mit der diese Version läuft. null bei einer
   * Versionsdatei im alten Format; dann gilt: neue APK nötig.
   */
  apk: number | null;
}

/** Bau-Nummer einer Version: "0.1.12" → 12. NaN, wenn die Version keine trägt (lokal "dev"). */
export const buildNumber = (version: string): number => Number.parseInt(version.split('.').pop() ?? '', 10);

export function parsePublished(value: unknown): PublishedVersion | null {
  if (typeof value !== 'object' || value === null) return null;
  const { version, apk } = value as { version?: unknown; apk?: unknown };
  if (typeof version !== 'string' || Number.isNaN(buildNumber(version))) return null;
  return { version, apk: typeof apk === 'number' && Number.isInteger(apk) && apk > 0 ? apk : null };
}

/** So oft darf dieselbe Version nachgeladen werden, ohne dass sie danach läuft. */
export const MAX_UPDATE_TRIES = 2;

export type UpdateStep =
  /** Nichts zu tun: Die App ist aktuell. */
  | 'none'
  /** Der Web-Teil lässt sich nachladen. */
  | 'bundle'
  /** Es braucht eine neue APK. */
  | 'apk';

export function decideUpdate(input: {
  /** Version des laufenden Web-Teils. */
  running: string;
  /** Version der installierten APK; null, wenn sie sich nicht ermitteln ließ. */
  installed: string | null;
  published: PublishedVersion;
  /** Wie oft diese Version schon nachgeladen wurde, ohne danach zu laufen. */
  failedTries: number;
}): UpdateStep {
  const { running, installed, published, failedTries } = input;
  const target = buildNumber(published.version);
  const current = buildNumber(running);
  if (Number.isNaN(current) || target <= current) return 'none';

  const shell = installed === null ? Number.NaN : buildNumber(installed);
  if (published.apk === null || Number.isNaN(shell) || shell < published.apk) return 'apk';
  // Das nachgeladene Paket kam mehrfach nicht zum Laufen: Eine frische APK behebt das sicher.
  if (failedTries >= MAX_UPDATE_TRIES) return 'apk';
  return 'bundle';
}
