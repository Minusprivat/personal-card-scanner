import { useState, type ReactNode } from 'react';
import { BOUNDRIFT_SEARCH_URL, boundRiftPlayerUrl, EVENTS_URL, parseBoundRiftPlayer } from '../../data/links';
import { inAppLink } from '../browser';
import { localStore, useLocalStore } from '../local-store';

/** Spielernummer bei BoundRift; liegt nur auf diesem Gerät. */
const playerStore = localStore<string>('boundriftPlayer');

/** Link zu einer fremden Seite, der in der Android-App als Browser-Fenster über der App aufgeht. */
function PageLink({ url, primary, children }: { url: string; primary?: boolean; children: ReactNode }) {
  return (
    <a
      className={primary ? 'button primary' : 'button'}
      href={url}
      target="_blank"
      rel="noopener"
      onClick={inAppLink(url)}
    >
      {children}
    </a>
  );
}

/** Seite „Events“: Events bei Riot und das eigene Profil bei BoundRift. Der Punktezähler hat einen eigenen Menüpunkt. */
export function PlayView() {
  const playerId = useLocalStore(playerStore);
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);

  const save = () => {
    const id = parseBoundRiftPlayer(input);
    setInvalid(id === null);
    if (id === null) return;
    playerStore.set(id);
    setInput('');
  };

  return (
    <div className="files play">
      <section className="panel">
        <h1>Events</h1>
        <p>
          Events in deiner Nähe suchen, dich anmelden und dein Deck einreichen. Das öffnet die Event-Seite von Riot in
          einem Browser-Fenster; dort meldest du dich mit deinem Riot-Konto an. Die App sieht davon nichts.
        </p>
        <div className="buttons">
          <PageLink url={EVENTS_URL} primary>
            Events finden und anmelden
          </PageLink>
        </div>
      </section>

      <section className="panel">
        <h2>Mein Profil: Elo und Matches</h2>
        <p>
          BoundRift wertet die öffentlichen Event-Ergebnisse aus und zeigt je Spieler Match-Historie, Bilanz und eine
          Elo. BoundRift ist ein unabhängiges Fan-Projekt; die Elo ist dessen eigene, inoffizielle Wertung.
        </p>
        {playerId ? (
          <div className="buttons">
            <PageLink url={boundRiftPlayerUrl(playerId)} primary>
              Mein Profil öffnen
            </PageLink>
            <PageLink url={BOUNDRIFT_SEARCH_URL}>Spieler suchen</PageLink>
            <button type="button" onClick={() => playerStore.set(null)}>
              Profil ändern
            </button>
          </div>
        ) : (
          <>
            <p>
              Einmal einrichten: Such dich in der Rangliste, öffne deine Spielerseite und füge ihren Link hier ein. Er
              bleibt nur auf diesem Gerät.
            </p>
            <div className="profile-form">
              <input
                type="url"
                inputMode="url"
                placeholder="https://boundrift.com/players/…"
                aria-label="Link zu deiner Spielerseite bei BoundRift"
                aria-invalid={invalid}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setInvalid(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
              <button type="button" className="primary" disabled={input.trim() === ''} onClick={save}>
                Speichern
              </button>
            </div>
            {invalid && (
              <p className="notice error">
                Das ist kein Link zu einer Spielerseite. Er sieht so aus: https://boundrift.com/players/461635
              </p>
            )}
            <div className="buttons">
              <PageLink url={BOUNDRIFT_SEARCH_URL}>Spieler suchen</PageLink>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
