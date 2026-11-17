import { describe, expect, it } from 'vitest';
import {
  buildNumber,
  decideUpdate,
  MAX_UPDATE_TRIES,
  parsePublished,
  shouldRecheck,
  UPDATE_RECHECK_MS,
} from '../src/data/update';

/** Gültige Prüfsumme: 64 Hex-Zeichen. */
const SHA = 'a'.repeat(64);

describe('Versionsdatei', () => {
  it('liest Version, älteste passende APK und Prüfsumme des Pakets', () => {
    expect(parsePublished({ version: '0.1.14', apk: 14, sha256: SHA })).toEqual({ version: '0.1.14', apk: 14, sha256: SHA });
  });

  it('kennt das Format ohne Prüfsumme und verwirft unbrauchbare Prüfsummen', () => {
    expect(parsePublished({ version: '0.1.12', apk: 11 })).toEqual({ version: '0.1.12', apk: 11, sha256: null });
    expect(parsePublished({ version: '0.1.12', apk: 11, sha256: 'abc' })?.sha256).toBeNull();
    expect(parsePublished({ version: '0.1.12', apk: 11, sha256: SHA.toUpperCase() })?.sha256).toBeNull();
  });

  it('kennt das alte Format ohne APK-Angabe', () => {
    expect(parsePublished({ version: '0.1.10' })).toEqual({ version: '0.1.10', apk: null, sha256: null });
  });

  it('verwirft Unbrauchbares', () => {
    expect(parsePublished(null)).toBeNull();
    expect(parsePublished({})).toBeNull();
    expect(parsePublished({ version: 'dev' })).toBeNull();
    expect(parsePublished({ version: '0.1.12', apk: '11' })).toEqual({ version: '0.1.12', apk: null, sha256: null });
  });

  it('liest die Bau-Nummer aus der Version', () => {
    expect(buildNumber('0.1.12')).toBe(12);
    expect(buildNumber('dev')).toBeNaN();
  });
});

describe('Erneute Prüfung', () => {
  it('prüft nach einer Stunde Pause von selbst wieder, vorher nicht', () => {
    const start = 1_000_000;
    expect(shouldRecheck(start, start + UPDATE_RECHECK_MS - 1)).toBe(false);
    expect(shouldRecheck(start, start + UPDATE_RECHECK_MS)).toBe(true);
    expect(UPDATE_RECHECK_MS).toBe(60 * 60 * 1000);
  });
});

describe('Selbst-Update der Android-App', () => {
  const published = { version: '0.1.14', apk: 11, sha256: SHA };
  const base = { running: '0.1.12', installed: '0.1.11', published, failedTries: 0 };

  it('tut nichts, wenn die App aktuell ist', () => {
    expect(decideUpdate({ ...base, running: '0.1.14' })).toBe('none');
    // Ein älterer Stand auf dem Server (Zwischenspeicher) ist kein Update.
    expect(decideUpdate({ ...base, running: '0.1.15' })).toBe('none');
  });

  it('tut nichts in der lokalen Entwicklung', () => {
    expect(decideUpdate({ ...base, running: 'dev' })).toBe('none');
  });

  it('lädt den Web-Teil nach, wenn die installierte APK genügt', () => {
    expect(decideUpdate(base)).toBe('bundle');
    expect(decideUpdate({ ...base, installed: '0.1.13' })).toBe('bundle');
  });

  it('verlangt eine neue APK, wenn sich die Hülle geändert hat', () => {
    expect(decideUpdate({ ...base, published: { ...published, apk: 13 } })).toBe('apk');
  });

  it('verlangt eine neue APK, wenn die installierte Version unbekannt ist', () => {
    expect(decideUpdate({ ...base, installed: null })).toBe('apk');
    expect(decideUpdate({ ...base, installed: 'unbekannt' })).toBe('apk');
  });

  it('verlangt eine neue APK bei einer Versionsdatei im alten Format', () => {
    expect(decideUpdate({ ...base, published: { ...published, apk: null } })).toBe('apk');
  });

  it('verlangt eine neue APK, wenn die Prüfsumme des Pakets fehlt: Der Baustein lädt es sonst nicht', () => {
    expect(decideUpdate({ ...base, published: { ...published, sha256: null } })).toBe('apk');
  });

  it('gibt das Nachladen auf, wenn dieselbe Version mehrfach nicht zum Laufen kam', () => {
    expect(decideUpdate({ ...base, failedTries: MAX_UPDATE_TRIES - 1 })).toBe('bundle');
    expect(decideUpdate({ ...base, failedTries: MAX_UPDATE_TRIES })).toBe('apk');
  });
});
