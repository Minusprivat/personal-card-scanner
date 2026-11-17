import { describe, expect, it } from 'vitest';
import { BOUNDRIFT_SEARCH_URL, boundRiftPlayerUrl, EVENTS_URL, parseBoundRiftPlayer } from '../src/data/links';

describe('Spielerseite bei BoundRift', () => {
  it('liest die Nummer aus dem Link zur Spielerseite', () => {
    expect(parseBoundRiftPlayer('https://boundrift.com/players/461635')).toBe('461635');
    expect(parseBoundRiftPlayer('https://www.boundrift.com/players/1000014430/')).toBe('1000014430');
    expect(parseBoundRiftPlayer('  https://boundrift.com/players/461635?tab=events#rating ')).toBe('461635');
  });

  it('nimmt auch den Link ohne „https://“ und die bloße Nummer', () => {
    expect(parseBoundRiftPlayer('boundrift.com/players/461635')).toBe('461635');
    expect(parseBoundRiftPlayer('461635')).toBe('461635');
  });

  it('weist alles andere zurück', () => {
    expect(parseBoundRiftPlayer('')).toBeNull();
    expect(parseBoundRiftPlayer('Bleach')).toBeNull();
    expect(parseBoundRiftPlayer('https://boundrift.com/leaderboard')).toBeNull();
    expect(parseBoundRiftPlayer('https://boundrift.com/players/')).toBeNull();
    expect(parseBoundRiftPlayer('https://boundrift.com/players/abc')).toBeNull();
    // Nur BoundRift selbst: kein Link, der bloß so aussieht.
    expect(parseBoundRiftPlayer('https://boundrift.com.example.org/players/461635')).toBeNull();
    expect(parseBoundRiftPlayer('https://example.org/players/461635')).toBeNull();
    expect(parseBoundRiftPlayer('javascript:alert(1)')).toBeNull();
  });

  it('baut aus der Nummer wieder den Link', () => {
    expect(boundRiftPlayerUrl('461635')).toBe('https://boundrift.com/players/461635');
    expect(parseBoundRiftPlayer(boundRiftPlayerUrl('461635'))).toBe('461635');
  });
});

describe('Feste Ziele', () => {
  it('führen verschlüsselt zu Riot und zu BoundRift', () => {
    expect(new URL(EVENTS_URL).origin).toBe('https://playriftbound.com');
    expect(new URL(BOUNDRIFT_SEARCH_URL).origin).toBe('https://boundrift.com');
  });
});
