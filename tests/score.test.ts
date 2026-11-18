import { describe, expect, it } from 'vitest';
import {
  addPoint,
  begin,
  cleanTimer,
  DEFAULT_SETTINGS,
  elapsedMs,
  finishedAt,
  formatClock,
  history,
  newGame,
  parseGame,
  parseMinutes,
  parseSettings,
  passTurn,
  pointsOf,
  removePoint,
  scores,
  startedAt,
  timerView,
  turnOf,
  undo,
  WIN_1V1,
  winner,
  type PlayerIndex,
  type ScoreGame,
} from '../src/data/score';

const T0 = '2026-11-17T12:00:00.000Z';
const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString();
const MIN = 60_000;

/**
 * Spielt eine Folge, ein Schritt je Minute: „0c“ und „1h“ sind Punkte (Spieler, Conquer/Hold),
 * „0-“ die Korrektur, „p“ ist „Pass turn“, „b“ der Start der Uhr, „b0“ der Beginn mit Spieler 1.
 */
function play(moves: string, game: ScoreGame = newGame()): ScoreGame {
  const offset = game.events.length;
  return moves
    .split(' ')
    .filter(Boolean)
    .reduce((g, move, i) => {
      const now = at((offset + i) * 60);
      if (move === 'p') return passTurn(g, now);
      if (move === 'b') return begin(g, now);
      if (move[0] === 'b') return begin(g, now, Number(move[1]) as PlayerIndex);
      const player = Number(move[0]) as PlayerIndex;
      if (move[1] === '-') return removePoint(g, player, now);
      return addPoint(g, player, move[1] === 'c' ? 'conquer' : 'hold', now);
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

  it('kürt den Sieger beim achten Punkt und nimmt danach nichts mehr an', () => {
    const almost = play('b0 0c 0c 0c 0c 0h 0h 0h 1c 1h');
    expect(winner(almost)).toBeNull();
    const won = addPoint(almost, 0, 'hold', at(600));
    expect(scores(won)).toEqual([8, 2]);
    expect(winner(won)).toBe(0);
    expect(finishedAt(won)).toBe(at(600));
    // Weder Punkte noch Korrektur noch Zugwechsel ändern die beendete Partie.
    expect(addPoint(won, 0, 'conquer', at(700))).toBe(won);
    expect(addPoint(won, 1, 'conquer', at(700))).toBe(won);
    expect(removePoint(won, 1, at(700))).toBe(won);
    expect(passTurn(won, at(700))).toBe(won);
  });

  it('lässt auch den zweiten Spieler gewinnen', () => {
    expect(winner(play('1c 1c 1c 1c 1c 1c 1c 1h'))).toBe(1);
  });

  it('nimmt mit „−1“ den letzten Punkt des Spielers weg, aber nie unter null', () => {
    const game = play('0c 0h 1c 0-');
    expect(scores(game)).toEqual([1, 1]);
    expect(pointsOf(game, 0)).toEqual(['conquer']);
    const empty = newGame();
    expect(removePoint(empty, 1, T0)).toBe(empty);
  });

  it('nimmt Schritt für Schritt zurück, auch eine Korrektur und den Siegpunkt', () => {
    expect(scores(undo(play('0c 0h 0-')))).toEqual([2, 0]);

    const back = undo(play('0c 0c 0c 0c 0c 0c 0c 0c'));
    expect(winner(back)).toBeNull();
    expect(finishedAt(back)).toBeNull();
    expect(scores(back)).toEqual([7, 0]);
    // Danach lässt sich wieder zählen.
    expect(scores(addPoint(back, 1, 'hold', at(900)))).toEqual([7, 1]);
  });

  it('setzt nach dem Zurücknehmen aller Schritte auch die Uhr zurück', () => {
    const game = undo(play('1h'));
    expect(game.events).toEqual([]);
    expect(startedAt(game)).toBeNull();
    expect(undo(game)).toBe(game);
  });
});

describe('Spieldauer und Zeitlimit', () => {
  it('läuft ab dem ersten Punkt und bleibt beim Siegpunkt stehen', () => {
    expect(elapsedMs(newGame(), Date.parse(at(500)))).toBe(0);
    const running = play('0c 1c');
    expect(startedAt(running)).toBe(T0);
    expect(elapsedMs(running, Date.parse(at(125)))).toBe(125_000);
    const won = play('0c 0c 0c 0c 0c 0c 0c 0c');
    expect(elapsedMs(won, Date.parse(at(99_999)))).toBe(7 * MIN);
  });

  it('lässt sich vor dem ersten Punkt starten, aber nicht ein zweites Mal', () => {
    const started = begin(newGame(), T0);
    expect(startedAt(started)).toBe(T0);
    expect(scores(started)).toEqual([0, 0]);
    expect(begin(started, at(60))).toBe(started);
    expect(startedAt(addPoint(started, 0, 'hold', at(300)))).toBe(T0);
  });

  it('zeigt ohne Limit die Spieldauer', () => {
    expect(timerView(125_000, null)).toEqual({ overtime: false, ms: 125_000 });
  });

  it('zählt mit Limit die Restzeit herunter, beginnend beim vollen Limit', () => {
    expect(timerView(0, 45 * MIN)).toEqual({ overtime: false, ms: 45 * MIN });
    expect(timerView(400, 45 * MIN)).toEqual({ overtime: false, ms: 45 * MIN });
    expect(timerView(1000, 45 * MIN)).toEqual({ overtime: false, ms: 45 * MIN - 1000 });
    expect(timerView(45 * MIN - 1, 45 * MIN)).toEqual({ overtime: false, ms: 1000 });
  });

  it('meldet Overtime, sobald das Limit abgelaufen ist, und zählt die überzogene Zeit', () => {
    expect(timerView(45 * MIN, 45 * MIN)).toEqual({ overtime: true, ms: 0 });
    expect(timerView(47 * MIN + 13_000, 45 * MIN)).toEqual({ overtime: true, ms: 2 * MIN + 13_000 });
  });

  it('schreibt Minuten und Sekunden, ab einer Stunde auch Stunden', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(425_999)).toBe('07:05');
    expect(formatClock(53 * MIN + 46_000)).toBe('53:46');
    expect(formatClock(3600_000 + 7 * MIN + 5000)).toBe('1:07:05');
  });
});

describe('Expertenmodus: Züge', () => {
  it('kennt keinen Zug, solange nicht feststeht, wer beginnt', () => {
    expect(turnOf(newGame())).toBeNull();
    expect(turnOf(play('0c 1h'))).toBeNull();
    // Ohne Beginn gibt es auch keinen Zugwechsel.
    const game = play('0c');
    expect(passTurn(game, at(60))).toBe(game);
  });

  it('beginnt mit Zug 1 beim festgelegten Spieler und startet damit die Uhr', () => {
    const game = begin(newGame(), T0, 1);
    expect(turnOf(game)).toEqual({ turn: 1, active: 1 });
    expect(startedAt(game)).toBe(T0);
  });

  it('gibt mit „Pass turn“ den Zug an den anderen und zählt ihn weiter', () => {
    expect(turnOf(play('b0 p'))).toEqual({ turn: 2, active: 1 });
    expect(turnOf(play('b0 p p'))).toEqual({ turn: 3, active: 0 });
    expect(turnOf(play('b1 0c p 1h p 0c p'))).toEqual({ turn: 4, active: 0 });
  });

  it('legt den Beginn nur einmal fest', () => {
    const game = play('b0 p');
    expect(begin(game, at(600), 1)).toBe(game);
  });

  it('lässt den Beginn auch mitten in einer Partie festlegen, die schon Punkte hat', () => {
    const game = play('0c 1h b1 p');
    expect(scores(game)).toEqual([1, 1]);
    expect(turnOf(game)).toEqual({ turn: 2, active: 0 });
  });

  it('nimmt Zugwechsel und Beginn mit „Zurück“ wieder zurück', () => {
    const game = play('b0 p p');
    expect(turnOf(undo(game))).toEqual({ turn: 2, active: 1 });
    expect(turnOf(undo(undo(undo(game))))).toBeNull();
  });
});

describe('Verlauf', () => {
  it('ist vor dem Beginn leer', () => {
    expect(history(newGame(), null)).toEqual([]);
  });

  it('zeigt, wer wann in welchem Zug gepunktet hat, samt Stand danach', () => {
    //            0s  60s 120s 180s 240s 300s
    const game = play('b0 0c  p    1h   1c   p');
    expect(history(game, null)).toEqual([
      { ms: 1 * MIN, turn: 1, player: 0, kind: 'conquer', score: [1, 0], overtime: false },
      { ms: 3 * MIN, turn: 2, player: 1, kind: 'hold', score: [1, 1], overtime: false },
      { ms: 4 * MIN, turn: 2, player: 1, kind: 'conquer', score: [1, 2], overtime: false },
    ]);
  });

  it('lässt zurückgenommene Punkte weg und rechnet den Stand ohne sie', () => {
    const entries = history(play('b0 0c 0h 1c 0- 0c'), null);
    expect(entries.map((e) => [e.player, e.kind, e.score])).toEqual([
      [0, 'conquer', [1, 0]],
      [1, 'conquer', [1, 1]],
      [0, 'conquer', [2, 1]],
    ]);
  });

  it('nennt keinen Zug für Punkte, die fielen, bevor feststand, wer beginnt', () => {
    const entries = history(play('0c b1 1h p 0h'), null);
    expect(entries.map((e) => e.turn)).toEqual([null, 1, 2]);
  });

  it('kennzeichnet Punkte, die nach Ablauf des Zeitlimits fielen', () => {
    // Punkte nach 1, 2 und 3 Minuten bei einem Limit von 2 Minuten.
    const entries = history(play('b 0c 1c 0h'), 2 * MIN);
    expect(entries.map((e) => e.overtime)).toEqual([false, true, true]);
    expect(history(play('b 0c 1c 0h'), null).some((e) => e.overtime)).toBe(false);
  });
});

describe('Gespeicherte Partie', () => {
  it('kommt unverändert zurück', () => {
    const game = play('b1 0c p 1h 0h 1- p');
    expect(parseGame(JSON.parse(JSON.stringify(game)))).toEqual(game);
    const won = play('0c 0c 0c 0c 0c 0c 0c 0c');
    expect(winner(parseGame(JSON.parse(JSON.stringify(won))))).toBe(0);
  });

  it('wird bei unbrauchbarem Inhalt zu einer neuen Partie', () => {
    expect(parseGame(null)).toEqual(newGame());
    expect(parseGame('kaputt')).toEqual(newGame());
    expect(parseGame({ target: 8, events: [{ player: 2, kind: 'conquer', at: T0 }] })).toEqual(newGame());
    expect(parseGame({ target: 8, events: [{ player: 0, kind: 'sieg', at: T0 }] })).toEqual(newGame());
    expect(parseGame({ target: 8, events: [{ kind: 'begin', starter: 3, at: T0 }] })).toEqual(newGame());
  });

  it('verwirft eine Partie aus Version 0.1.16, deren Punkte noch keinen Zeitpunkt tragen', () => {
    expect(parseGame({ target: 8, events: [{ player: 0, kind: 'hold' }], startedAt: T0, finishedAt: null })).toEqual(
      newGame(),
    );
  });

  it('ersetzt ein unbrauchbares Ziel durch 8', () => {
    expect(parseGame({ target: 0, events: [{ player: 0, kind: 'hold', at: T0 }] }).target).toBe(8);
  });
});

describe('Einstellungen des Zählers', () => {
  it('beginnen ohne Zeitlimit, ohne Expertenmodus und mit gedrehter oberer Hälfte', () => {
    expect(DEFAULT_SETTINGS).toEqual({ expert: false, timerMin: null, facing: true });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('kaputt')).toEqual(DEFAULT_SETTINGS);
  });

  it('kommen unverändert zurück', () => {
    const settings = { expert: true, timerMin: 45, facing: false };
    expect(parseSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  });

  it('nehmen als Zeitlimit nur ganze Minuten von 1 bis 180', () => {
    expect(cleanTimer(45)).toBe(45);
    expect(cleanTimer(1)).toBe(1);
    expect(cleanTimer(180)).toBe(180);
    expect(cleanTimer(0)).toBeNull();
    expect(cleanTimer(181)).toBeNull();
    expect(cleanTimer(12.5)).toBeNull();
    expect(cleanTimer('45')).toBeNull();
    expect(parseSettings({ timerMin: -5 }).timerMin).toBeNull();
  });
});

describe('Zeitlimit über die Uhr', () => {
  it('liest ganze Minuten aus dem Eingabefeld', () => {
    expect(parseMinutes('20')).toBe(20);
    expect(parseMinutes(' 45 ')).toBe(45);
    expect(parseMinutes('180')).toBe(180);
  });

  it('weist leere, gebrochene und zu große Eingaben zurück', () => {
    for (const text of ['', '  ', '0', '181', '2.5', '2,5', '-5', '1e2', 'abc', '15 Min']) {
      expect(parseMinutes(text), text).toBeNull();
    }
  });

  it('ein kürzeres Limit in laufender Partie führt sofort in die Overtime', () => {
    // 12 Minuten gespielt, Limit auf 10 gesenkt: zwei Minuten überzogen.
    expect(timerView(12 * MIN, 10 * MIN)).toEqual({ overtime: true, ms: 2 * MIN });
    expect(timerView(12 * MIN, 20 * MIN)).toEqual({ overtime: false, ms: 8 * MIN });
  });
});
