import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { imageUrl, printCode, printImageId, printName, type CatalogIndex } from '../../data/catalog-index';
import { FINISH_LABELS, type Print } from '../../data/model';
import { formatEuro, type PriceData } from '../../data/prices';
import { COPY_LIMIT, copyCount, copyTotal, variantLabel } from '../../data/prints';
import {
  decideByNumber,
  defaultSku,
  interpretMatches,
  isLandscape,
  type NumberOutcome,
  type ScanHit,
} from '../../scan/candidates';
import type { Corners } from '../../scan/detect';
import { numberStrips, type NumberStrip } from '../../scan/number';
import type { FrameResult } from '../../scan/protocol';
import { DEFAULT_TRACKER, ScanTracker, type TrackerState } from '../../scan/tracker';
import { stockLine } from '../CollectionView';
import { db, type SessionRow } from '../db';
import { readLine, warmUpOcr } from './ocr';
import { SessionList } from './SessionList';
import { useCamera } from './useCamera';
import { useRecognizer } from './useRecognizer';

/** Längere Seite des Bilds, das an die Erkennung geht. Mehr bringt kaum Genauigkeit, kostet aber Zeit. */
const FRAME_SIZE = 960;
/** Pause zwischen zwei Erkennungen, damit das Handy nicht heiß läuft. */
const FRAME_PAUSE_MS = 120;
/** Bei unsicherem Treffer wird die Nummer höchstens so oft neu gelesen. */
const NUMBER_RETRY_MS = 600;
/** Unter dieser Zeilenhöhe im Kamerabild ist die Nummer nicht lesbar; der Versuch lohnt dann nicht. */
const MIN_NUMBER_HEIGHT = 9;

interface Overlay {
  corners: Corners;
  width: number;
  height: number;
  tone: TrackerState['status'];
}

/** Zuletzt gezählte Karte: Sitzungszeile plus die Fassungen, auf die man umstellen kann. */
interface LastScan {
  rowId: number;
  hit: ScanHit;
}

/** Ein Bild in voller Auflösung und seine verkleinerte Fassung für die Erkennung. */
interface Capture {
  /** Volle Auflösung; daraus wird später nur die Nummernzeile gelesen. */
  full: HTMLCanvasElement;
  frame: ImageData;
  /** Faktor von Koordinaten in `frame` zu Koordinaten in `full`. */
  scale: number;
}

function capture(
  source: CanvasImageSource,
  width: number,
  height: number,
  full: HTMLCanvasElement,
  small: HTMLCanvasElement,
): Capture | null {
  if (!width || !height) return null;
  full.width = width;
  full.height = height;
  const fullCtx = full.getContext('2d', { willReadFrequently: true });
  const shrink = Math.min(1, FRAME_SIZE / Math.max(width, height));
  small.width = Math.round(width * shrink);
  small.height = Math.round(height * shrink);
  const smallCtx = small.getContext('2d', { willReadFrequently: true });
  if (!fullCtx || !smallCtx) return null;
  fullCtx.drawImage(source, 0, 0, width, height);
  smallCtx.drawImage(source, 0, 0, small.width, small.height);
  return { full, frame: smallCtx.getImageData(0, 0, small.width, small.height), scale: 1 / shrink };
}

export function ScanView({
  index,
  stock,
  prices,
  session,
}: {
  index: CatalogIndex;
  stock: Map<string, number>;
  prices: PriceData | null;
  session: SessionRow[];
}) {
  const camera = useCamera();
  const recognizer = useRecognizer();
  const smallCanvas = useRef<HTMLCanvasElement | null>(null);
  const fullCanvas = useRef<HTMLCanvasElement | null>(null);
  const tracker = useRef(new ScanTracker());
  const fileInput = useRef<HTMLInputElement | null>(null);
  const lastNumberTry = useRef(0);

  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [candidates, setCandidates] = useState<ScanHit | null>(null);
  const [last, setLast] = useState<LastScan | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

  // Die Erkennung läuft in einer Schleife; sie braucht stets den aktuellen Bestand.
  const stockRef = useRef(stock);
  stockRef.current = stock;
  const sessionQty = useMemo(() => new Map(session.map((r) => [r.skuId, r.qty])), [session]);
  const sessionQtyRef = useRef(sessionQty);
  sessionQtyRef.current = sessionQty;

  useEffect(() => {
    if (recognizer.status === 'ready') warmUpOcr();
  }, [recognizer.status]);

  /**
   * Zählt eine Karte in der Sitzung. `seenMotif` ist das Motiv, das der Bildabgleich meldet;
   * es gilt als erledigt, solange die Karte liegen bleibt – auch wenn die Nummer am Ende
   * für eine andere Karte gesprochen hat.
   */
  const add = useCallback(async (hit: ScanHit, print: Print, distance: number | null, seenMotif: string) => {
    // Stand vor diesem Scan: Sammlung plus bisherige Sitzung.
    const warning = copyTotal(copyCount(print, stockRef.current, sessionQtyRef.current)) >= COPY_LIMIT;
    const rowId = await db.addToSession(defaultSku(print).id, distance);
    tracker.current.hold(seenMotif);
    setLast({ rowId, hit });
    setCandidates(null);
    // Ein kurzer Impuls für „gezählt“, ein deutlich längeres Muster für die Warnung.
    navigator.vibrate?.(warning ? [80, 80, 80, 80, 300] : 60);
  }, []);

  /**
   * Liest die Kartennummer aus dem Bild in voller Auflösung. Gibt null zurück, wenn die
   * Nummer nichts beiträgt oder nicht lesbar war; sonst den Treffer mit dem passenden Druck
   * vorn und die Angabe, ob die Nummer ihn bestätigt oder nur vorschlägt.
   */
  const readNumber = useCallback(
    async (shot: Capture, result: FrameResult, hit: ScanHit, sure: boolean): Promise<NumberOutcome | null> => {
      if (!result.corners) return null;
      const corners = result.corners.map((p) => ({ x: p.x * shot.scale, y: p.y * shot.scale })) as Corners;
      const ctx = shot.full.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      const read = async (strip: NumberStrip): Promise<string> => {
        const lineHeight = Math.hypot(strip.quad[0].x - strip.quad[3].x, strip.quad[0].y - strip.quad[3].y);
        if (lineHeight < MIN_NUMBER_HEIGHT) return '';
        // Nur den Bereich um die Zeile aus dem großen Bild lesen, nicht das ganze Bild.
        const xs = strip.quad.map((p) => p.x);
        const ys = strip.quad.map((p) => p.y);
        const left = Math.max(0, Math.floor(Math.min(...xs)) - 4);
        const top = Math.max(0, Math.floor(Math.min(...ys)) - 4);
        const right = Math.min(shot.full.width, Math.ceil(Math.max(...xs)) + 4);
        const bottom = Math.min(shot.full.height, Math.ceil(Math.max(...ys)) + 4);
        if (right - left < 8 || bottom - top < 8) return '';
        const crop = ctx.getImageData(left, top, right - left, bottom - top);
        const image = await recognizer.strip(
          crop,
          strip.quad.flatMap((p) => [p.x - left, p.y - top]),
          strip.width,
        );
        return image ? readLine(image) : '';
      };

      const strips = numberStrips(corners, result.flipped, isLandscape(hit.prints[0]!, index));
      return decideByNumber(hit, sure, index, strips, read);
    },
    [index, recognizer],
  );

  const describe = (hit: ScanHit | null, result: FrameResult, number?: string) =>
    (hit
      ? `Abstand ${hit.distance} · Vorsprung ${hit.margin} · ${result.ms.toFixed(0)} ms`
      : `keine Karte · ${result.ms.toFixed(0)} ms`) + (number ? ` · Nummer „${number}“` : '');

  // Laufende Erkennung im Kamerabild.
  useEffect(() => {
    if (recognizer.status !== 'ready' || !camera.running) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped) return;
      const video = camera.video.current;
      const shot =
        video && smallCanvas.current && fullCanvas.current
          ? capture(video, video.videoWidth, video.videoHeight, fullCanvas.current, smallCanvas.current)
          : null;
      if (shot) {
        const { width, height } = shot.frame;
        const result = await recognizer.recognize(shot.frame);
        if (stopped) return;
        if (result) {
          const hit = result.corners ? interpretMatches(result.matches, index) : null;
          const state = tracker.current.push({
            motif: hit?.motif ?? null,
            distance: hit?.distance ?? 128,
            margin: hit?.margin ?? 0,
          });
          setOverlay(result.corners ? { corners: result.corners, width, height, tone: state.status } : null);
          let number: string | undefined;

          if (state.status === 'idle') setCandidates(null);
          else if (state.status === 'sure' && state.isNew && hit) {
            // Bildabgleich ist sicher: Die Nummer wählt nur noch zwischen Drucken derselben Karte.
            const read = await readNumber(shot, result, hit, true);
            if (stopped) return;
            number = read?.text;
            const chosen = read?.confirmed ? read.hit : hit;
            await add(chosen, chosen.prints[0]!, hit.distance, hit.motif);
          } else if (state.status === 'unsure' && hit) {
            // Bildabgleich ist unsicher: Bestätigt die Nummer einen Kandidaten, zählt er trotzdem.
            const now = performance.now();
            if (now - lastNumberTry.current > NUMBER_RETRY_MS) {
              lastNumberTry.current = now;
              const read = await readNumber(shot, result, hit, false);
              if (stopped) return;
              number = read?.text;
              if (read?.confirmed) await add(read.hit, read.hit.prints[0]!, hit.distance, hit.motif);
              // Sonst wählt der Nutzer; eine im Katalog gefundene Nummer steht dabei vorn.
              else setCandidates(read?.hit ?? hit);
            }
          }
          setDiagnosis((previous) => (number || state.status !== 'sure' ? describe(hit, result, number) : previous));
        }
      }
      timer = setTimeout(() => void tick(), FRAME_PAUSE_MS);
    };
    void tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [recognizer.status, recognizer.recognize, camera.running, camera.video, index, add, readNumber]);

  /** Ein einzelnes Foto statt der laufenden Kamera: zum Testen oder wenn keine Kamera da ist. */
  async function scanPhoto(file: File) {
    setPhotoMessage('Foto wird geprüft …');
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const shot = capture(
        bitmap,
        bitmap.width,
        bitmap.height,
        document.createElement('canvas'),
        document.createElement('canvas'),
      );
      bitmap.close();
      if (!shot) throw new Error('Das Foto ließ sich nicht lesen.');

      // Läuft gerade ein Kamerabild durch die Erkennung, kurz warten.
      const frameCopy = () => new ImageData(new Uint8ClampedArray(shot.frame.data), shot.frame.width, shot.frame.height);
      let result: FrameResult | null = null;
      for (let attempt = 0; attempt < 40 && !result; attempt++) {
        result = await recognizer.recognize(frameCopy());
        if (!result) await new Promise((r) => setTimeout(r, 100));
      }
      if (!result) throw new Error('Die Erkennung ist beschäftigt. Bitte noch einmal versuchen.');

      const hit = result.corners ? interpretMatches(result.matches, index) : null;
      if (!hit || hit.distance > DEFAULT_TRACKER.maxDistance) {
        setDiagnosis(describe(hit, result));
        setPhotoMessage('Auf dem Foto wurde keine Karte erkannt.');
        return;
      }
      const sure = hit.distance <= DEFAULT_TRACKER.sureDistance && hit.margin >= DEFAULT_TRACKER.minMargin;
      const read = await readNumber(shot, result, hit, sure);
      setDiagnosis(describe(hit, result, read?.text));
      if (sure || read?.confirmed) {
        const chosen = read?.confirmed ? read.hit : hit;
        await add(chosen, chosen.prints[0]!, hit.distance, hit.motif);
        setPhotoMessage(null);
      } else {
        setCandidates(read?.hit ?? hit);
        setPhotoMessage('Nicht eindeutig. Wähle die passende Karte aus.');
      }
    } catch (err) {
      setPhotoMessage(err instanceof Error ? err.message : String(err));
    }
  }

  const lastRow = last && session.find((r) => r.id === last.rowId);
  const lastSku = lastRow && index.skuById.get(lastRow.skuId);
  const lastPrint = lastSku && index.printBySkuId.get(lastSku.id);
  // Laufend berechnet, damit die Warnung auch nach „Andere Fassung“ oder „Rückgängig“ stimmt.
  const lastCopies = lastPrint ? copyCount(lastPrint, stock, sessionQty) : null;

  const status =
    recognizer.status === 'loading'
      ? 'Erkennung wird geladen …'
      : recognizer.status === 'error'
        ? null
        : !camera.running
          ? null
          : overlay?.tone === 'sure'
            ? 'Erkannt'
            : overlay?.tone === 'unsure'
              ? 'Nicht eindeutig'
              : overlay
                ? 'Erkenne …'
                : 'Karte vor die Kamera halten';

  return (
    <div className="scan">
      <div className="viewfinder">
        <video ref={camera.video} playsInline muted />
        {overlay && camera.running && (
          <svg viewBox={`0 0 ${overlay.width} ${overlay.height}`} className={`outline ${overlay.tone}`} aria-hidden="true">
            <polygon points={overlay.corners.map((p) => `${p.x},${p.y}`).join(' ')} />
          </svg>
        )}
        {status && <p className="viewfinder-status">{status}</p>}
      </div>
      <canvas ref={smallCanvas} hidden />
      <canvas ref={fullCanvas} hidden />

      {camera.error && <p className="notice error">{camera.error}</p>}
      {recognizer.error && <p className="notice error">{recognizer.error}</p>}

      <div className="scan-controls">
        {camera.devices.length > 1 && (
          <select
            aria-label="Kamera"
            value={camera.deviceId ?? ''}
            onChange={(e) => camera.select(e.target.value)}
          >
            {camera.deviceId === null && <option value="">Kamera wählen</option>}
            {camera.devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        )}
        {camera.torch !== null && (
          <button type="button" aria-pressed={camera.torch} onClick={camera.toggleTorch}>
            Licht {camera.torch ? 'aus' : 'an'}
          </button>
        )}
        <button type="button" disabled={recognizer.status !== 'ready'} onClick={() => fileInput.current?.click()}>
          Foto wählen
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void scanPhoto(file);
          }}
        />
      </div>
      {photoMessage && <p className="notice">{photoMessage}</p>}

      {candidates && (
        <section className="panel pending">
          <h2>Welche Karte ist es?</h2>
          <p>Die Erkennung ist nicht sicher. Tippe die passende Fassung an, um sie zu zählen.</p>
          <div className="choices">
            {candidates.prints.slice(0, 6).map((print) => (
              <PrintChoice
                key={print.key}
                index={index}
                print={print}
                onPick={() => void add(candidates, print, null, candidates.motif)}
              />
            ))}
          </div>
        </section>
      )}

      {last && lastRow && lastSku && lastPrint && (
        <section className="panel last-scan">
          <div className="session-thumb large">
            {printImageId(lastPrint) && (
              <img src={imageUrl(index.catalog, printImageId(lastPrint)!, 'thumb')} alt="" />
            )}
          </div>
          <div className="last-text">
            {lastCopies && copyTotal(lastCopies) > COPY_LIMIT && (
              <p className="notice error limit" role="alert">
                Du hattest schon {COPY_LIMIT} oder mehr Karten dieser Fassung. Mit dieser sind es{' '}
                {copyTotal(lastCopies)} (Sammlung {lastCopies.collection}, Sitzung {lastCopies.session}). Sie wurde
                trotzdem gezählt; „Rückgängig“ nimmt sie wieder heraus.
              </p>
            )}
            <h2>{printName(index, lastPrint)}</h2>
            <p className="sub">
              {index.setById.get(lastPrint.setId)?.name} · {printCode(lastPrint)} · {variantLabel(lastSku)}
            </p>
            <p className="sub">
              {lastPrint.skus
                .map((s) => {
                  const low = prices?.entries[s.id]?.low ?? null;
                  return `${FINISH_LABELS[s.finish]}: ${low === null ? 'kein Preis' : formatEuro(low)}`;
                })
                .join(' · ')}
            </p>
            <p className="sub">Im Besitz: {stockLine(lastPrint, stock)}</p>
            <div className="buttons">
              {lastPrint.skus.length > 1 && (
                <select
                  aria-label="Finish der gescannten Karte"
                  value={lastSku.id}
                  onChange={(e) => void db.moveSessionRow(lastRow.id, e.target.value)}
                >
                  {lastPrint.skus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {FINISH_LABELS[s.finish]}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => {
                  void db.undoSessionScan(lastRow.id);
                  setLast(null);
                }}
              >
                Rückgängig
              </button>
            </div>
            {last.hit.prints.length > 1 && (
              <details>
                <summary>Andere Fassung dieser Karte</summary>
                <div className="choices">
                  {last.hit.prints
                    .filter((p) => p.key !== lastPrint.key)
                    .map((print) => (
                      <PrintChoice
                        key={print.key}
                        index={index}
                        print={print}
                        onPick={() => void db.moveSessionRow(lastRow.id, defaultSku(print).id)}
                      />
                    ))}
                </div>
              </details>
            )}
          </div>
        </section>
      )}

      <SessionList index={index} rows={session} prices={prices} stock={stock} />

      {diagnosis && <p className="version">{diagnosis}</p>}
    </div>
  );
}

function PrintChoice({ index, print, onPick }: { index: CatalogIndex; print: Print; onPick: () => void }) {
  const imageId = printImageId(print);
  return (
    <button type="button" className="choice" onClick={onPick}>
      <span className="session-thumb">
        {imageId && <img src={imageUrl(index.catalog, imageId, 'thumb')} alt="" loading="lazy" />}
      </span>
      <span className="choice-text">
        <strong>{printName(index, print)}</strong>
        <span>{printCode(print)}</span>
        <span>{variantLabel(print.skus[0]!)}</span>
      </span>
    </button>
  );
}
