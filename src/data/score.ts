/**
 * Punktezähler für eine Partie: reine Logik.
 *
 * Gezählt werden Punkte durch „Conquer“ und „Hold“, je Antippen einer. Standard ist 1 gegen 1
 * bis 8 Punkte; wer sie zuerst erreicht, gewinnt, danach nimmt die Partie nichts mehr an.
 *
 * Die Partie ist eine Liste von Ereignissen mit Zeitpunkt. Daraus ergeben sich Stand,
 * Spieldauer, Züge und Verlauf, und jeder Schritt lässt sich zurücknehmen.
 *
 * Im Expertenmodus steht fest, wer beginnt; „Pass turn“ gibt den Zug weiter und zählt ihn hoch.
 * Ein Zeitlimit beendet die Partie nicht: Ist es abgelaufen, läuft sie als „Overtime“ weiter.
 */

/** Punkte zum Sieg im Standardmodus 1 gegen 1. */
export const WIN_1V1 = 8;

export type PointKind = 'conquer' | 'hold';
export type PlayerIndex = 0 | 1;

export type ScoreEvent =
  /** Ein Punkt, oder mit `minus` die Korrektur: Der letzte Punkt dieses Spielers gilt nicht mehr. */
  | { kind: PointKind | 'minus'; player: PlayerIndex; at: string }
  /** Expertenmodus: Der Zug geht an den anderen Spieler. */
  | { kind: 'pass'; at: string }
  /** Die Uhr startet. Mit `starter` steht außerdem fest, wer (von hier an) am Zug ist. */
  | { kind: 'begin'; at: string; starter?: PlayerIndex };

export interface ScoreGame {
  /** Punkte zum Sieg. */
  target: number;
  events: ScoreEvent[];
}

export const newGame = (target = WIN_1V1): ScoreGame => ({ target, events: [] });

const other = (player: PlayerIndex): PlayerIndex => (player === 0 ? 1 : 0);

/** Die Punkte eines Spielers in der Reihenfolge, in der sie fielen; Korrekturen sind abgezogen. */
export function pointsOf(game: ScoreGame, player: PlayerIndex): PointKind[] {
  const points: PointKind[] = [];
  for (const event of game.events) {
    if (event.kind === 'pass' || event.kind === 'begin' || event.player !== player) continue;
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

/** Zeitpunkt des ersten Ereignisses; null, solange die Partie nicht begonnen hat. */
export const startedAt = (game: ScoreGame): string | null => game.events[0]?.at ?? null;

/** Zeitpunkt des Siegpunkts. Nach ihm nimmt die Partie nichts mehr an, er ist also das letzte Ereignis. */
export const finishedAt = (game: ScoreGame): string | null =>
  winner(game) === null ? null : game.events[game.events.length - 1]!.at;

const append = (game: ScoreGame, event: ScoreEvent): ScoreGame => ({ ...game, events: [...game.events, event] });

/** Zählt einen Punkt. Nach dem Siegpunkt ändert sich nichts mehr. */
export function addPoint(game: ScoreGame, player: PlayerIndex, kind: PointKind, now: string): ScoreGame {
  return winner(game) === null ? append(game, { kind, player, at: now }) : game;
}

/** Nimmt den letzten Punkt eines Spielers weg. Ohne Punkte oder nach dem Sieg ändert sich nichts. */
export function removePoint(game: ScoreGame, player: PlayerIndex, now: string): ScoreGame {
  if (winner(game) !== null || pointsOf(game, player).length === 0) return game;
  return append(game, { kind: 'minus', player, at: now });
}

/** Stelle und Spieler des Ereignisses, das festlegt, wer beginnt; null ohne Festlegung. */
function starterEvent(game: ScoreGame): { index: number; player: PlayerIndex } | null {
  const index = game.events.findIndex((e) => e.kind === 'begin' && e.starter !== undefined);
  const event = game.events[index];
  return event?.kind === 'begin' && event.starter !== undefined ? { index, player: event.starter } : null;
}

/**
 * Startet die Uhr, ohne dass schon ein Punkt gefallen ist. Mit `starter` legt der Aufruf
 * fest, wer am Zug ist; das geht auch mitten in der Partie, aber nur einmal.
 */
export function begin(game: ScoreGame, now: string, starter?: PlayerIndex): ScoreGame {
  if (winner(game) !== null) return game;
  if (starter === undefined) return game.events.length ? game : append(game, { kind: 'begin', at: now });
  return starterEvent(game) ? game : append(game, { kind: 'begin', at: now, starter });
}

export interface Turn {
  /** Nummer des laufenden Zugs, beginnend bei 1; jedes „Pass turn“ zählt ihn weiter. */
  turn: number;
  /** Wer am Zug ist. */
  active: PlayerIndex;
}

/** Laufender Zug; null, solange nicht feststeht, wer beginnt. */
export function turnOf(game: ScoreGame): Turn | null {
  const starter = starterEvent(game);
  if (!starter) return null;
  const passes = game.events.slice(starter.index).filter((e) => e.kind === 'pass').length;
  return { turn: passes + 1, active: passes % 2 === 0 ? starter.player : other(starter.player) };
}

/** Gibt den Zug weiter. Ohne festgelegten Beginn oder nach dem Sieg ändert sich nichts. */
export function passTurn(game: ScoreGame, now: string): ScoreGame {
  if (winner(game) !== null || !starterEvent(game)) return game;
  return append(game, { kind: 'pass', at: now });
}

/** Nimmt den letzten Schritt zurück: Punkt, Korrektur, Zugwechsel, Beginn oder Siegpunkt. */
export function undo(game: ScoreGame): ScoreGame {
  return game.events.length ? { ...game, events: game.events.slice(0, -1) } : game;
}

/** Spieldauer in Millisekunden: bis jetzt oder bis zum Siegpunkt; 0 vor dem Beginn. */
export function elapsedMs(game: ScoreGame, nowMs: number): number {
  const start = startedAt(game);
  if (!start) return 0;
  const end = finishedAt(game);
  return Math.max(0, (end ? Date.parse(end) : nowMs) - Date.parse(start));
}

export interface TimerView {
  /** true, sobald das Zeitlimit abgelaufen ist. */
  overtime: boolean;
  /** Ohne Limit die Spieldauer, mit Limit die Restzeit, in der Overtime die überzogene Zeit. */
  ms: number;
}

/** Was die Uhr zeigt. Die Restzeit ist auf ganze Sekunden aufgerundet, damit sie bei 45:00 beginnt. */
export function timerView(elapsed: number, limitMs: number | null): TimerView {
  if (limitMs === null) return { overtime: false, ms: elapsed };
  if (elapsed >= limitMs) return { overtime: true, ms: elapsed - limitMs };
  return { overtime: false, ms: Math.ceil((limitMs - elapsed) / 1000) * 1000 };
}

/** „07:05“, ab einer Stunde „1:07:05“. */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const rest = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}

/** Ein Punkt im Verlauf: wer wann wie gepunktet hat. */
export interface HistoryEntry {
  /** Spielzeit des Punkts in Millisekunden seit dem Beginn. */
  ms: number;
  /** Zug, in dem der Punkt fiel; null, solange nicht feststand, wer beginnt. */
  turn: number | null;
  player: PlayerIndex;
  kind: PointKind;
  /** Stand nach diesem Punkt. */
  score: [number, number];
  /** true, wenn der Punkt nach Ablauf des Zeitlimits fiel. */
  overtime: boolean;
}

/** Alle Punkte, die gelten, in zeitlicher Reihenfolge; zurückgenommene Punkte fehlen. */
export function history(game: ScoreGame, limitMs: number | null): HistoryEntry[] {
  const start = startedAt(game);
  if (!start) return [];
  const startMs = Date.parse(start);
  const points: Array<Omit<HistoryEntry, 'score'>> = [];
  let turn: number | null = null;
  for (const event of game.events) {
    if (event.kind === 'begin') {
      if (event.starter !== undefined && turn === null) turn = 1;
    } else if (event.kind === 'pass') {
      if (turn !== null) turn++;
    } else if (event.kind === 'minus') {
      const last = points.map((p) => p.player).lastIndexOf(event.player);
      if (last >= 0) points.splice(last, 1);
    } else {
      const ms = Date.parse(event.at) - startMs;
      points.push({ ms, turn, player: event.player, kind: event.kind, overtime: limitMs !== null && ms >= limitMs });
    }
  }
  const score: [number, number] = [0, 0];
  return points.map((p) => {
    score[p.player]++;
    return { ...p, score: [score[0], score[1]] };
  });
}

const isPlayer = (v: unknown): v is PlayerIndex => v === 0 || v === 1;
const isTime = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

function isEvent(v: unknown): v is ScoreEvent {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as { kind?: unknown; player?: unknown; starter?: unknown; at?: unknown };
  if (!isTime(e.at)) return false;
  if (e.kind === 'pass') return true;
  if (e.kind === 'begin') return e.starter === undefined || isPlayer(e.starter);
  return (e.kind === 'conquer' || e.kind === 'hold' || e.kind === 'minus') && isPlayer(e.player);
}

/** Liest eine gespeicherte Partie. Unbrauchbares ergibt eine neue Partie statt eines Fehlers. */
export function parseGame(value: unknown): ScoreGame {
  const g = value as Partial<ScoreGame> | null;
  if (typeof g !== 'object' || g === null || !Array.isArray(g.events) || !g.events.every(isEvent)) return newGame();
  const target = typeof g.target === 'number' && Number.isInteger(g.target) && g.target > 0 ? g.target : WIN_1V1;
  return { target, events: g.events };
}

/** Einstellungen des Zählers; sie gelten über die einzelne Partie hinaus. */
export interface ScoreSettings {
  /** Expertenmodus: Züge zählen, „Pass turn“ und Verlauf. */
  expert: boolean;
  /** Zeitlimit in Minuten; null ohne Limit. */
  timerMin: number | null;
  /** Die obere Hälfte steht auf dem Kopf (zwei Spieler sitzen sich gegenüber). */
  facing: boolean;
}

export const DEFAULT_SETTINGS: ScoreSettings = { expert: false, timerMin: null, facing: true };

/** Längstes einstellbares Zeitlimit in Minuten. */
export const TIMER_MAX_MIN = 180;
/** Zeitlimits zum Antippen, in Minuten. */
export const TIMER_CHOICES = [15, 30, 45, 60] as const;

/** Ganze Minuten von 1 bis 180; alles andere bedeutet „kein Limit“. */
export function cleanTimer(minutes: unknown): number | null {
  return typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= 1 && minutes <= TIMER_MAX_MIN
    ? minutes
    : null;
}

export function parseSettings(value: unknown): ScoreSettings {
  const s = (typeof value === 'object' && value !== null ? value : {}) as Partial<Record<keyof ScoreSettings, unknown>>;
  return {
    expert: s.expert === true,
    timerMin: cleanTimer(s.timerMin),
    facing: s.facing !== false,
  };
}

/** Liest die Minuten aus dem Eingabefeld des Zeitlimits; null bei leerer oder unbrauchbarer Eingabe. */
export function parseMinutes(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? cleanTimer(Number.parseInt(trimmed, 10)) : null;
}

/** So lange steht der Hinweis „Overtime“ über dem Zähler, wenn ihn niemand wegtippt. */
export const OVERTIME_ALERT_MS = 5000;
