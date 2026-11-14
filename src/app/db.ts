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

const EXTRA_ROWS = 'piltoverExtraRows';

/** Bestand auf dem Gerät. Katalog und Preise liegen bewusst nicht hier, sie sind Tagesdaten. */
export class CollectionDb extends Dexie {
  stock!: EntityTable<StockRow, 'skuId'>;
  piltoverTemplates!: EntityTable<TemplateRow, 'skuId'>;
  kv!: EntityTable<KeyValue, 'key'>;

  constructor(name = 'personal-card-scanner') {
    super(name);
    this.version(1).stores({ stock: 'skuId', piltoverTemplates: 'skuId', kv: 'key' });
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
