import { useEffect } from 'react';
import { cardTitle, imageUrl, printCode, printImageId, type CatalogIndex } from '../data/catalog-index';
import { DOMAIN_LABELS } from '../data/filter';
import { FINISH_LABELS, type Print, type Sku } from '../data/model';
import { cardmarketEnglishUrl, formatDay, formatEuro, type PriceData } from '../data/prices';
import { variantLabel } from '../data/prints';
import { compactOrigins, countByKind, isPromo, kindSummary, originLabels } from '../data/versions';
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
  const kinds = kindSummary(countByKind(prints, stock));

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={card ? cardTitle(card) : 'Karte'}>
      {/* Bleibt beim Scrollen oben stehen: Zurück, Name und Bestand je Art. */}
      <header className="detail-head">
        <button type="button" className="back" onClick={close}>
          ← Zurück
        </button>
        <div className="detail-title">
          <h1>{card ? cardTitle(card) : 'Unbekannte Karte'}</h1>
          {kinds.length > 0 && (
            <p className="detail-kinds">
              {kinds.map((k) => (
                <span key={k.kind} className={k.qty > 0 ? 'kind has' : 'kind'}>
                  {k.label}: {k.qty}
                </span>
              ))}
            </p>
          )}
        </div>
      </header>

      {card && (
        <p className="sub detail-meta">
          {[...card.types, ...card.domains.map((d) => DOMAIN_LABELS[d] ?? d)].join(' · ')} · {prints.length}{' '}
          {prints.length === 1 ? 'Druck' : 'Drucke'} · {total} im Besitz
        </p>
      )}

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
  // Woher die Fassung stammt, z. B. „Nexus Night › Origins“ oder „Worlds 2026 Bundle“.
  // Ein Eintrag kann Karten verschiedener Herkunft bündeln (Foil vom Release Event, Metal von
  // der Prize Wall, Metal Deluxe als Best Of); dann steht die Herkunft bei jedem Finish.
  const perSku = print.skus.map((sku) => compactOrigins(originLabels(sku, index.catalog)));
  const shared = perSku.every((list) => list.join('|') === perSku[0]!.join('|'));
  const origins = shared ? perSku[0]! : [];
  return (
    <section className="print">
      <div className="art large">
        {imageId ? (
          <img src={imageUrl(index.catalog, imageId, 'detail')} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="noimg">kein Bild</span>
        )}
      </div>
      <h2>
        {printCode(print)}
        {isPromo(first) && <span className="kind-badge">Promo</span>}
      </h2>
      <p className="sub">
        {index.setById.get(print.setId)?.name} · {variantLabel(first)}
      </p>
      {origins.length > 0 && (
        <ul className="origins" aria-label="Herkunft">
          {origins.map((origin) => (
            <li key={origin}>{origin}</li>
          ))}
        </ul>
      )}
      {print.skus.map((sku, i) => (
        <Counter
          key={sku.id}
          sku={sku}
          qty={stock.get(sku.id) ?? 0}
          price={priceText(prices, sku)}
          origins={shared ? [] : perSku[i]!}
        />
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

function Counter({ sku, qty, price, origins }: { sku: Sku; qty: number; price: string; origins: string[] }) {
  const label = FINISH_LABELS[sku.finish];
  return (
    <div className="counter">
      <span className="counter-label">
        {label}
        {origins.map((origin) => (
          <small key={origin} className="origin">
            {origin}
          </small>
        ))}
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
