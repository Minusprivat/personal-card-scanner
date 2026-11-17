import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  addPoint,
  begin,
  cleanTimer,
  elapsedMs,
  formatClock,
  history,
  newGame,
  parseGame,
  parseSettings,
  passTurn,
  pointsOf,
  removePoint,
  startedAt,
  TIMER_CHOICES,
  TIMER_MAX_MIN,
  timerView,
  turnOf,
  undo,
  winner,
  type PlayerIndex,
  type PointKind,
  type ScoreGame,
  type ScoreSettings,
  type Turn,
} from '../../data/score';
import { localStore, useLocalStore } from '../local-store';

/** Die laufende Partie und die Einstellungen überstehen das Schließen der App. */
export const gameStore = localStore<ScoreGame>('scoreGame');
const settingsStore = localStore<ScoreSettings>('scoreSettings');

const KIND_LABELS: Record<PointKind, string> = { conquer: 'Conquer', hold: 'Hold' };
const playerName = (player: PlayerIndex) => `Spieler ${player + 1}`;
const nowIso = () => new Date().toISOString();

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
  const storedGame = useLocalStore(gameStore);
  const game = useMemo(() => parseGame(storedGame), [storedGame]);
  const storedSettings = useLocalStore(settingsStore);
  const settings = useMemo(() => parseSettings(storedSettings), [storedSettings]);
  const [panel, setPanel] = useState<'settings' | 'history' | null>(null);

  const won = winner(game);
  const started = startedAt(game) !== null;
  const now = useNow(started && won === null);
  useWakeLock();

  const turn = settings.expert ? turnOf(game) : null;
  // Im Expertenmodus muss feststehen, wer beginnt, bevor gezählt wird.
  const choosing = settings.expert && turn === null && won === null;
  const limitMs = settings.timerMin === null ? null : settings.timerMin * 60_000;
  const clock = timerView(elapsedMs(game, now), limitMs);

  // Ein deutliches Signal in dem Moment, in dem die Zeit abläuft.
  const wasOvertime = useRef(clock.overtime);
  useEffect(() => {
    if (clock.overtime && !wasOvertime.current && won === null) navigator.vibrate?.([200, 100, 200, 100, 400]);
    wasOvertime.current = clock.overtime;
  }, [clock.overtime, won]);

  const save = (next: ScoreGame) => {
    if (next !== game) gameStore.set(next);
  };
  const point = (player: PlayerIndex, kind: PointKind) => {
    const next = addPoint(game, player, kind, nowIso());
    // Ein kurzer Impuls je Punkt, ein längeres Muster beim Siegpunkt.
    if (next !== game) navigator.vibrate?.(winner(next) === null ? 20 : [60, 60, 60, 60, 240]);
    save(next);
  };
  const pass = () => {
    navigator.vibrate?.(35);
    save(passTurn(game, nowIso()));
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
      turned={settings.facing && player === 1}
      turn={turn}
      expert={settings.expert}
      onPoint={(kind) => point(player, kind)}
      onMinus={() => save(removePoint(game, player, nowIso()))}
      onPass={pass}
    />
  );

  const label =
    won !== null
      ? clock.overtime
        ? 'Beendet · Overtime'
        : 'Partie beendet'
      : clock.overtime
        ? 'Overtime'
        : turn
          ? `Zug ${turn.turn} · bis ${game.target}`
          : `1 gegen 1 · bis ${game.target}`;
  const time = `${clock.overtime ? '+' : ''}${formatClock(clock.ms)}`;
  // Mit Zeitlimit lässt sich die Uhr schon vor dem ersten Punkt starten.
  const canStart = limitMs !== null && !started && !settings.expert;

  return (
    <main className="score" aria-label="Punktezähler">
      {side(1)}
      <div className={clock.overtime ? (won === null ? 'score-bar overtime running' : 'score-bar overtime') : 'score-bar'}>
        <div className="bar-group">
          <button type="button" disabled={game.events.length === 0} onClick={() => save(undo(game))}>
            <Icon name="undo" />
            <span>Zurück</span>
          </button>
          {settings.expert && (
            <button type="button" onClick={() => setPanel('history')}>
              <Icon name="history" />
              <span>History</span>
            </button>
          )}
        </div>
        {canStart ? (
          <button type="button" className="score-clock start" onClick={() => save(begin(game, nowIso()))}>
            <strong>
              <Icon name="play" />
              {time}
            </strong>
            <span>Uhr starten</span>
          </button>
        ) : (
          <div className="score-clock" role="timer" aria-label={`${label}, ${time}`}>
            <strong>{time}</strong>
            <span>{label}</span>
          </div>
        )}
        <div className="bar-group end">
          <button type="button" onClick={() => setPanel('settings')}>
            <Icon name="settings" />
            <span>Optionen</span>
          </button>
          <button
            type="button"
            className={won === null ? undefined : 'primary'}
            aria-label="Neues Spiel"
            onClick={restart}
          >
            <Icon name="restart" />
            <span>Neu</span>
          </button>
        </div>
      </div>
      {side(0)}

      {choosing && panel === null && (
        <Sheet title={game.events.length ? 'Wer ist am Zug?' : 'Wer beginnt?'}>
          <p>
            {game.events.length
              ? 'Die Partie läuft schon. Von hier an zählt der Expertenmodus die Züge.'
              : 'Mit der Wahl beginnt Zug 1 und die Uhr läuft los.'}
          </p>
          <div className="starter">
            {([0, 1] as const).map((player) => (
              <button
                key={player}
                type="button"
                className={`starter-pick player-${player + 1}`}
                onClick={() => save(begin(game, nowIso(), player))}
              >
                {playerName(player)}
              </button>
            ))}
          </div>
          <div className="buttons">
            <button type="button" onClick={() => save(begin(game, nowIso(), Math.random() < 0.5 ? 0 : 1))}>
              Auslosen
            </button>
            <button type="button" onClick={() => setPanel('settings')}>
              Optionen
            </button>
          </div>
        </Sheet>
      )}

      {panel === 'settings' && (
        <SettingsSheet settings={settings} onChange={(next) => settingsStore.set(next)} onClose={() => setPanel(null)} />
      )}
      {panel === 'history' && (
        <HistorySheet game={game} limitMs={limitMs} turn={turn} onClose={() => setPanel(null)} />
      )}
    </main>
  );
}

function Side({
  player,
  points,
  target,
  state,
  turned,
  turn,
  expert,
  onPoint,
  onMinus,
  onPass,
}: {
  player: PlayerIndex;
  points: PointKind[];
  target: number;
  state: 'playing' | 'won' | 'lost';
  turned: boolean;
  /** Laufender Zug im Expertenmodus; null im Standardmodus oder solange der Beginn offen ist. */
  turn: Turn | null;
  expert: boolean;
  onPoint: (kind: PointKind) => void;
  onMinus: () => void;
  onPass: () => void;
}) {
  const score = points.length;
  const left = target - score;
  const name = playerName(player);
  const count = (kind: PointKind) => points.filter((p) => p === kind).length;
  const active = turn !== null && turn.active === player;
  const classes = [
    'side',
    `player-${player + 1}`,
    state,
    turned ? 'turned' : '',
    // Nur während der Partie hebt sich hervor, wer am Zug ist.
    turn !== null && state === 'playing' ? (active ? 'active' : 'waiting') : '',
  ]
    .filter(Boolean)
    .join(' ');

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
        <span className="side-name">
          {name}
          {active && state === 'playing' && <span className="turn-badge">Am Zug · Zug {turn?.turn}</span>}
        </span>
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
        {expert ? (
          // Expertenmodus: Der Verlauf steht unter „History“; hier gibt der Spieler am Zug weiter.
          active ? (
            <button type="button" className="pass" disabled={state !== 'playing'} onClick={onPass}>
              Pass turn
              <Icon name="pass" />
            </button>
          ) : (
            <span className="trail-empty">
              {turn && state === 'playing' ? `${playerName(turn.active)} ist am Zug` : ''}
            </span>
          )
        ) : (
          <div className="trail" aria-label="Verlauf der Punkte">
            {points.length === 0 && <span className="trail-empty">Conquer oder Hold antippen</span>}
            {points.map((kind, i) => (
              <span key={i} className={`dot ${kind}`} title={KIND_LABELS[kind]}>
                {kind === 'conquer' ? 'C' : 'H'}
              </span>
            ))}
          </div>
        )}
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

/** Fläche über dem Zähler für Auswahl, Einstellungen und Verlauf; steht immer richtig herum. */
function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

function SettingsSheet({
  settings,
  onChange,
  onClose,
}: {
  settings: ScoreSettings;
  onChange: (next: ScoreSettings) => void;
  onClose: () => void;
}) {
  const custom = settings.timerMin !== null && !(TIMER_CHOICES as readonly number[]).includes(settings.timerMin);
  const setTimer = (timerMin: number | null) => onChange({ ...settings, timerMin });
  return (
    <Sheet title="Optionen" onClose={onClose}>
      <div className="chip-group" role="group" aria-label="Zeitlimit">
        <span className="chip-title">Zeitlimit</span>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={settings.timerMin === null} onClick={() => setTimer(null)}>
            Aus
          </button>
          {TIMER_CHOICES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="chip"
              aria-pressed={settings.timerMin === minutes}
              onClick={() => setTimer(minutes)}
            >
              {minutes} Min.
            </button>
          ))}
          <label className={custom ? 'chip custom on' : 'chip custom'}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={TIMER_MAX_MIN}
              placeholder="eigene"
              aria-label="Eigenes Zeitlimit in Minuten"
              value={custom ? settings.timerMin! : ''}
              onChange={(e) => setTimer(cleanTimer(Number.parseInt(e.target.value, 10)))}
            />
            Min.
          </label>
        </div>
        <p className="filter-hint">
          Läuft die Zeit ab, erscheint „Overtime“; die Partie läuft weiter. Die Uhr startet mit dem ersten Punkt, über
          die Uhr in der Mitte oder – im Expertenmodus – sobald feststeht, wer beginnt.
        </p>
      </div>

      <label className="option">
        <input
          type="checkbox"
          checked={settings.expert}
          onChange={(e) => onChange({ ...settings, expert: e.target.checked })}
        />
        <span>
          <strong>Expertenmodus</strong>
          Vor der Partie steht fest, wer beginnt. „Pass turn“ gibt den Zug weiter und zählt ihn hoch; „History“ zeigt,
          wer wann gepunktet hat.
        </span>
      </label>
      <label className="option">
        <input
          type="checkbox"
          checked={settings.facing}
          onChange={(e) => onChange({ ...settings, facing: e.target.checked })}
        />
        <span>
          <strong>Gegenüber sitzen</strong>
          Die obere Hälfte steht auf dem Kopf, damit zwei Spieler am selben Handy sitzen können.
        </span>
      </label>

      <div className="buttons">
        <button type="button" className="primary" onClick={onClose}>
          Fertig
        </button>
      </div>
    </Sheet>
  );
}

function HistorySheet({
  game,
  limitMs,
  turn,
  onClose,
}: {
  game: ScoreGame;
  limitMs: number | null;
  turn: Turn | null;
  onClose: () => void;
}) {
  const entries = history(game, limitMs);
  return (
    <Sheet title="History" onClose={onClose}>
      {turn && winner(game) === null && (
        <p>
          Zug {turn.turn}: <strong>{playerName(turn.active)}</strong> ist am Zug.
        </p>
      )}
      {entries.length === 0 ? (
        <p>Noch keine Punkte.</p>
      ) : (
        <table className="history">
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Zug</th>
              <th>Spieler</th>
              <th>Punkt</th>
              <th>Stand</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i} className={`player-${entry.player + 1}`}>
                <td>
                  {formatClock(entry.ms)}
                  {entry.overtime && <span className="ot">OT</span>}
                </td>
                <td>{entry.turn ?? '–'}</td>
                <td className="who">{playerName(entry.player)}</td>
                <td>
                  <span className={`dot ${entry.kind}`}>{entry.kind === 'conquer' ? 'C' : 'H'}</span>
                  {KIND_LABELS[entry.kind]}
                </td>
                <td>
                  {entry.score[0]} : {entry.score[1]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {entries.some((e) => e.overtime) && <p className="filter-hint">OT: Punkt in der Overtime.</p>}
      <div className="buttons">
        <button type="button" className="primary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </Sheet>
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

const ICONS = {
  // Fahne: ein Schlachtfeld erobern.
  conquer: <path d="M6 21V4m0 1.2c4-2.4 6.5 2.2 12 0v8.6c-5.5 2.2-8-2.4-12 0" />,
  // Schild: ein Schlachtfeld halten.
  hold: <path d="M12 3 5 5.6v5.6c0 4.5 2.9 8 7 9.8 4.1-1.8 7-5.3 7-9.8V5.6L12 3Zm-3 9 2.2 2.2L15.2 10" />,
  undo: <path d="M9 4 4 9l5 5M4.5 9H14a5.5 5.5 0 0 1 0 11h-2" />,
  restart: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.5H15" />,
  crown: <path d="m4 18 -1.2-10 5 4.2L12 5l4.2 7.2 5-4.2L20 18Zm0 2.5h16" />,
  // Uhr mit Pfeil zurück: Verlauf.
  history: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9M12 8v4.5l3 1.8" />,
  // Schieberegler: Optionen.
  settings: <path d="M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5" />,
  play: <path d="M8 5.5v13l10.5-6.5Z" />,
  // Pfeil nach rechts: Zug weitergeben.
  pass: <path d="M5 12h13m-5-5.5 5.5 5.5-5.5 5.5" />,
} satisfies Record<string, ReactNode>;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className={`icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
