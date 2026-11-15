import { describe, expect, it } from 'vitest';
import { buildNumber, decideUpdate, MAX_UPDATE_TRIES, parsePublished } from '../src/data/update';

describe('Versionsdatei', () => {
  it('liest Version und älteste passende APK', () => {
    expect(parsePublished({ version: '0.1.12', apk: 11 })).toEqual({ version: '0.1.12', apk: 11 });
  });

  it('kennt das alte Format ohne APK-Angabe', () => {
    expect(parsePublished({ version: '0.1.10' })).toEqual({ version: '0.1.10', apk: null });
  });

  it('verwirft Unbrauchbares', () => {
    expect(parsePublished(null)).toBeNull();
    expect(parsePublished({})).toBeNull();
    expect(parsePublished({ version: 'dev' })).toBeNull();
    expect(parsePublished({ version: '0.1.12', apk: '11' })).toEqual({ version: '0.1.12', apk: null });
  });

  it('liest die Bau-Nummer aus der Version', () => {
    expect(buildNumber('0.1.12')).toBe(12);
    expect(buildNumber('dev')).toBeNaN();
  });
});

describe('Selbst-Update der Android-App', () => {
  const published = { version: '0.1.14', apk: 11 };
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
    expect(decideUpdate({ ...base, published: { version: '0.1.14', apk: 13 } })).toBe('apk');
  });

  it('verlangt eine neue APK, wenn die installierte Version unbekannt ist', () => {
    expect(decideUpdate({ ...base, installed: null })).toBe('apk');
    expect(decideUpdate({ ...base, installed: 'unbekannt' })).toBe('apk');
  });

  it('verlangt eine neue APK bei einer Versionsdatei im alten Format', () => {
    expect(decideUpdate({ ...base, published: { version: '0.1.14', apk: null } })).toBe('apk');
  });

  it('gibt das Nachladen auf, wenn dieselbe Version mehrfach nicht zum Laufen kam', () => {
    expect(decideUpdate({ ...base, failedTries: MAX_UPDATE_TRIES - 1 })).toBe('bundle');
    expect(decideUpdate({ ...base, failedTries: MAX_UPDATE_TRIES })).toBe('apk');
  });
});
