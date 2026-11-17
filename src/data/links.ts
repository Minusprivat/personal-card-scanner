/**
 * Fremde Seiten, zu denen die App nur verlinkt: Sie ruft dort nichts ab und meldet niemanden an.
 *
 * - PlayRiftbound ist die Event-Seite von Riot: Events suchen, sich anmelden, Deck einreichen.
 * - BoundRift ist ein unabhängiges Fan-Projekt, das aus den öffentlichen Event-Ergebnissen
 *   Match-Historie und eine eigene, inoffizielle Elo errechnet.
 */

export const EVENTS_URL = 'https://playriftbound.com/de-de/events/';

/** Rangliste von BoundRift mit Suche; dort findet man die eigene Spielerseite. */
export const BOUNDRIFT_SEARCH_URL = 'https://boundrift.com/leaderboard';

export const boundRiftPlayerUrl = (playerId: string): string => `https://boundrift.com/players/${playerId}`;

/**
 * Liest die Spielernummer aus dem, was jemand einfügt: den Link zur eigenen Spielerseite
 * („https://boundrift.com/players/461635“) oder nur die Nummer. null bei allem anderen.
 */
export function parseBoundRiftPlayer(input: string): string | null {
  const text = input.trim();
  if (/^\d{1,12}$/.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!/^(www\.)?boundrift\.com$/i.test(url.hostname)) return null;
  return /^\/players\/(\d{1,12})(?:\/|$)/.exec(url.pathname)?.[1] ?? null;
}
