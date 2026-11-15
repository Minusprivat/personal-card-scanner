import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { imageUrl, printCode, printImageId, printName, type CatalogIndex } from '../data/catalog-index';
import {
  DOMAIN_LABELS,
  filterPrints,
  NO_FILTERS,
  VARIANT_LABELS,
  type Filters,
  type OwnedFilter,
  type VariantFilter,
} from '../data/filter';
import { FINISH_LABELS, type Print } from '../data/model';
import { collectionValue, formatDay, formatEuro, type CollectionValue, type PriceData } from '../data/prices';
import { variantLabel } from '../data/prints';
import { cardHref } from './hooks';

const PAGE = 60;

const OWNED_LABELS: Record<OwnedFilter, string> = {
  all: 'Alle Karten',
  owned: 'Besitze ich',
  missing: 'Fehlt mir',
};

/** „Normal: 2 · Foil: 1“ – nur Finishes, die es für den Druck gibt. */
export function stockLine(print: Print, stock: Map<string, number>): string {
  return print.skus.map((s) => `${FINISH_LABELS[s.finish]}: ${stock.get(s.id) ?? 0}`).join(' · ');
}

const ownedOf = (print: Print, stock: Map<string, number>) =>
  print.skus.reduce((sum, s) => sum + (stock.get(s.id) ?? 0), 0);

export function CollectionView({
  index,
  stock,
  prices,
}: {
  index: CatalogIndex;
  stock: Map<string, number>;
  prices: PriceData | null;
}) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [limit, setLimit] = useState(PAGE);
  const query = useDeferredValue(filters.query);
  const sentinel = useRef<HTMLDivElement>(null);

  // Der Besitz-Filter hängt am Bestand; ohne ihn soll ein Zählerklick die Liste nicht neu filtern.
  const stockForFilter = filters.owned === 'all' ? null : stock;
  const prints = useMemo(
    () => filterPrints(index, { ...filters, query }, (p) => (stockForFilter ? ownedOf(p, stockForFilter) : 0)),
    [index, filters.setId, filters.variant, filters.domain, filters.owned, query, stockForFilter],
  );

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setLimit(PAGE);
  };

  // Lädt weitere Kacheln nach, sobald das Ende der Liste in Sicht kommt.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE);
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [prints]);

  const domains = useMemo(
    () => Object.keys(DOMAIN_LABELS).filter((d) => index.catalog.cards.some((c) => c.domains.includes(d))),
    [index],
  );
  const ownedPrints = useMemo(() => prints.filter((p) => ownedOf(p, stock) > 0).length, [prints, stock]);
  const value = useMemo(() => collectionValue(stock, prices), [stock, prices]);
  const active = JSON.stringify({ ...filters, query: filters.query.trim() }) !== JSON.stringify(NO_FILTERS);

  return (
    <>
      <div className="filters">
        <input
          type="search"
          className="search"
          placeholder="Name oder Nummer, z. B. Jinx oder OGN-142"
          aria-label="Suche nach Name oder Kartennummer"
          value={filters.query}
          onChange={(e) => set('query', e.target.value)}
        />
        <select aria-label="Set" value={filters.setId} onChange={(e) => set('setId', e.target.value)}>
          <option value="all">Alle Sets</option>
          {index.catalog.sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} – {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Variante"
          value={filters.variant}
          onChange={(e) => set('variant', e.target.value as VariantFilter)}
        >
          {(Object.keys(VARIANT_LABELS) as VariantFilter[]).map((v) => (
            <option key={v} value={v}>
              {VARIANT_LABELS[v]}
            </option>
          ))}
        </select>
        <select aria-label="Farbe" value={filters.domain} onChange={(e) => set('domain', e.target.value)}>
          <option value="all">Alle Farben</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {DOMAIN_LABELS[d]}
            </option>
          ))}
        </select>
        <select aria-label="Besitz" value={filters.owned} onChange={(e) => set('owned', e.target.value as OwnedFilter)}>
          {(Object.keys(OWNED_LABELS) as OwnedFilter[]).map((o) => (
            <option key={o} value={o}>
              {OWNED_LABELS[o]}
            </option>
          ))}
        </select>
      </div>

      <ValueLine value={value} prices={prices} />

      <p className="count">
        {prints.length} Drucke, davon {ownedPrints} im Besitz
        {active && (
          <button type="button" className="link" onClick={() => (setFilters(NO_FILTERS), setLimit(PAGE))}>
            Filter zurücksetzen
          </button>
        )}
      </p>

      {prints.length === 0 ? (
        <p className="notice">Keine Karte passt zu diesen Filtern.</p>
      ) : (
        <div className="grid">
          {prints.slice(0, limit).map((print) => (
            <Tile key={print.key} index={index} print={print} stock={stock} />
          ))}
        </div>
      )}
      {limit < prints.length && <div ref={sentinel} className="sentinel" />}
    </>
  );
}

/** Sammlungswert über die ganze Sammlung, unabhängig von den Filtern. */
function ValueLine({ value, prices }: { value: CollectionValue; prices: PriceData | null }) {
  if (!prices) return null;
  const without = value.unpricedQty + value.placeholderQty;
  return (
    <p className="value">
      <strong>Sammlungswert {formatEuro(value.total)}</strong>
      <span>
        Cardmarket Low (alle Sprachen), Stand {formatDay(prices.createdAt)}
        {without > 0 && <> · {without === 1 ? '1 Karte' : `${without} Karten`} ohne Preis nicht eingerechnet</>}
      </span>
    </p>
  );
}

function Tile({ index, print, stock }: { index: CatalogIndex; print: Print; stock: Map<string, number> }) {
  const imageId = printImageId(print);
  const owned = ownedOf(print, stock);
  const name = printName(index, print);
  const variant = variantLabel(print.skus[0]!);
  return (
    <a className={owned ? 'tile owned' : 'tile'} href={cardHref(print.cardId)}>
      <div className="art">
        {imageId ? (
          <img src={imageUrl(index.catalog, imageId, 'thumb')} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="noimg">kein Bild</span>
        )}
        {owned > 0 && <span className="badge">{owned}</span>}
      </div>
      <div className="tile-name">{name}</div>
      <div className="tile-meta">
        {printCode(print)}
        {variant !== 'Standard' && <> · {variant}</>}
      </div>
      <div className="tile-stock">{stockLine(print, stock)}</div>
    </a>
  );
}
