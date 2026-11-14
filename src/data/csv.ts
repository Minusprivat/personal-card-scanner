/** Liest CSV nach RFC 4180: Komma als Trenner, Anführungszeichen, Zeilenumbrüche in Feldern. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (t[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

const needsQuotes = /[",\r\n]/;

export function toCsv(rows: Array<Array<string | number | boolean>>): string {
  return (
    rows
      .map((r) =>
        r
          .map((v) => {
            const s = String(v);
            return needsQuotes.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\r\n') + '\r\n'
  );
}

/** Zeilen als Objekte mit den Spaltennamen der Kopfzeile. Wirft, wenn Pflichtspalten fehlen. */
export function parseCsvRecords(text: string, required: readonly string[]): Array<Record<string, string>> {
  const rows = parseCsv(text);
  const head = rows[0]?.map((h) => h.trim());
  if (!head) throw new Error('Die Datei ist leer.');
  const missing = required.filter((c) => !head.includes(c));
  if (missing.length) throw new Error(`Spalten fehlen: ${missing.join(', ')}.`);
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
