import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  addPoint,
  elapsedMs,
  formatClock,
  newGame,
  parseGame,
  pointsOf,
  removePoint,
  undo,
  winner,
  type PlayerIndex,
  type PointKind,
  type ScoreGame,
} from '../../data/score';
import { localStore, useLocalStore } from '../local-store';

/** Die laufende Partie übersteht das Schließen der App. */
const gameStore = localStore<ScoreGame>('scoreGame');
/** false: Beide Hälften stehen gleich herum (ein Spieler zählt für beide). */
const facingStore = localStore<boolean>('scoreFacing');

const KIND_LABELS: Record<PointKind, string> = { conquer: 'Conquer', hold: 'Hold' };

/** Hält den Bildschirm wach, solange der Zähler offen ist; ohne Unterstützung geschieht nichts. */
function useWakeLock(): void {
  useEffect(() => {
    type Sentinel = { release(): Promise<void> };
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }).wakeLock;
    if (!wakeLock) return;
    let sentinel: Sentinel | null = null;
    let closed = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      wakeLock
        .request('screen')
        .then((s) => {
          if (closed) void s.release().catch(() => undefined);
          else sentinel = s;
        })
        .catch(() => undefined);
    };
    acquire();
    // Das System gibt die Sperre frei, sobald die App in den Hintergrund geht.
    document.addEventListener('visibilitychange', acquire);
    return () => {
      closed = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);
}

/** Aktuelle Zeit, jede Sekunde neu, solange `running` gilt. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}

export function ScoreView() {
  const stored = useLocalStore(gameStore);
  const game = useMemo(() => parseGame(stored), [stored]);
  const facing = useLocalStore(facingStore) ?? true;
  const won = winner(game);
  const now = useNow(game.startedAt !== null && won === null);
  useWakeLock();

  const save = (next: ScoreGame) => {
    if (next !== game) gameStore.set(next);
  };
  const point = (player: PlayerIndex, kind: PointKind) => {
    const next = addPoint(game, player, kind, new Date().toISOString());
    // Ein kurzer Impuls je Punkt, ein längeres Muster beim Siegpunkt.
    if (next !== game) navigator.vibrate?.(winner(next) === null ? 20 : [60, 60, 60, 60, 240]);
    save(next);
  };
  const restart = () => {
    const running = game.events.length > 0 && won === null;
    if (running && !window.confirm('Laufende Partie beenden und bei 0 : 0 neu beginnen?')) return;
    gameStore.set(newGame(game.target));
  };

  const side = (player: PlayerIndex) => (
    <Side
      player={player}
      points={pointsOf(game, player)}
      target={game.target}
      state={won === null ? 'playing' : won === player ? 'won' : 'lost'}
      turned={facing && player === 1}
      onPoint={(kind) => point(player, kind)}
      onMinus={() => save(removePoint(game, player))}
    />
  );

  return (
    <main className="score" aria-label="Punktezähler">
      {side(1)}
      <div className="score-bar">
        <div className="bar-group">
          <button type="button" disabled={game.events.length === 0} onClick={() => save(undo(game))}>
            <Icon name="undo" />
            <span>Zurück</span>
          </button>
          {/* Aus: Beide Hälften stehen gleich herum, wenn einer für beide zählt. */}
          <button type="button" aria-pressed={facing} onClick={() => facingStore.set(!facing)}>
            <Icon name="flip" />
            <span>Gegenüber</span>
          </button>
        </div>
        <div className="score-clock">
          <strong>{formatClock(elapsedMs(game, now))}</strong>
          <span>{won === null ? `1 gegen 1 · bis ${game.target}` : 'Partie beendet'}</span>
        </div>
        <div className="bar-group end">
          <button type="button" className={won === null ? undefined : 'primary'} onClick={restart}>
            <Icon name="restart" />
            <span>Neues Spiel</span>
          </button>
        </div>
      </div>
      {side(0)}
    </main>
  );
}

function Side({
  player,
  points,
  target,
  state,
  turned,
  onPoint,
  onMinus,
}: {
  player: PlayerIndex;
  points: PointKind[];
  target: number;
  state: 'playing' | 'won' | 'lost';
  turned: boolean;
  onPoint: (kind: PointKind) => void;
  onMinus: () => void;
}) {
  const score = points.length;
  const left = target - score;
  const name = `Spieler ${player + 1}`;
  const count = (kind: PointKind) => points.filter((p) => p === kind).length;
  const classes = ['side', `player-${player + 1}`, state, turned ? 'turned' : ''].filter(Boolean).join(' ');

  const pointButton = (kind: PointKind) => (
    <button
      type="button"
      className={`point ${kind}`}
      disabled={state !== 'playing'}
      aria-label={`${name}: ${KIND_LABELS[kind]}, ein Punkt mehr`}
      onClick={() => onPoint(kind)}
    >
      <Icon name={kind} />
      <strong>{KIND_LABELS[kind]}</strong>
      <span className="point-count">{count(kind)}</span>
    </button>
  );

  return (
    <section className={classes} aria-label={name}>
      <header className="side-head">
        <span className="side-name">{name}</span>
        <span className="side-status" role="status">
          {state === 'won' ? 'Sieg!' : state === 'lost' ? 'Verloren' : left === 1 ? 'Noch 1 Punkt' : `Noch ${left} Punkte`}
        </span>
      </header>

      {pointButton('conquer')}
      <div className="ring">
        <Ring filled={score} target={target} />
        <div className="ring-score" aria-label={`${name}: ${score} von ${target} Punkten`}>
          {state === 'won' && <Icon name="crown" />}
          {/* Der Schlüssel lässt die Zahl bei jedem Punkt kurz aufspringen. */}
          <strong key={score}>{score}</strong>
        </div>
      </div>
      {pointButton('hold')}

      <footer className="side-foot">
        <div className="trail" aria-label="Verlauf der Punkte">
          {points.length === 0 && <span className="trail-empty">Conquer oder Hold antippen</span>}
          {points.map((kind, i) => (
            <span key={i} className={`dot ${kind}`} title={KIND_LABELS[kind]}>
              {kind === 'conquer' ? 'C' : 'H'}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="minus"
          disabled={state !== 'playing' || score === 0}
          aria-label={`${name}: einen Punkt abziehen`}
          onClick={onMinus}
        >
          −1
        </button>
      </footer>
    </section>
  );
}

/** Ring aus so vielen Feldern, wie es Punkte zum Sieg braucht; gefüllt im Uhrzeigersinn von oben. */
function Ring({ filled, target }: { filled: number; target: number }) {
  const radius = 43;
  const step = 360 / target;
  // Lücke zwischen den Feldern in Grad; die runden Enden der Felder ragen ein Stück hinein.
  const gap = Math.min(16, step * 0.36);
  const spot = (degrees: number) => {
    const rad = ((degrees - 90) * Math.PI) / 180;
    return `${(50 + radius * Math.cos(rad)).toFixed(2)} ${(50 + radius * Math.sin(rad)).toFixed(2)}`;
  };
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {Array.from({ length: target }, (_, i) => (
        <path
          key={i}
          className={i < filled ? (i === filled - 1 ? 'seg on last' : 'seg on') : 'seg'}
          d={`M ${spot(i * step + gap / 2)} A ${radius} ${radius} 0 0 1 ${spot((i + 1) * step - gap / 2)}`}
        />
      ))}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  // Fahne: ein Schlachtfeld erobern.
  conquer: <path d="M6 21V4m0 1.2c4-2.4 6.5 2.2 12 0v8.6c-5.5 2.2-8-2.4-12 0" />,
  // Schild: ein Schlachtfeld halten.
  hold: <path d="M12 3 5 5.6v5.6c0 4.5 2.9 8 7 9.8 4.1-1.8 7-5.3 7-9.8V5.6L12 3Zm-3 9 2.2 2.2L15.2 10" />,
  undo: <path d="M9 7 4 12l5 5M4.5 12H14a5.5 5.5 0 0 1 0 11h-2" transform="translate(0 -3)" />,
  flip: <path d="M7 4v16m0 0-3.5-3.5M7 20l3.5-3.5M17 20V4m0 0-3.5 3.5M17 4l3.5 3.5" />,
  restart: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.5H15" />,
  crown: <path d="m4 18 -1.2-10 5 4.2L12 5l4.2 7.2 5-4.2L20 18Zm0 2.5h16" />,
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className={`icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
