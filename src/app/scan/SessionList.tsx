import { useState } from 'react';
import { imageUrl, printCode, printImageId, printName, type CatalogIndex } from '../../data/catalog-index';
import { FINISH_LABELS } from '../../data/model';
import { formatEuro, type PriceData } from '../../data/prices';
import { variantLabel } from '../../data/prints';
import { db, type SessionRow } from '../db';

const cards = (n: number) => (n === 1 ? '1 Karte' : `${n} Karten`);

/**
 * Gescannte Karten vor der Übernahme. Jede Zeile lässt sich abwählen, in der Menge
 * und im Finish ändern; erst „Auswahl übernehmen“ schreibt in die Sammlung.
 */
export function SessionList({
  index,
  rows,
  prices,
}: {
  index: CatalogIndex;
  rows: SessionRow[];
  prices: PriceData | null;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const checkedQty = rows.reduce((n, r) => n + (r.checked ? r.qty : 0), 0);
  const totalQty = rows.reduce((n, r) => n + r.qty, 0);

  async function commit() {
    const n = await db.commitSession();
    setMessage(`${cards(n)} in die Sammlung übernommen.`);
  }

  async function discard() {
    if (!window.confirm(`Sitzung mit ${cards(totalQty)} verwerfen? Die Sammlung bleibt unverändert.`)) return;
    await db.session.clear();
    setMessage('Sitzung verworfen.');
  }

  if (rows.length === 0) {
    return (
      <section className="panel session">
        <h2>Sitzung</h2>
        {message && <p className="session-message">{message}</p>}
        <p>Noch nichts gescannt. Erkannte Karten sammeln sich hier, bevor du sie in die Sammlung übernimmst.</p>
      </section>
    );
  }

  return (
    <section className="panel session">
      <h2>Sitzung: {cards(totalQty)}</h2>
      <ul className="session-rows">
        {rows.map((row) => {
          const sku = index.skuById.get(row.skuId);
          const print = sku && index.printBySkuId.get(sku.id);
          if (!sku || !print) {
            return (
              <li key={row.id} className="session-row">
                <span className="session-text">Karte steht nicht mehr im Katalog ({row.qty}×)</span>
                <button type="button" onClick={() => void db.updateSession(row.id, { qty: 0 })}>
                  Entfernen
                </button>
              </li>
            );
          }
          const imageId = printImageId(print);
          const variant = variantLabel(sku);
          const low = prices?.entries[sku.id]?.low ?? null;
          return (
            <li key={row.id} className={row.checked ? 'session-row' : 'session-row unchecked'}>
              <input
                type="checkbox"
                checked={row.checked}
                aria-label={`${printName(index, print)} übernehmen`}
                onChange={(e) => void db.updateSession(row.id, { checked: e.target.checked })}
              />
              <div className="session-thumb">
                {imageId && <img src={imageUrl(index.catalog, imageId, 'thumb')} alt="" loading="lazy" />}
              </div>
              <div className="session-text">
                <strong>{printName(index, print)}</strong>
                <span>
                  {printCode(print)}
                  {variant !== 'Standard' && <> · {variant}</>}
                  {low !== null && <> · {formatEuro(low)}</>}
                </span>
                {print.skus.length > 1 ? (
                  <select
                    aria-label="Finish"
                    value={sku.id}
                    onChange={(e) => void db.moveSessionRow(row.id, e.target.value)}
                  >
                    {print.skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {FINISH_LABELS[s.finish]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{FINISH_LABELS[sku.finish]}</span>
                )}
              </div>
              <div className="stepper">
                <button
                  type="button"
                  aria-label="eine weniger"
                  onClick={() => void db.updateSession(row.id, { qty: row.qty - 1 })}
                >
                  −
                </button>
                <output>{row.qty}</output>
                <button
                  type="button"
                  aria-label="eine mehr"
                  onClick={() => void db.updateSession(row.id, { qty: row.qty + 1 })}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="buttons">
        <button type="button" className="primary" disabled={checkedQty === 0} onClick={() => void commit()}>
          Auswahl übernehmen ({cards(checkedQty)})
        </button>
        <button type="button" onClick={() => void discard()}>
          Sitzung verwerfen
        </button>
      </div>
    </section>
  );
}
