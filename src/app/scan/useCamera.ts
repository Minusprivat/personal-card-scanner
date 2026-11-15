import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface CameraDevice {
  id: string;
  label: string;
}

export interface Camera {
  video: RefObject<HTMLVideoElement | null>;
  running: boolean;
  error: string | null;
  devices: CameraDevice[];
  deviceId: string | null;
  select(deviceId: string): void;
  /** null: Das Gerät hat kein schaltbares Licht. */
  torch: boolean | null;
  toggleTorch(): void;
}

function explain(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Der Kamera-Zugriff wurde nicht erlaubt. Erlaube ihn in den Einstellungen für diese App oder Seite und öffne den Scanner neu.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Es wurde keine Kamera gefunden.';
  if (name === 'NotReadableError') return 'Die Kamera wird gerade von einer anderen App benutzt.';
  return `Die Kamera ließ sich nicht starten (${err instanceof Error ? err.message : String(err)}).`;
}

/** Kamera-Bild für den Scanner: Rückkamera bevorzugt, am PC wählbar (auch das Handy als Webcam). */
export function useCamera(): Camera {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setRunning(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Dieser Browser gibt die Kamera nicht frei. Der Scanner braucht eine sichere Verbindung (https).');
        return;
      }
      stop();
      setError(null);
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        const el = video.current;
        if (el) {
          el.srcObject = s;
          await el.play().catch(() => undefined);
        }
        setRunning(true);

        // Namen der Kameras gibt der Browser erst nach der Freigabe heraus.
        const all = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setDevices(
          all
            .filter((d) => d.kind === 'videoinput')
            .map((d, i) => ({ id: d.deviceId, label: d.label || `Kamera ${i + 1}` })),
        );
        const track = s.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorch(capabilities?.torch ? false : null);
      } catch (err) {
        if (!cancelled) setError(explain(err));
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [deviceId, stop]);

  const toggleTorch = useCallback(() => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    const next = !torch;
    track
      .applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorch(next))
      .catch(() => setTorch(null));
  }, [torch]);

  return { video, running, error, devices, deviceId, select: setDeviceId, torch, toggleTorch };
}
