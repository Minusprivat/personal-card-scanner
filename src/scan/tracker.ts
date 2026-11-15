/**
 * Entscheidet aus einer Folge von Einzelbildern, wann eine Karte als erkannt gilt.
 *
 * Regeln (SPEC, Abschnitte Scannen und Scan-Sitzung):
 * - Ein Treffer zählt erst, wenn er über mehrere Bilder hinweg stabil und eindeutig ist.
 * - Eine Karte, die im Bild liegen bleibt, zählt nur einmal.
 * - Dieselbe Karte ein zweites Mal vor die Kamera gehalten zählt erneut.
 */

export interface Observation {
  /** Motiv des besten Treffers (Karte + Art-Variante); null, wenn keine Karte im Bild war. */
  motif: string | null;
  /** Abstand des besten Treffers, 0 bis 128. */
  distance: number;
  /** Vorsprung vor dem besten Treffer eines anderen Motivs. */
  margin: number;
}

export interface TrackerOptions {
  /** So viele Bilder in Folge müssen dasselbe Motiv zeigen. */
  confirmFrames: number;
  /** Bis zu diesem Abstand gilt ein Treffer als sicher. */
  sureDistance: number;
  /** Bis zu diesem Abstand wird ein Treffer überhaupt als Karte gewertet. */
  maxDistance: number;
  /** Mindestvorsprung vor einem anderen Motiv für einen sicheren Treffer. */
  minMargin: number;
  /** Nach so vielen Bildern ohne die Karte gilt sie als weggenommen. */
  releaseFrames: number;
}

export const DEFAULT_TRACKER: TrackerOptions = {
  confirmFrames: 3,
  sureDistance: 30,
  maxDistance: 44,
  minMargin: 8,
  releaseFrames: 3,
};

export type TrackerState =
  /** Keine Karte im Bild. */
  | { status: 'idle' }
  /** Etwas Kartenähnliches, aber (noch) kein stabiler Treffer. */
  | { status: 'looking'; motif: string }
  /** Stabil, aber nicht eindeutig genug zum automatischen Zählen: Auswahl anbieten. */
  | { status: 'unsure'; motif: string }
  /** Sicher erkannt. `isNew` ist genau einmal true: in dem Bild, in dem die Karte gezählt wird. */
  | { status: 'sure'; motif: string; isNew: boolean };

export class ScanTracker {
  private streakMotif: string | null = null;
  private streak = 0;
  private misses = 0;
  /** Motiv, das zuletzt gezählt wurde und noch im Bild liegt. */
  private held: string | null = null;

  constructor(private readonly opts: TrackerOptions = DEFAULT_TRACKER) {}

  push(obs: Observation): TrackerState {
    const usable = obs.motif !== null && obs.distance <= this.opts.maxDistance;
    if (!usable) {
      this.streak = 0;
      this.streakMotif = null;
      if (++this.misses >= this.opts.releaseFrames) this.held = null;
      return this.held ? { status: 'sure', motif: this.held, isNew: false } : { status: 'idle' };
    }

    const motif = obs.motif!;
    this.misses = 0;
    if (motif === this.streakMotif) this.streak++;
    else {
      this.streakMotif = motif;
      this.streak = 1;
    }

    if (motif === this.held) return { status: 'sure', motif, isNew: false };
    if (this.streak < this.opts.confirmFrames) return { status: 'looking', motif };

    // Eine andere Karte liegt stabil im Bild: Die vorige ist damit weg.
    this.held = null;
    const sure = obs.distance <= this.opts.sureDistance && obs.margin >= this.opts.minMargin;
    if (!sure) return { status: 'unsure', motif };
    this.held = motif;
    return { status: 'sure', motif, isNew: true };
  }

  /** Nach einer Auswahl von Hand: Die Karte gilt als gezählt, solange sie liegen bleibt. */
  hold(motif: string): void {
    this.held = motif;
  }

  reset(): void {
    this.streakMotif = null;
    this.streak = 0;
    this.misses = 0;
    this.held = null;
  }
}
