import { useCallback, useEffect, useRef, useState } from 'react';
import { imageUrl, printCode, printImageId, printName, type CatalogIndex } from '../../data/catalog-index';
import { FINISH_LABELS, type Print } from '../../data/model';
import { formatEuro, type PriceData } from '../../data/prices';
import { variantLabel } from '../../data/prints';
import { defaultSku, interpretMatches, type ScanHit } from '../../scan/candidates';
import type { Corners } from '../../scan/detect';
import type { FrameResult } from '../../scan/protocol';
import { DEFAULT_TRACKER, ScanTracker, type TrackerState } from '../../scan/tracker';
import { stockLine } from '../CollectionView';
import { db, type SessionRow } from '../db';
import { SessionList } from './SessionList';
import { useCamera } from './useCamera';
import { useRecognizer } from './useRecognizer';

/** Längere Seite des Bilds, das an die Erkennung geht. Mehr bringt kaum Genauigkeit, kostet aber Zeit. */
const FRAME_SIZE = 960;
/** Pause zwischen zwei Erkennungen, damit das Handy nicht heiß läuft. */
const FRAME_PAUSE_MS = 120;

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

function toImageData(source: CanvasImageSource, width: number, height: number, canvas: HTMLCanvasElement): ImageData | null {
  if (!width || !height) return null;
  const scale = Math.min(1, FRAME_SIZE / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
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
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const tracker = useRef(new ScanTracker());
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [candidates, setCandidates] = useState<ScanHit | null>(null);
  const [last, setLast] = useState<LastScan | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

  const add = useCallback(async (hit: ScanHit, print: Print, distance: number | null) => {
    const rowId = await db.addToSession(defaultSku(print).id, distance);
    tracker.current.hold(hit.motif);
    setLast({ rowId, hit });
    setCandidates(null);
    navigator.vibrate?.(60);
  }, []);

  const describe = (hit: ScanHit | null, result: FrameResult) =>
    hit
      ? `Abstand ${hit.distance} · Vorsprung ${hit.margin} · ${result.ms.toFixed(0)} ms`
      : `keine Karte · ${result.ms.toFixed(0)} ms`;

  // Laufende Erkennung im Kamerabild.
  useEffect(() => {
    if (recognizer.status !== 'ready' || !camera.running) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped) return;
      const video = camera.video.current;
      const frame = video && canvas.current && toImageData(video, video.videoWidth, video.videoHeight, canvas.current);
      if (frame) {
        const { width, height } = frame;
        const result = await recognizer.recognize(frame);
        if (stopped) return;
        if (result) {
          const hit = result.corners ? interpretMatches(result.matches, index) : null;
          const state = tracker.current.push({
            motif: hit?.motif ?? null,
            distance: hit?.distance ?? 128,
            margin: hit?.margin ?? 0,
          });
          setOverlay(result.corners ? { corners: result.corners, width, height, tone: state.status } : null);
          setDiagnosis(describe(hit, result));
          if (state.status === 'idle') setCandidates(null);
          else if (state.status === 'unsure' && hit) setCandidates(hit);
          else if (state.status === 'sure' && state.isNew && hit) await add(hit, hit.prints[0]!, hit.distance);
        }
      }
      timer = setTimeout(() => void tick(), FRAME_PAUSE_MS);
    };
    void tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [recognizer.status, recognizer.recognize, camera.running, camera.video, index, add]);

  /** Ein einzelnes Foto statt der laufenden Kamera: zum Testen oder wenn keine Kamera da ist. */
  async function scanPhoto(file: File) {
    setPhotoMessage('Foto wird geprüft …');
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const frame = toImageData(bitmap, bitmap.width, bitmap.height, document.createElement('canvas'));
      bitmap.close();
      if (!frame) throw new Error('Das Foto ließ sich nicht lesen.');

      // Läuft gerade ein Kamerabild durch die Erkennung, kurz warten.
      let result: FrameResult | null = null;
      for (let attempt = 0; attempt < 40 && !result; attempt++) {
        result = await recognizer.recognize(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height));
        if (!result) await new Promise((r) => setTimeout(r, 100));
      }
      if (!result) throw new Error('Die Erkennung ist beschäftigt. Bitte noch einmal versuchen.');

      const hit = result.corners ? interpretMatches(result.matches, index) : null;
      setDiagnosis(describe(hit, result));
      if (!hit || hit.distance > DEFAULT_TRACKER.maxDistance) {
        setPhotoMessage('Auf dem Foto wurde keine Karte erkannt.');
        return;
      }
      if (hit.distance <= DEFAULT_TRACKER.sureDistance && hit.margin >= DEFAULT_TRACKER.minMargin) {
        await add(hit, hit.prints[0]!, hit.distance);
        setPhotoMessage(null);
      } else {
        setCandidates(hit);
        setPhotoMessage('Nicht eindeutig. Wähle die passende Karte aus.');
      }
    } catch (err) {
      setPhotoMessage(err instanceof Error ? err.message : String(err));
    }
  }

  const lastRow = last && session.find((r) => r.id === last.rowId);
  const lastSku = lastRow && index.skuById.get(lastRow.skuId);
  const lastPrint = lastSku && index.printBySkuId.get(lastSku.id);

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
      <canvas ref={canvas} hidden />

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
                onPick={() => void add(candidates, print, candidates.distance)}
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

      <SessionList index={index} rows={session} prices={prices} />

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
