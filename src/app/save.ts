/**
 * Dateien aus der App herausgeben. Es gibt drei Wege, weil keiner überall funktioniert:
 * - „Speichern unter“ (Chrome und Edge am PC),
 * - Teilen über das Menü des Handys (Drive, E-Mail, Dateien …),
 * - klassischer Download in den Ordner „Downloads“.
 */

export interface OutFile {
  name: string;
  text: string;
  /** MIME-Typ, z. B. text/csv. */
  type: string;
}

export type SaveResult = 'picked' | 'downloaded' | 'shared' | 'cancelled';

const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

type SavePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>;

function download(file: OutFile): void {
  const url = URL.createObjectURL(new Blob([file.text], { type: file.type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  // Manche Android-Browser brechen den Download ab, wenn Link oder Adresse sofort verschwinden.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

/** Speichert mit Ortsauswahl, wo der Browser das kann; sonst als Download. */
export async function saveFile(file: OutFile): Promise<SaveResult> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (picker) {
    const ext = file.name.slice(file.name.lastIndexOf('.'));
    try {
      const handle = await picker({
        suggestedName: file.name,
        types: [{ description: 'Card Scanner', accept: { [file.type]: [ext] } }],
      });
      const out = await handle.createWritable();
      await out.write(file.text);
      await out.close();
      return 'picked';
    } catch (err) {
      if (isAbort(err)) return 'cancelled';
      // Dialog nicht erlaubt (z. B. eingebetteter Browser): weiter mit dem Download.
    }
  }
  download(file);
  return 'downloaded';
}

/**
 * Das Teilen-Menü nimmt nur bestimmte Dateiendungen an (.csv und .txt ja, .json nein).
 * Die Sicherung geht deshalb notfalls als .json.txt hinaus; der Inhalt bleibt gleich.
 */
function shareable(file: OutFile): File | null {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return null;
  const candidates = [
    new File([file.text], file.name, { type: file.type }),
    new File([file.text], `${file.name}.txt`, { type: 'text/plain' }),
  ];
  return candidates.find((f) => navigator.canShare({ files: [f] })) ?? null;
}

/** true, wenn dieses Gerät Dateien über das Teilen-Menü weitergeben kann. */
export const canShareFiles = (): boolean => shareable({ name: 'probe.csv', text: 'a,b', type: 'text/csv' }) !== null;

export async function shareFile(file: OutFile): Promise<SaveResult> {
  const f = shareable(file);
  if (!f) throw new Error('Dieses Gerät kann die Datei nicht teilen. Nutze „Speichern“.');
  try {
    await navigator.share({ files: [f], title: file.name });
    return 'shared';
  } catch (err) {
    if (isAbort(err)) return 'cancelled';
    throw err;
  }
}
