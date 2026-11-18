import type { CollectionState } from './backup';

/**
 * Automatische Sicherung: reine Logik (Dateinamen, Aufräumen, Erinnerung).
 *
 * Die Android-App schreibt nach jeder Änderung eine Sicherungsdatei in den Ordner
 * „Dokumente/CardScanner“. Je Tag gibt es eine Datei; ältere Tage bleiben stehen, damit
 * sich auch ein versehentlich überschriebener Bestand zurückholen lässt.
 */

/** So viele Tage mit automatischer Sicherung bleiben stehen. */
export const AUTO_BACKUP_KEEP = 5;

const AUTO = /^card-scanner-auto-(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.json$/;
/** Von Hand gespeicherte Sicherung, auch in der Fassung des Teilen-Menüs (.json.txt). */
const MANUAL = /^card-scanner-sicherung-(\d{4}-\d{2}-\d{2})\.json(?:\.txt)?$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Datum in der Zeitzone des Geräts als JJJJ-MM-TT. */
export const localDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Dateiname der automatischen Sicherung eines Tages. `attempt` über 1 weicht aus, wenn sich
 * die Datei nicht überschreiben lässt (sie stammt dann aus einer früheren Installation).
 */
export const autoBackupName = (day: string, attempt = 1): string =>
  `card-scanner-auto-${day}${attempt > 1 ? `-${attempt}` : ''}.json`;

export const isAutoBackup = (name: string): boolean => AUTO.test(name);

/** Tag einer Sicherungsdatei (automatisch oder von Hand); null bei fremden Dateien. */
export function backupDay(name: string): string | null {
  return (AUTO.exec(name) ?? MANUAL.exec(name))?.[1] ?? null;
}

/** Sicherungsdateien eines Ordners, neueste zuerst; fremde Dateien fallen weg. */
export function newestBackupsFirst(names: string[]): string[] {
  const attempt = (name: string) => Number(AUTO.exec(name)?.[2] ?? 1);
  return names
    .filter((n) => backupDay(n) !== null)
    .sort((a, b) => backupDay(b)!.localeCompare(backupDay(a)!) || attempt(b) - attempt(a) || a.localeCompare(b));
}

/** Automatische Sicherungen, die weg dürfen: alles außer den letzten `keep` Tagen. */
export function obsoleteAutoBackups(names: string[], keep = AUTO_BACKUP_KEEP): string[] {
  const auto = names.filter(isAutoBackup);
  const days = [...new Set(auto.map((n) => backupDay(n)!))].sort().reverse();
  const kept = new Set(days.slice(0, keep));
  return auto.filter((n) => !kept.has(backupDay(n)!));
}

/**
 * Kurzer Fingerabdruck des Bestands. Ändert er sich nicht, braucht es keine neue Datei;
 * so verdrängt ein unveränderter Bestand keine älteren Sicherungen.
 */
export function collectionSignature(state: CollectionState): string {
  const text =
    [...state.stock]
      .filter(([, qty]) => qty > 0)
      .map(([skuId, qty]) => `${skuId}:${qty}`)
      .sort()
      .join('|') + `#${state.templates.size}#${state.extraRows.length}`;
  // FNV-1a, 32 Bit: reicht, um Änderungen zu bemerken.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Was die Android-App bei leerer Sammlung zeigt: nichts, das Angebot „Wiederherstellen“
 * oder den Hinweis, wo die Sicherung nach einer Neuinstallation liegt.
 */
export type RestoreStep = 'none' | 'offer' | 'hint';

export interface RestoreSituation {
  /** Die Suche nach einer Sicherung ist abgeschlossen. */
  searched: boolean;
  /** Die Sammlung war beim Start leer. */
  emptyAtStart: boolean;
  /** Karten in der Sammlung jetzt. */
  cards: number;
  /** Im Ordner der App liegt eine Sicherung, die sich lesen lässt. */
  readable: boolean;
  /** Der Nutzer hat das Angebot in diesem Lauf abgelehnt. */
  offerDeclined: boolean;
  /** Der Nutzer hat den Hinweis ausgeblendet (bleibt gemerkt). */
  hintDismissed: boolean;
}

/**
 * Nach einer Neuinstallation ist die Sammlung leer, und Android lässt die App die
 * Sicherungen der früheren Installation nicht von selbst lesen. Dann gibt es kein Angebot,
 * aber die Dateien liegen noch im Ordner: Der Hinweis nennt den Weg über die Dateiauswahl.
 */
export function restoreStep(s: RestoreSituation): RestoreStep {
  if (!s.searched || !s.emptyAtStart || s.cards > 0) return 'none';
  if (s.readable) return s.offerDeclined ? 'none' : 'offer';
  return s.hintDismissed ? 'none' : 'hint';
}

/** Ab so vielen geänderten Karten erinnert die Web-App an eine Sicherung. */
export const BACKUP_REMINDER_CARDS = 20;

/**
 * Merker der Web-App: wann zuletzt gesichert wurde und wie viele Karten die Sammlung
 * dabei hatte. Ein weggeklickter Hinweis setzt nur `cards` neu.
 */
export interface BackupMark {
  /** Zeitpunkt der letzten Sicherung; null, wenn es noch keine gab. */
  at: string | null;
  cards: number;
}

/** true, wenn sich die Sammlung seit dem Merker deutlich geändert hat. */
export function needsBackupReminder(cards: number, mark: BackupMark | null): boolean {
  return Math.abs(cards - (mark?.cards ?? 0)) >= BACKUP_REMINDER_CARDS;
}
