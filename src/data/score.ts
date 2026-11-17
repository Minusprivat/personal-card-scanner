/**
 * Punktezähler für eine Partie: reine Logik.
 *
 * Gezählt werden Punkte durch „Conquer“ und „Hold“, je Antippen einer. Standard ist 1 gegen 1
 * bis 8 Punkte; wer sie zuerst erreicht, gewinnt, danach nimmt die Partie keine Punkte mehr an.
 * Die Partie ist eine Liste von Ereignissen; so lässt sich jeder Schritt zurücknehmen.
 */

/** Punkte zum Sieg im Standardmodus 1 gegen 1. */
export const WIN_1V1 = 8;

export type PointKind = 'conquer' | 'hold';
export type PlayerIndex = 0 | 1;

export interface ScoreEvent {
  player: PlayerIndex;
  /** `minus` nimmt den letzten Punkt dieses Spielers wieder weg (Korrektur). */
  kind: PointKind | 'minus';
}

export interface ScoreGame {
  /** Punkte zum Sieg. */
  target: number;
  events: ScoreEvent[];
  /** Zeitpunkt des ersten Punkts; null, solange noch nichts gezählt wurde. */
  startedAt: string | null;
  /** Zeitpunkt des Siegpunkts; null, solange die Partie läuft. */
  finishedAt: string | null;
}

export const newGame = (target = WIN_1V1): ScoreGame => ({ target, events: [], startedAt: null, finishedAt: null });

/** Die Punkte eines Spielers in der Reihenfolge, in der sie fielen; Korrekturen sind abgezogen. */
export function pointsOf(game: ScoreGame, player: PlayerIndex): PointKind[] {
  const points: PointKind[] = [];
  for (const event of game.events) {
    if (event.player !== player) continue;
    if (event.kind === 'minus') points.pop();
    else points.push(event.kind);
  }
  return points;
}

export const scores = (game: ScoreGame): [number, number] => [pointsOf(game, 0).length, pointsOf(game, 1).length];

/** Wer die Zielpunkte erreicht hat; null, solange die Partie läuft. */
export function winner(game: ScoreGame): PlayerIndex | null {
  const [a, b] = scores(game);
  if (a >= game.target) return 0;
  if (b >= game.target) return 1;
  return null;
}

/** Zählt einen Punkt. Nach dem Siegpunkt ändert sich nichts mehr. */
export function addPoint(game: ScoreGame, player: PlayerIndex, kind: PointKind, now: string): ScoreGame {
  if (winner(game) !== null) return game;
  const next: ScoreGame = {
    ...game,
    events: [...game.events, { player, kind }],
    startedAt: game.startedAt ?? now,
  };
  return winner(next) === null ? next : { ...next, finishedAt: now };
}

/** Nimmt den letzten Punkt eines Spielers weg. Ohne Punkte oder nach dem Sieg ändert sich nichts. */
export function removePoint(game: ScoreGame, player: PlayerIndex): ScoreGame {
  if (winner(game) !== null || pointsOf(game, player).length === 0) return game;
  return { ...game, events: [...game.events, { player, kind: 'minus' }] };
}

/** Nimmt den letzten Schritt zurück, auch den Siegpunkt. */
export function undo(game: ScoreGame): ScoreGame {
  if (game.events.length === 0) return game;
  const events = game.events.slice(0, -1);
  return { ...game, events, startedAt: events.length ? game.startedAt : null, finishedAt: null };
}

/** Spieldauer in Millisekunden: bis jetzt oder bis zum Siegpunkt; 0 vor dem ersten Punkt. */
export function elapsedMs(game: ScoreGame, nowMs: number): number {
  if (!game.startedAt) return 0;
  const end = game.finishedAt ? Date.parse(game.finishedAt) : nowMs;
  return Math.max(0, end - Date.parse(game.startedAt));
}

/** „07:05“, ab einer Stunde „1:07:05“. */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const rest = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}

const isEvent = (v: unknown): v is ScoreEvent => {
  const e = v as Partial<ScoreEvent> | null;
  return (
    typeof e === 'object' &&
    e !== null &&
    (e.player === 0 || e.player === 1) &&
    (e.kind === 'conquer' || e.kind === 'hold' || e.kind === 'minus')
  );
};

const isTime = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Liest eine gespeicherte Partie. Unbrauchbares ergibt eine neue Partie statt eines Fehlers. */
export function parseGame(value: unknown): ScoreGame {
  const g = value as Partial<ScoreGame> | null;
  if (typeof g !== 'object' || g === null || !Array.isArray(g.events) || !g.events.every(isEvent)) return newGame();
  const target = typeof g.target === 'number' && Number.isInteger(g.target) && g.target > 0 ? g.target : WIN_1V1;
  const game: ScoreGame = {
    target,
    events: g.events,
    startedAt: g.events.length && isTime(g.startedAt) ? g.startedAt : null,
    finishedAt: null,
  };
  return winner(game) !== null && isTime(g.finishedAt) ? { ...game, finishedAt: g.finishedAt } : game;
}
