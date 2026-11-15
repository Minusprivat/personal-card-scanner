import { useRef, useState, type ReactNode } from 'react';
import {
  createBackup,
  emptyCollection,
  exportCollectionCsv,
  importCollectionCsv,
  parseBackup,
  type CollectionState,
} from '../data/backup';
import type { CatalogIndex } from '../data/catalog-index';
import { FINISH_LABELS } from '../data/model';
import { exportPiltover, importPiltover, type PiltoverImport } from '../data/piltover';
import { variantLabel } from '../data/prints';
import { db } from './db';
import { APP_VERSION } from './hooks';
import {
  canShareFiles,
  isNativeApp,
  NATIVE_FOLDER,
  saveFile,
  shareFile,
  type OutFile,
  type SaveResult,
} from './save';

type ExportKind = 'backup' | 'piltover' | 'csv';

/** Eine fertig erzeugte Datei samt Satz für die Erfolgsmeldung. */
interface Export extends OutFile {
  summary: ReactNode;
}

/** Was nach dem Speichern oder Teilen tatsächlich feststeht. */
const OUTCOME: Record<Exclude<SaveResult, 'cancelled'>, string> = {
  picked: 'Gespeichert.',
  documents: `Gespeichert im Ordner „Dokumente/${NATIVE_FOLDER}“.`,
  shared: 'An die gewählte App übergeben.',
  downloaded:
    'An den Browser übergeben; die Datei liegt im Ordner „Downloads“. Kommt dort nichts an, nimm „Teilen“.',
};

const today = () => new Date().toISOString().slice(0, 10);
const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
/** „1 Zeile“, „3 Zeilen“. */
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Eine eingelesene Datei, die auf die Entscheidung „ersetzen oder dazuzählen“ wartet. */
interface Pending {
  title: string;
  state: CollectionState;
  details: ReactNode;
  /** Sicherungen ersetzen immer; Tabellen und Piltover-Dateien dürfen auch dazugezählt werden. */
  allowAdd: boolean;
}

export function FilesView({ index, stock }: { index: CatalogIndex; stock: Map<string, number> }) {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: ReactNode } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [share] = useState(canShareFiles);

  const cards = sum(stock);
  const unknown = [...stock.keys()].filter((id) => !index.skuById.has(id)).length;

  const fail = (err: unknown) =>
    setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) });

  async function apply(mode: 'replace' | 'add') {
    if (!pending) return;
    try {
      if (mode === 'replace') await db.replaceCollection(pending.state);
      else await db.addToCollection(pending.state);
      setMessage({
        kind: 'ok',
        text:
          mode === 'replace'
            ? `Sammlung ersetzt: ${sum(pending.state.stock)} Karten.`
            : `${sum(pending.state.stock)} Karten zur Sammlung dazugezählt.`,
      });
      setPending(null);
    } catch (err) {
      fail(err);
    }
  }

  async function buildExport(kind: ExportKind): Promise<Export> {
    const state = await db.readCollection();
    if (kind === 'backup') {
      return {
        name: `card-scanner-sicherung-${today()}.json`,
        text: createBackup(state, index, new Date().toISOString()),
        type: 'application/json',
        summary: `Sicherung mit ${count(sum(state.stock), 'Karte', 'Karten')}.`,
      };
    }
    if (kind === 'csv') {
      return {
        name: `card-scanner-sammlung-${today()}.csv`,
        text: exportCollectionCsv(state.stock, index),
        type: 'text/csv',
        summary: `Tabelle mit ${count(sum(state.stock), 'Karte', 'Karten')}.`,
      };
    }
    const out = exportPiltover(state.stock, index, state.templates, state.extraRows);
    return {
      name: `piltover-collection-card-scanner-${today()}.csv`,
      text: out.csv,
      type: 'text/csv',
      summary: (
        <>
          Piltover-Datei mit {count(out.totalQty, 'Karte', 'Karten')} in {count(out.rows, 'Zeile', 'Zeilen')}.
          {out.derived.length > 0 && (
            <>
              {' '}
              Bei {count(out.derived.length, 'Fassung', 'Fassungen')} ist die Piltover-Nummer geschätzt, weil sie nie
              aus Piltover Archive importiert wurden.
            </>
          )}
          {out.skipped.length > 0 && (
            <>
              {' '}
              Nicht enthalten: {count(out.skipped.reduce((n, x) => n + x.qty, 0), 'Karte', 'Karten')}, die das Format
              nicht kennt (Metal-Fassungen).
            </>
          )}
        </>
      ),
    };
  }

  async function run(kind: ExportKind, how: 'save' | 'share') {
    try {
      const file = await buildExport(kind);
      const result = how === 'share' ? await shareFile(file) : await saveFile(file);
      if (result === 'cancelled') return;
      setMessage({
        kind: 'ok',
        text: (
          <>
            {file.summary} {OUTCOME[result]}
          </>
        ),
      });
    } catch (err) {
      fail(err);
    }
  }

  /** „Speichern“ und, wo das Gerät es kann, „Teilen“ für eine Exportart. */
  const exportButtons = (kind: ExportKind, label: string, primary = false) => (
    <>
      <button type="button" className={primary ? 'primary' : undefined} onClick={() => void run(kind, 'save')}>
        {label}
      </button>
      {share && (
        <button type="button" onClick={() => void run(kind, 'share')}>
          Teilen
        </button>
      )}
    </>
  );

  function loadBackup(text: string) {
    const state = parseBackup(text);
    const missing = [...state.stock.keys()].filter((id) => !index.skuById.has(id)).length;
    setPending({
      title: 'Sicherung einspielen',
      state,
      allowAdd: false,
      details: (
        <p>
          Die Sicherung enthält {sum(state.stock)} Karten in {state.stock.size} Fassungen.
          {missing > 0 && <> {missing} Fassungen stehen nicht im aktuellen Katalog; sie bleiben trotzdem erhalten.</>}
        </p>
      ),
    });
  }

  function loadCsv(text: string) {
    const result = importCollectionCsv(text, index);
    setPending({
      title: 'Tabelle einlesen',
      state: { ...emptyCollection(), stock: result.stock },
      allowAdd: true,
      details: (
        <p>
          {sum(result.stock)} Karten in {result.stock.size} Fassungen erkannt.
          {result.unknownLines.length > 0 && (
            <>
              {' '}
              Nicht zuordenbar: Zeile {result.unknownLines.slice(0, 20).join(', ')}
              {result.unknownLines.length > 20 && ' …'}.
            </>
          )}
        </p>
      ),
    });
  }

  function loadPiltover(text: string) {
    const result = importPiltover(text, index);
    setPending({
      title: 'Piltover-Archive-Datei einlesen',
      state: { stock: result.stock, templates: result.templates, extraRows: result.unmatched.map((u) => u.row) },
      allowAdd: true,
      details: <PiltoverPreview result={result} />,
    });
  }

  return (
    <div className="files">
      <section className="panel">
        <h1>Sicherung</h1>
        <p>
          Deine Sammlung liegt nur auf diesem Gerät: <strong>{cards === 1 ? '1 Karte' : `${cards} Karten`}</strong> in{' '}
          {stock.size === 1 ? '1 Fassung' : `${stock.size} Fassungen`}.
          {unknown > 0 && <> {unknown} Fassungen stehen nicht mehr im Katalog.</>} Lege regelmäßig eine Sicherung an. Mit
          der Sicherungsdatei überträgst du die Sammlung auch zwischen Handy und PC.
          {share && ' „Teilen“ schickt die Datei an eine App deiner Wahl, zum Beispiel Google Drive oder E-Mail.'}
        </p>
      </section>

      {message && (
        <p className={message.kind === 'ok' ? 'notice ok' : 'notice error'} role="status">
          {message.text}
        </p>
      )}

      {pending && (
        <section className="panel pending">
          <h2>{pending.title}</h2>
          {pending.details}
          <p>
            Aktuell auf dem Gerät: {cards} Karten.
            {pending.allowAdd ? ' Was soll mit der Datei geschehen?' : ' Die Sicherung ersetzt diesen Bestand.'}
          </p>
          <div className="buttons">
            <button type="button" className="primary" onClick={() => void apply('replace')}>
              Sammlung ersetzen
            </button>
            {pending.allowAdd && (
              <button type="button" onClick={() => void apply('add')}>
                Zur Sammlung dazuzählen
              </button>
            )}
            <button type="button" onClick={() => setPending(null)}>
              Abbrechen
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Sicherungsdatei (JSON)</h2>
        <p>Vollständige Sicherung dieser App. Stellt den Bestand genau wieder her.</p>
        <div className="buttons">
          {exportButtons('backup', 'Sicherung speichern', true)}
          <FileButton accept=".json,.txt,application/json,text/plain" onText={loadBackup} onError={fail}>
            Sicherung einspielen
          </FileButton>
        </div>
      </section>

      <section className="panel">
        <h2>Piltover Archive (CSV)</h2>
        <p>
          Liest die Sammlungsdatei aus Piltover Archive und schreibt eine Datei im selben Format für den Import dort.
          Zustand, Grading und Notizen führt diese App nicht; beim Export steht überall „Near Mint“.
        </p>
        <div className="buttons">
          <FileButton accept=".csv,text/csv" onText={loadPiltover} onError={fail}>
            Piltover-Datei einlesen
          </FileButton>
          {exportButtons('piltover', 'Für Piltover Archive speichern')}
        </div>
      </section>

      <section className="panel">
        <h2>Tabelle (CSV)</h2>
        <p>Für Excel oder Google Tabellen: Nummer, Name, Set, Variante, Finish, Menge.</p>
        <div className="buttons">
          {exportButtons('csv', 'Tabelle speichern')}
          <FileButton accept=".csv,text/csv" onText={loadCsv} onError={fail}>
            Tabelle einlesen
          </FileButton>
        </div>
      </section>

      <p className="version">
        Version {APP_VERSION} · {isNativeApp() ? 'Android-App' : 'Web-App'}
      </p>
    </div>
  );
}

function PiltoverPreview({ result }: { result: PiltoverImport }) {
  return (
    <>
      <p>
        {count(result.rows, 'Zeile', 'Zeilen')} mit {count(result.totalQty, 'Karte', 'Karten')} gelesen. Zugeordnet:{' '}
        <strong>{count(result.matchedQty, 'Karte', 'Karten')}</strong> in{' '}
        {count(result.stock.size, 'Fassung', 'Fassungen')}.
      </p>
      {result.unmatched.length > 0 && (
        <details open>
          <summary>
            {count(result.unmatched.reduce((n, u) => n + u.row.quantity, 0), 'Karte', 'Karten')} ohne Zuordnung (
            {count(result.unmatched.length, 'Zeile', 'Zeilen')})
          </summary>
          <p>
            Sie erscheinen nicht in der Sammlung, bleiben aber gespeichert und stehen beim Export für Piltover Archive
            wieder in der Datei.
          </p>
          <ul>
            {result.unmatched.map((u) => (
              <li key={u.row.line}>
                Zeile {u.row.line}: {u.row.variantNumber} {u.row.cardName} ({u.row.quantity}×) – {u.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      {result.uncertain.length > 0 && (
        <details>
          <summary>{count(result.uncertain.length, 'Zeile', 'Zeilen')} unsicher zugeordnet</summary>
          <ul>
            {result.uncertain.map((u) => (
              <li key={u.row.line}>
                Zeile {u.row.line}: {u.row.variantNumber} {u.row.cardName} → {u.sku.publicCode} ({variantLabel(u.sku)},{' '}
                {FINISH_LABELS[u.sku.finish]}). {u.note}.
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function FileButton({
  accept,
  onText,
  onError,
  children,
}: {
  accept: string;
  onText: (text: string) => void;
  onError: (err: unknown) => void;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          file.text().then(onText).catch(onError);
        }}
      />
    </>
  );
}
