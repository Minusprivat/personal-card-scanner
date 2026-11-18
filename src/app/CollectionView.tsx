import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { imageUrl, printImageId, printName, type CatalogIndex } from '../data/catalog-index';
import {
  activeFilterCount,
  DOMAIN_LABELS,
  filterCards,
  hasFilters,
  NO_FILTERS,
  RARITY_LABELS,
  TYPE_LABELS,
  VARIANT_LABELS,
  type CardGroup,
  type Filters,
  type OwnedFilter,
  type Variant,
} from '../data/filter';
import { FINISH_LABELS, type Print } from '../data/model';
import { collectionValue, formatDay, formatEuro, type CollectionValue, type PriceData } from '../data/prices';
import { countByKind, kindSummary } from '../data/versions';
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

const NO_STOCK = new Map<string, number>();

/** Karten im Bestand über alle Fassungen einer Karte. */
const ownedOf = (group: CardGroup, stock: Map<string, number>) =>
  group.prints.reduce((sum, p) => sum + p.skus.reduce((n, s) => n + (stock.get(s.id) ?? 0), 0), 0);

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
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  // Beim Tippen bleibt die Eingabe flüssig; die Liste zieht nach.
  const applied = useDeferredValue(filters);
  const sentinel = useRef<HTMLDivElement>(null);

  // Der Besitz-Filter hängt am Bestand; ohne ihn soll ein Zählerklick die Liste nicht neu filtern.
  const stockForFilter = applied.owned === 'all' ? NO_STOCK : stock;
  const cards = useMemo(() => filterCards(index, applied, stockForFilter), [index, applied, stockForFilter]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setLimit(PAGE);
  };
  /** Schaltet einen Wert in einer Mehrfachauswahl an oder aus. */
  const toggle = <K extends 'setIds' | 'variants' | 'domains' | 'types' | 'rarities' | 'keywords'>(
    key: K,
    value: Filters[K][number],
  ) => {
    setFilters((f) => {
      const list = f[key] as string[];
      return { ...f, [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] };
    });
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
  }, [cards]);

  // Nur Werte anbieten, die im Katalog vorkommen; die Reihenfolge geben die Tabellen vor.
  const options = useMemo(() => {
    const cards = index.catalog.cards;
    const rarities = new Set(index.catalog.skus.map((s) => s.rarity));
    const types = new Set(cards.flatMap((c) => [...c.types, ...c.superTypes]));
    return {
      domains: Object.keys(DOMAIN_LABELS).filter((d) => cards.some((c) => c.domains.includes(d))),
      types: Object.keys(TYPE_LABELS).filter((t) => types.has(t)),
      rarities: Object.keys(RARITY_LABELS).filter((r) => rarities.has(r)),
      keywords: [...new Set(cards.flatMap((c) => c.keywords))].sort((a, b) => a.localeCompare(b, 'en')),
      // Ältere Katalogstände tragen noch keinen Kartentext; dann bleibt das Suchfeld weg.
      hasText: cards.some((c) => c.text),
    };
  }, [index]);
  const ownedCards = useMemo(() => cards.filter((g) => ownedOf(g, stock) > 0).length, [cards, stock]);
  const value = useMemo(() => collectionValue(stock, prices), [stock, prices]);
  const activeCount = activeFilterCount(filters);

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
        {options.hasText && (
          <input
            type="search"
            placeholder="Kartentext, z. B. move"
            aria-label="Suche im Kartentext"
            value={filters.text}
            onChange={(e) => set('text', e.target.value)}
          />
        )}
        <button
          type="button"
          className={activeCount > 0 ? 'filter-toggle active' : 'filter-toggle'}
          aria-expanded={open}
          aria-controls="filter-panel"
          onClick={() => setOpen((o) => !o)}
        >
          Filter{activeCount > 0 && ` (${activeCount})`}
        </button>
      </div>

      {open && (
        <div className="filter-panel" id="filter-panel">
          <ChipGroup title="Besitz">
            {(Object.keys(OWNED_LABELS) as OwnedFilter[]).map((o) => (
              <Chip key={o} on={filters.owned === o} onClick={() => set('owned', o)}>
                {OWNED_LABELS[o]}
              </Chip>
            ))}
          </ChipGroup>
          <ChipGroup
            title="Farbe"
            all={filters.allDomains}
            allLabel="muss alle gewählten Farben haben"
            onAll={filters.domains.length > 1 ? (v) => set('allDomains', v) : undefined}
          >
            {options.domains.map((d) => (
              <Chip key={d} on={filters.domains.includes(d)} tone={d} onClick={() => toggle('domains', d)}>
                {DOMAIN_LABELS[d]}
              </Chip>
            ))}
          </ChipGroup>
          <ChipGroup title="Kartentyp">
            {options.types.map((t) => (
              <Chip key={t} on={filters.types.includes(t)} onClick={() => toggle('types', t)}>
                {TYPE_LABELS[t]}
              </Chip>
            ))}
          </ChipGroup>
          <ChipGroup title="Seltenheit">
            {options.rarities.map((r) => (
              <Chip key={r} on={filters.rarities.includes(r)} onClick={() => toggle('rarities', r)}>
                {RARITY_LABELS[r]}
              </Chip>
            ))}
          </ChipGroup>
          <ChipGroup title="Variante">
            {(Object.keys(VARIANT_LABELS) as Variant[]).map((v) => (
              <Chip key={v} on={filters.variants.includes(v)} onClick={() => toggle('variants', v)}>
                {VARIANT_LABELS[v]}
              </Chip>
            ))}
          </ChipGroup>
          <ChipGroup title="Set">
            {index.catalog.sets.map((s) => (
              <Chip key={s.id} on={filters.setIds.includes(s.id)} title={s.name} onClick={() => toggle('setIds', s.id)}>
                {s.code}
              </Chip>
            ))}
          </ChipGroup>
          {options.keywords.length > 0 && (
            <ChipGroup
              title="Schlagwort"
              all={filters.allKeywords}
              allLabel="muss alle gewählten Schlagwörter haben"
              onAll={filters.keywords.length > 1 ? (v) => set('allKeywords', v) : undefined}
            >
              {options.keywords.map((k) => (
                <Chip key={k} on={filters.keywords.includes(k)} onClick={() => toggle('keywords', k)}>
                  {k}
                </Chip>
              ))}
            </ChipGroup>
          )}
          <p className="filter-hint">
            Mehrere Werte in einer Zeile: Eine Karte passt, wenn einer davon zutrifft. Die Zeilen gelten gemeinsam.{' '}
            <button type="button" className="link" onClick={() => setOpen(false)}>
              Filter schließen
            </button>
          </p>
        </div>
      )}

      <ValueLine value={value} prices={prices} />

      <p className="count">
        {cards.length === 1 ? '1 Karte' : `${cards.length} Karten`}, davon {ownedCards} im Besitz
        {hasFilters(filters) && (
          <button type="button" className="link" onClick={() => (setFilters(NO_FILTERS), setLimit(PAGE))}>
            Filter zurücksetzen
          </button>
        )}
      </p>

      {cards.length === 0 ? (
        <p className="notice">Keine Karte passt zu diesen Filtern.</p>
      ) : (
        <div className="grid">
          {cards.slice(0, limit).map((group) => (
            <Tile key={group.cardId} index={index} group={group} stock={stock} />
          ))}
        </div>
      )}
      {limit < cards.length && <div ref={sentinel} className="sentinel" />}
    </>
  );
}

/** Eine Zeile des Filterfelds. Mit `onAll` erscheint der Schalter „muss alle gewählten haben“. */
function ChipGroup({
  title,
  children,
  all,
  allLabel,
  onAll,
}: {
  title: string;
  children: ReactNode;
  all?: boolean;
  allLabel?: string;
  onAll?: (value: boolean) => void;
}) {
  return (
    <div className="chip-group" role="group" aria-label={title}>
      <span className="chip-title">{title}</span>
      <div className="chips">{children}</div>
      {onAll && (
        <label className="chip-all">
          <input type="checkbox" checked={all ?? false} onChange={(e) => onAll(e.target.checked)} />
          {allLabel}
        </label>
      )}
    </div>
  );
}

function Chip({
  on,
  onClick,
  title,
  tone,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  /** Farbe der Domäne (fury, calm …); ohne Angabe gilt die Farbe für ausgewählte Filter. */
  tone?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" className="chip" aria-pressed={on} title={title} data-tone={tone} onClick={onClick}>
      {children}
    </button>
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

/**
 * Eine Karte mit allen ihren Fassungen: „Normal: 2 | Foil: 0 | Promo: 1“ zählt die Karten im
 * Bestand je Art. Arten, die es von der Karte nicht gibt, fehlen. Das Bild zeigt die erste
 * Fassung, die zu den Filtern passt.
 */
function Tile({ index, group, stock }: { index: CatalogIndex; group: CardGroup; stock: Map<string, number> }) {
  const shown = group.matched[0]!;
  const imageId = printImageId(shown);
  const owned = ownedOf(group, stock);
  const kinds = kindSummary(countByKind(group.prints, stock));
  const versions = group.prints.reduce((n, p) => n + p.skus.length, 0);
  return (
    <a className={owned ? 'tile owned' : 'tile'} href={cardHref(group.cardId)}>
      <div className="art">
        {imageId ? (
          <img src={imageUrl(index.catalog, imageId, 'thumb')} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="noimg">kein Bild</span>
        )}
        {owned > 0 && <span className="badge">{owned}</span>}
      </div>
      <div className="tile-name">{group.card?.name ?? printName(index, shown)}</div>
      <div className="tile-kinds">
        {/* Der Trennstrich steht vor jedem Eintrag; am Zeilenanfang schneidet ihn die Kachel ab. */}
        <div>
          {kinds.map((k) => (
            <span key={k.kind} className={k.qty > 0 ? 'kind has' : 'kind'}>
              {k.label}: {k.qty}
            </span>
          ))}
        </div>
      </div>
      <div className="tile-meta">{versions === 1 ? '1 Fassung' : `${versions} Fassungen`}</div>
    </a>
  );
}
