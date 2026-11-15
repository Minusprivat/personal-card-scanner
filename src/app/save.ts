import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Dateien aus der App herausgeben. Es gibt mehrere Wege, weil keiner überall funktioniert:
 * - Android-App: direkt in den Ordner „Dokumente/CardScanner“ oder über das Teilen-Menü,
 * - „Speichern unter“ (Chrome und Edge am PC),
 * - Teilen über das Menü des Handys (Drive, E-Mail, Dateien …),
 * - klassischer Download in den Ordner „Downloads“.
 */

/** true in der installierten Android-App (APK), false im Browser und in der Web-App. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** Ordner unter „Dokumente“, in den die Android-App speichert. */
export const NATIVE_FOLDER = 'CardScanner';

export interface OutFile {
  name: string;
  text: string;
  /** MIME-Typ, z. B. text/csv. */
  type: string;
}

export type SaveResult = 'picked' | 'downloaded' | 'documents' | 'shared' | 'cancelled';

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

async function nativeShare(file: OutFile): Promise<SaveResult> {
  // Das Teilen-Menü braucht eine echte Datei; sie liegt im Zwischenspeicher der App.
  const { uri } = await Filesystem.writeFile({
    path: file.name,
    data: file.text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: file.name, files: [uri], dialogTitle: file.name });
    return 'shared';
  } catch (err) {
    // Das Plugin meldet einen Abbruch als Fehler mit diesem Text.
    if (err instanceof Error && /cancel/i.test(err.message)) return 'cancelled';
    throw err;
  }
}

/** Speichert mit Ortsauswahl, wo der Browser das kann; sonst als Download. */
export async function saveFile(file: OutFile): Promise<SaveResult> {
  if (isNativeApp()) {
    try {
      await Filesystem.writeFile({
        path: `${NATIVE_FOLDER}/${file.name}`,
        data: file.text,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return 'documents';
    } catch {
      // Android verweigert z. B. das Überschreiben einer Datei aus einer früheren Installation.
      return nativeShare(file);
    }
  }

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
export const canShareFiles = (): boolean =>
  isNativeApp() || shareable({ name: 'probe.csv', text: 'a,b', type: 'text/csv' }) !== null;

export async function shareFile(file: OutFile): Promise<SaveResult> {
  if (isNativeApp()) return nativeShare(file);
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
