/**
 * Leiser Ton für den Ablauf des Zeitlimits, mit Web Audio erzeugt (keine Tondatei in der App).
 *
 * Browser lassen Ton oft erst zu, nachdem jemand die Seite berührt hat. `primeSound` läuft deshalb
 * bei der ersten Berührung des Zählers und gibt den Tonkanal frei; die Android-App braucht das nicht
 * (Capacitor erlaubt Ton ohne Berührung), schadet dort aber nicht. Ohne Web Audio geschieht nichts.
 */

type AudioCtor = typeof AudioContext;

let context: AudioContext | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;

function audio(): AudioContext | null {
  if (context) return context;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

/** Bei einer Berührung aufrufen: gibt den Tonkanal frei, damit der Ton später ohne Berührung spielen darf. */
export function primeSound(): void {
  if (context) return;
  const ctx = audio();
  if (!ctx) return;
  // Einmal freigeben genügt; danach ruht der Kanal bis zum Ton.
  void ctx
    .resume()
    .then(() => rest(ctx, 500))
    .catch(() => undefined);
}

function rest(ctx: AudioContext, afterMs: number): void {
  clearTimeout(idle);
  idle = setTimeout(() => void ctx.suspend().catch(() => undefined), afterMs);
}

/** Zwei sanfte Glockentöne, zweimal; leise und kurz. */
const NOTES: { hz: number; at: number }[] = [
  { hz: 660, at: 0 },
  { hz: 880, at: 0.22 },
  { hz: 660, at: 0.9 },
  { hz: 880, at: 1.12 },
];
const VOLUME = 0.12;
const DECAY_S = 0.7;

export function playOvertimeTone(): void {
  const ctx = audio();
  if (!ctx) return;
  try {
    void ctx.resume().catch(() => undefined);
    const start = ctx.currentTime + 0.05;
    for (const note of NOTES) {
      const t = start + note.at;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.hz;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOLUME, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + DECAY_S);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + DECAY_S + 0.05);
    }
  } catch {
    return;
  }
  // Danach ruht der Tonkanal wieder, damit er nicht dauerhaft Strom zieht.
  rest(ctx, 3000);
}
