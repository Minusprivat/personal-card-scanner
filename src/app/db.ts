import Dexie, { type EntityTable } from 'dexie';
import { emptyCollection, type CollectionState } from '../data/backup';
import type { PiltoverRow, PiltoverTemplate } from '../data/piltover';

interface StockRow {
  skuId: string;
  qty: number;
  updatedAt: string;
}
interface TemplateRow extends PiltoverTemplate {
  skuId: string;
}
interface KeyValue {
  key: string;
  value: unknown;
}

/** Eine Zeile der Scan-Sitzung: gescannt, aber noch nicht in die Sammlung übernommen. */
export interface SessionRow {
  id: number;
  skuId: string;
  qty: number;
  /** Nur angehakte Zeilen wandern bei „Auswahl übernehmen“ in die Sammlung. */
  checked: boolean;
  /** Abstand des Treffers beim Scannen (0 = perfekt); null bei Auswahl von Hand. */
  distance: number | null;
  /** Zeitpunkt des letzten Scans dieser Zeile. */
  at: string;
}

const EXTRA_ROWS = 'piltoverExtraRows';

/** Bestand auf dem Gerät. Katalog und Preise liegen bewusst nicht hier, sie sind Tagesdaten. */
export class CollectionDb extends Dexie {
  stock!: EntityTable<StockRow, 'skuId'>;
  piltoverTemplates!: EntityTable<TemplateRow, 'skuId'>;
  kv!: EntityTable<KeyValue, 'key'>;
  session!: EntityTable<SessionRow, 'id'>;

  constructor(name = 'personal-card-scanner') {
    super(name);
    this.version(1).stores({ stock: 'skuId', piltoverTemplates: 'skuId', kv: 'key' });
    this.version(2).stores({ session: '++id, skuId' });
  }

  /** Zählt eine gescannte Fassung in der Sitzung; dieselbe Fassung erneut erhöht die Menge. */
  async addToSession(skuId: string, distance: number | null): Promise<number> {
    return this.transaction('rw', this.session, async () => {
      const at = new Date().toISOString();
      const row = await this.session.where('skuId').equals(skuId).first();
      if (row) {
        await this.session.update(row.id, { qty: row.qty + 1, checked: true, distance, at });
        return row.id;
      }
      return this.session.add({ skuId, qty: 1, checked: true, distance, at } as SessionRow);
    });
  }

  /** Ändert eine Sitzungszeile. Eine Menge von 0 entfernt sie. */
  async updateSession(id: number, patch: Partial<Pick<SessionRow, 'qty' | 'checked'>>): Promise<void> {
    if (patch.qty !== undefined && patch.qty <= 0) await this.session.delete(id);
    else await this.session.update(id, patch);
  }

  /**
   * Stellt eine Zeile auf eine andere Fassung um (anderes Finish, anderer Druck).
   * Gibt es die Zielfassung schon in der Sitzung, werden beide Zeilen zusammengelegt.
   */
  async moveSessionRow(id: number, skuId: string): Promise<void> {
    await this.transaction('rw', this.session, async () => {
      const row = await this.session.get(id);
      if (!row || row.skuId === skuId) return;
      const target = await this.session.where('skuId').equals(skuId).first();
      if (target) {
        await this.session.update(target.id, { qty: target.qty + row.qty, checked: target.checked || row.checked });
        await this.session.delete(id);
      } else await this.session.update(id, { skuId });
    });
  }

  /** Nimmt den letzten Scan einer Zeile zurück. */
  async undoSessionScan(id: number): Promise<void> {
    await this.transaction('rw', this.session, async () => {
      const row = await this.session.get(id);
      if (!row) return;
      if (row.qty <= 1) await this.session.delete(id);
      else await this.session.update(id, { qty: row.qty - 1 });
    });
  }

  /** Schreibt die angehakten Zeilen in die Sammlung und verwirft den Rest der Sitzung. */
  async commitSession(): Promise<number> {
    return this.transaction('rw', this.session, this.stock, async () => {
      const now = new Date().toISOString();
      let cards = 0;
      for (const row of await this.session.toArray()) {
        if (!row.checked || row.qty <= 0) continue;
        const current = (await this.stock.get(row.skuId))?.qty ?? 0;
        await this.stock.put({ skuId: row.skuId, qty: current + row.qty, updatedAt: now });
        cards += row.qty;
      }
      await this.session.clear();
      return cards;
    });
  }

  /** Setzt die Menge einer Fassung; 0 entfernt den Eintrag. */
  async setQty(skuId: string, qty: number): Promise<void> {
    const n = Math.max(0, Math.floor(qty));
    if (n === 0) await this.stock.delete(skuId);
    else await this.stock.put({ skuId, qty: n, updatedAt: new Date().toISOString() });
  }

  async changeQty(skuId: string, delta: number): Promise<void> {
    await this.transaction('rw', this.stock, async () => {
      const current = (await this.stock.get(skuId))?.qty ?? 0;
      await this.setQty(skuId, current + delta);
    });
  }

  async readCollection(): Promise<CollectionState> {
    const state = emptyCollection();
    for (const row of await this.stock.toArray()) state.stock.set(row.skuId, row.qty);
    for (const { skuId, ...template } of await this.piltoverTemplates.toArray()) state.templates.set(skuId, template);
    state.extraRows = ((await this.kv.get(EXTRA_ROWS))?.value as PiltoverRow[] | undefined) ?? [];
    return state;
  }

  /** Ersetzt die gesamte Sammlung in einem Schritt. */
  async replaceCollection(state: CollectionState): Promise<void> {
    const now = new Date().toISOString();
    await this.transaction('rw', this.stock, this.piltoverTemplates, this.kv, async () => {
      await this.stock.clear();
      await this.piltoverTemplates.clear();
      await this.stock.bulkPut(
        [...state.stock].filter(([, qty]) => qty > 0).map(([skuId, qty]) => ({ skuId, qty, updatedAt: now })),
      );
      await this.piltoverTemplates.bulkPut([...state.templates].map(([skuId, t]) => ({ skuId, ...t })));
      await this.kv.put({ key: EXTRA_ROWS, value: state.extraRows });
    });
  }

  /** Zählt Mengen zum vorhandenen Bestand dazu. */
  async addToCollection(state: CollectionState): Promise<void> {
    const now = new Date().toISOString();
    await this.transaction('rw', this.stock, this.piltoverTemplates, this.kv, async () => {
      for (const [skuId, qty] of state.stock) {
        if (qty <= 0) continue;
        const current = (await this.stock.get(skuId))?.qty ?? 0;
        await this.stock.put({ skuId, qty: current + qty, updatedAt: now });
      }
      await this.piltoverTemplates.bulkPut([...state.templates].map(([skuId, t]) => ({ skuId, ...t })));
      if (state.extraRows.length) {
        const old = ((await this.kv.get(EXTRA_ROWS))?.value as PiltoverRow[] | undefined) ?? [];
        await this.kv.put({ key: EXTRA_ROWS, value: [...old, ...state.extraRows] });
      }
    });
  }
}

export const db = new CollectionDb();
