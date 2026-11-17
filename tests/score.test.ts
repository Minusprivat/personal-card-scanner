import { describe, expect, it } from 'vitest';
import {
  addPoint,
  elapsedMs,
  formatClock,
  newGame,
  parseGame,
  pointsOf,
  removePoint,
  scores,
  undo,
  WIN_1V1,
  winner,
  type PlayerIndex,
  type PointKind,
  type ScoreGame,
} from '../src/data/score';

const T0 = '2026-11-17T12:00:00.000Z';
const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString();

/** Spielt eine Folge wie „0c 1h 0h“: Spieler und Art des Punkts. */
function play(moves: string, game: ScoreGame = newGame()): ScoreGame {
  return moves
    .split(' ')
    .filter(Boolean)
    .reduce((g, move, i) => {
      const player = Number(move[0]) as PlayerIndex;
      const kind: PointKind = move[1] === 'c' ? 'conquer' : 'hold';
      return addPoint(g, player, kind, at(i * 60));
    }, game);
}

describe('Punktezähler', () => {
  it('beginnt im Standardmodus 1 gegen 1 bei 0 : 0 und geht bis 8', () => {
    const game = newGame();
    expect(WIN_1V1).toBe(8);
    expect(game.target).toBe(8);
    expect(scores(game)).toEqual([0, 0]);
    expect(winner(game)).toBeNull();
  });

  it('zählt Conquer und Hold je als einen Punkt für den richtigen Spieler', () => {
    const game = play('0c 0h 1c 0c');
    expect(scores(game)).toEqual([3, 1]);
    expect(pointsOf(game, 0)).toEqual(['conquer', 'hold', 'conquer']);
    expect(pointsOf(game, 1)).toEqual(['conquer']);
  });

  it('kürt den Sieger beim achten Punkt und nimmt danach keine Punkte mehr an', () => {
    const almost = play('0c 0c 0c 0c 0h 0h 0h 1c 1h');
    expect(winner(almost)).toBeNull();
    const won = addPoint(almost, 0, 'hold', at(600));
    expect(scores(won)).toEqual([8, 2]);
    expect(winner(won)).toBe(0);
    expect(won.finishedAt).toBe(at(600));
    // Weder der Sieger noch der Verlierer kann weiterzählen.
    expect(addPoint(won, 0, 'conquer', at(700))).toBe(won);
    expect(addPoint(won, 1, 'conquer', at(700))).toBe(won);
    expect(removePoint(won, 1)).toBe(won);
  });

  it('lässt auch den zweiten Spieler gewinnen', () => {
    expect(winner(play('1c 1c 1c 1c 1c 1c 1c 1h'))).toBe(1);
  });

  it('nimmt mit „−1“ den letzten Punkt des Spielers weg, aber nie unter null', () => {
    const game = removePoint(play('0c 0h 1c'), 0);
    expect(scores(game)).toEqual([1, 1]);
    expect(pointsOf(game, 0)).toEqual(['conquer']);
    const empty = newGame();
    expect(removePoint(empty, 1)).toBe(empty);
  });

  it('nimmt Schritt für Schritt zurück, auch eine Korrektur und den Siegpunkt', () => {
    const corrected = removePoint(play('0c 0h'), 0);
    expect(scores(undo(corrected))).toEqual([2, 0]);

    const won = play('0c 0c 0c 0c 0c 0c 0c 0c');
    const back = undo(won);
    expect(winner(back)).toBeNull();
    expect(back.finishedAt).toBeNull();
    expect(scores(back)).toEqual([7, 0]);
    // Danach lässt sich wieder zählen.
    expect(scores(addPoint(back, 1, 'hold', at(900)))).toEqual([7, 1]);
  });

  it('setzt nach dem Zurücknehmen aller Punkte auch die Uhr zurück', () => {
    const game = undo(play('1h'));
    expect(game.events).toEqual([]);
    expect(game.startedAt).toBeNull();
    expect(undo(game)).toBe(game);
  });
});

describe('Spieldauer', () => {
  it('läuft ab dem ersten Punkt und bleibt beim Siegpunkt stehen', () => {
    expect(elapsedMs(newGame(), Date.parse(at(500)))).toBe(0);
    const running = play('0c 1c');
    expect(running.startedAt).toBe(T0);
    expect(elapsedMs(running, Date.parse(at(125)))).toBe(125_000);
    const won = play('0c 0c 0c 0c 0c 0c 0c 0c');
    expect(elapsedMs(won, Date.parse(at(99_999)))).toBe(7 * 60_000);
  });

  it('schreibt Minuten und Sekunden, ab einer Stunde auch Stunden', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(425_999)).toBe('07:05');
    expect(formatClock(53 * 60_000 + 46_000)).toBe('53:46');
    expect(formatClock(3600_000 + 7 * 60_000 + 5000)).toBe('1:07:05');
  });
});

describe('Gespeicherte Partie', () => {
  it('kommt unverändert zurück', () => {
    const game = removePoint(play('0c 1h 0h'), 1);
    expect(parseGame(JSON.parse(JSON.stringify(game)))).toEqual(game);
    const won = play('0c 0c 0c 0c 0c 0c 0c 0c');
    expect(parseGame(JSON.parse(JSON.stringify(won)))).toEqual(won);
  });

  it('wird bei unbrauchbarem Inhalt zu einer neuen Partie', () => {
    expect(parseGame(null)).toEqual(newGame());
    expect(parseGame('kaputt')).toEqual(newGame());
    expect(parseGame({ target: 8, events: [{ player: 2, kind: 'conquer' }] })).toEqual(newGame());
    expect(parseGame({ target: 8, events: [{ player: 0, kind: 'sieg' }] })).toEqual(newGame());
  });

  it('ersetzt ein unbrauchbares Ziel durch 8 und verwirft Zeiten, die nicht passen', () => {
    const game = parseGame({ target: 0, events: [{ player: 0, kind: 'hold' }], startedAt: 'gestern', finishedAt: T0 });
    expect(game.target).toBe(8);
    expect(game.startedAt).toBeNull();
    // Ohne Sieger gibt es kein Ende der Partie.
    expect(game.finishedAt).toBeNull();
  });
});
