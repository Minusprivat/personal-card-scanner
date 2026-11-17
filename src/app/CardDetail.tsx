import { useEffect } from 'react';
import { imageUrl, printCode, printImageId, type CatalogIndex } from '../data/catalog-index';
import { DOMAIN_LABELS } from '../data/filter';
import { FINISH_LABELS, type Print, type Sku } from '../data/model';
import { cardmarketEnglishUrl, formatDay, formatEuro, type PriceData } from '../data/prices';
import { variantLabel } from '../data/prints';
import { db } from './db';

function close() {
  // Zurück zur Sammlung; bei direktem Aufruf der Detailseite gibt es keinen Verlauf.
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/';
}

export function CardDetail({
  index,
  stock,
  prices,
  cardId,
}: {
  index: CatalogIndex;
  stock: Map<string, number>;
  prices: PriceData | null;
  cardId: string;
}) {
  const card = index.cardById.get(cardId);
  const prints = index.printsByCardId.get(cardId) ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, []);

  const total = prints.reduce((sum, p) => sum + p.skus.reduce((n, s) => n + (stock.get(s.id) ?? 0), 0), 0);

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={card?.name ?? 'Karte'}>
      <div className="detail-head">
        <button type="button" className="back" onClick={close}>
          ← Zurück
        </button>
        <div>
          <h1>{card?.name ?? 'Unbekannte Karte'}</h1>
          {card && (
            <p className="sub">
              {[...card.types, ...card.domains.map((d) => DOMAIN_LABELS[d] ?? d)].join(' · ')} · {prints.length}{' '}
              {prints.length === 1 ? 'Druck' : 'Drucke'} · {total} im Besitz
            </p>
          )}
        </div>
      </div>

      {card?.text && <p className="card-text">{card.text}</p>}

      {prints.length === 0 && <p className="notice">Diese Karte steht nicht im Katalog.</p>}

      <div className="prints">
        {prints.map((print) => (
          <PrintCard key={print.key} index={index} print={print} stock={stock} prices={prices} />
        ))}
      </div>
    </div>
  );
}

function PrintCard({
  index,
  print,
  stock,
  prices,
}: {
  index: CatalogIndex;
  print: Print;
  stock: Map<string, number>;
  prices: PriceData | null;
}) {
  const imageId = printImageId(print);
  const first = print.skus[0]!;
  const productId = print.skus.map((s) => prices?.entries[s.id]?.productId).find((id) => id !== undefined);
  return (
    <section className="print">
      <div className="art large">
        {imageId ? (
          <img src={imageUrl(index.catalog, imageId, 'detail')} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="noimg">kein Bild</span>
        )}
      </div>
      <h2>{printCode(print)}</h2>
      <p className="sub">
        {index.setById.get(print.setId)?.name} · {variantLabel(first)}
      </p>
      {print.skus.map((sku) => (
        <Counter key={sku.id} sku={sku} qty={stock.get(sku.id) ?? 0} price={priceText(prices, sku)} />
      ))}
      {prices && (
        <p className="price">
          Cardmarket Low über alle Sprachen, Stand {formatDay(prices.createdAt)}.
          {productId !== undefined && (
            <>
              {' '}
              <a className="textlink" href={cardmarketEnglishUrl(productId)} target="_blank" rel="noopener">
                Auf Cardmarket (EN) öffnen
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}

/** „0,65 € · Trend 1,20 €“, „kein Preis“ oder leer, solange die Preise noch laden. */
function priceText(prices: PriceData | null, sku: Sku): string {
  if (!prices) return '';
  const entry = prices.entries[sku.id];
  if (!entry || entry.low === null) return 'kein Preis';
  const low = formatEuro(entry.low);
  if (!entry.hasSales) return `${low} · ohne Verkäufe, nicht im Sammlungswert`;
  return entry.trend === null ? low : `${low} · Trend ${formatEuro(entry.trend)}`;
}

function Counter({ sku, qty, price }: { sku: Sku; qty: number; price: string }) {
  const label = FINISH_LABELS[sku.finish];
  return (
    <div className="counter">
      <span className="counter-label">
        {label}
        {price && <small>{price}</small>}
      </span>
      <button
        type="button"
        aria-label={`${label}: eine weniger`}
        disabled={qty === 0}
        onClick={() => void db.changeQty(sku.id, -1)}
      >
        −
      </button>
      <output aria-label={`${label}: Anzahl`}>{qty}</output>
      <button type="button" aria-label={`${label}: eine mehr`} onClick={() => void db.changeQty(sku.id, 1)}>
        +
      </button>
    </div>
  );
}
