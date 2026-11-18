import { describe, expect, it } from 'vitest';
import {
  AUTO_BACKUP_KEEP,
  autoBackupName,
  backupDay,
  BACKUP_REMINDER_CARDS,
  collectionSignature,
  isAutoBackup,
  localDay,
  needsBackupReminder,
  newestBackupsFirst,
  obsoleteAutoBackups,
  restoreStep,
  type RestoreSituation,
} from '../src/data/auto-backup';
import { emptyCollection } from '../src/data/backup';

describe('Automatische Sicherung: Dateinamen', () => {
  it('benennt die Datei nach dem Tag in der Zeitzone des Geräts', () => {
    expect(localDay(new Date(2026, 10, 7, 23, 59))).toBe('2026-11-07');
    expect(autoBackupName('2026-11-07')).toBe('card-scanner-auto-2026-11-07.json');
  });

  it('weicht auf einen zweiten Namen aus, wenn sich die Datei des Tages nicht überschreiben lässt', () => {
    expect(autoBackupName('2026-11-07', 2)).toBe('card-scanner-auto-2026-11-07-2.json');
    expect(isAutoBackup('card-scanner-auto-2026-11-07-2.json')).toBe(true);
  });

  it('erkennt automatische und von Hand gespeicherte Sicherungen, aber keine fremden Dateien', () => {
    expect(backupDay('card-scanner-auto-2026-11-07.json')).toBe('2026-11-07');
    expect(backupDay('card-scanner-sicherung-2026-11-05.json')).toBe('2026-11-05');
    expect(backupDay('card-scanner-sicherung-2026-11-05.json.txt')).toBe('2026-11-05');
    expect(backupDay('card-scanner-sammlung-2026-11-05.csv')).toBeNull();
    expect(isAutoBackup('card-scanner-sicherung-2026-11-05.json')).toBe(false);
  });

  it('bietet zum Wiederherstellen die neueste Sicherung zuerst an', () => {
    expect(
      newestBackupsFirst([
        'card-scanner-auto-2026-11-05.json',
        'notizen.txt',
        'card-scanner-sicherung-2026-11-09.json',
        'card-scanner-auto-2026-11-07.json',
        'card-scanner-auto-2026-11-07-2.json',
      ]),
    ).toEqual([
      'card-scanner-sicherung-2026-11-09.json',
      'card-scanner-auto-2026-11-07-2.json',
      'card-scanner-auto-2026-11-07.json',
      'card-scanner-auto-2026-11-05.json',
    ]);
  });
});

describe('Automatische Sicherung: Aufräumen', () => {
  const days = ['01', '02', '03', '04', '05', '06', '07'].map((d) => `card-scanner-auto-2026-11-${d}.json`);

  it(`behält die letzten ${AUTO_BACKUP_KEEP} Tage`, () => {
    expect(obsoleteAutoBackups(days)).toEqual(days.slice(0, 2));
    expect(obsoleteAutoBackups(days.slice(0, AUTO_BACKUP_KEEP))).toEqual([]);
  });

  it('rührt von Hand gespeicherte Sicherungen und fremde Dateien nie an', () => {
    const others = ['card-scanner-sicherung-2026-10-01.json', 'piltover-collection-card-scanner-2026-10-01.csv'];
    expect(obsoleteAutoBackups([...others, ...days])).toEqual(days.slice(0, 2));
  });

  it('zählt Tage, nicht Dateien: Ausweichdateien desselben Tages bleiben zusammen stehen', () => {
    const files = [...days.slice(2), 'card-scanner-auto-2026-11-07-2.json'];
    expect(obsoleteAutoBackups(files)).toEqual([]);
  });
});

describe('Automatische Sicherung: Fingerabdruck des Bestands', () => {
  const state = (entries: Array<[string, number]>) => ({ ...emptyCollection(), stock: new Map(entries) });

  it('bleibt gleich, solange sich der Bestand nicht ändert, unabhängig von der Reihenfolge', () => {
    expect(collectionSignature(state([['a', 1], ['b', 2]]))).toBe(collectionSignature(state([['b', 2], ['a', 1]])));
  });

  it('ändert sich mit jeder Menge und jeder Fassung', () => {
    const base = collectionSignature(state([['a', 1], ['b', 2]]));
    expect(collectionSignature(state([['a', 1], ['b', 3]]))).not.toBe(base);
    expect(collectionSignature(state([['a', 1], ['c', 2]]))).not.toBe(base);
    expect(collectionSignature(state([['a', 1]]))).not.toBe(base);
  });
});

describe('Erinnerung an die Sicherung in der Web-App', () => {
  it('erinnert, sobald eine ungesicherte Sammlung groß genug ist', () => {
    expect(needsBackupReminder(BACKUP_REMINDER_CARDS - 1, null)).toBe(false);
    expect(needsBackupReminder(BACKUP_REMINDER_CARDS, null)).toBe(true);
  });

  it('erinnert nach einer Sicherung erst wieder, wenn sich viel geändert hat', () => {
    const mark = { at: '2026-11-17T10:00:00.000Z', cards: 300 };
    expect(needsBackupReminder(300, mark)).toBe(false);
    expect(needsBackupReminder(319, mark)).toBe(false);
    expect(needsBackupReminder(320, mark)).toBe(true);
    expect(needsBackupReminder(280, mark)).toBe(true);
  });

  it('gibt nach „Später“ Ruhe, bis wieder viel dazukommt', () => {
    // „Später“ merkt sich nur den Stand, nicht eine Sicherung.
    const later = { at: null, cards: 45 };
    expect(needsBackupReminder(50, later)).toBe(false);
    expect(needsBackupReminder(65, later)).toBe(true);
  });
});

describe('Leere Sammlung in der Android-App: Angebot oder Hinweis', () => {
  // Ausgangslage: Suche fertig, Sammlung leer, keine lesbare Sicherung, nichts weggeklickt.
  const situation = (change: Partial<RestoreSituation> = {}): RestoreSituation => ({
    searched: true,
    emptyAtStart: true,
    cards: 0,
    readable: false,
    offerDeclined: false,
    hintDismissed: false,
    ...change,
  });

  it('bietet eine lesbare Sicherung zum Wiederherstellen an', () => {
    expect(restoreStep(situation({ readable: true }))).toBe('offer');
  });

  it('weist nach einer Neuinstallation auf den Ordner hin, wenn Android die Dateien nicht freigibt', () => {
    expect(restoreStep(situation())).toBe('hint');
  });

  it('zeigt nichts, solange die Suche läuft', () => {
    expect(restoreStep(situation({ searched: false }))).toBe('none');
    expect(restoreStep(situation({ searched: false, readable: true }))).toBe('none');
  });

  it('zeigt nichts, wenn die Sammlung beim Start Karten hatte', () => {
    // Auch dann nicht, wenn der Bestand noch lädt und deshalb kurz 0 Karten gemeldet werden.
    expect(restoreStep(situation({ emptyAtStart: false }))).toBe('none');
    expect(restoreStep(situation({ emptyAtStart: false, readable: true }))).toBe('none');
  });

  it('verschwindet, sobald Karten in der Sammlung sind', () => {
    expect(restoreStep(situation({ cards: 1 }))).toBe('none');
    expect(restoreStep(situation({ cards: 300, readable: true }))).toBe('none');
  });

  it('bleibt nach „Ausblenden“ weg', () => {
    expect(restoreStep(situation({ hintDismissed: true }))).toBe('none');
  });

  it('macht aus einem abgelehnten Angebot keinen Hinweis', () => {
    expect(restoreStep(situation({ readable: true, offerDeclined: true }))).toBe('none');
  });

  it('bietet eine lesbare Sicherung auch an, wenn der Hinweis früher ausgeblendet wurde', () => {
    expect(restoreStep(situation({ readable: true, hintDismissed: true }))).toBe('offer');
  });
});
