/**
 * Datenmodell der App, unabhängig von der Katalogquelle.
 *
 * Begriffe:
 * - Card  = die Spielkarte, unabhängig von der Fassung.
 * - Print = ein „Druck“ im Sinn der SPEC: eine physische Fassung (Set, Nummer, Variante, Stempel).
 * - Sku   = Druck + Finish. Das ist die kleinste zählbare Einheit; Bestand und Preis hängen hieran.
 */

export const FINISHES = ['normal', 'foil', 'metal', 'metal-deluxe'] as const;
export type Finish = (typeof FINISHES)[number];

export const FINISH_LABELS: Record<Finish, string> = {
  normal: 'Normal',
  foil: 'Foil',
  metal: 'Metal',
  'metal-deluxe': 'Metal Deluxe',
};

export type SetType = 'main' | 'supplemental';

export interface CardSet {
  id: string;
  /** Set-Kürzel, z. B. "OGN". */
  code: string;
  name: string;
  type: SetType;
  /** Erscheinungsdatum der englischen Ausgabe, falls bekannt (ISO-Datum). */
  releasedAt: string | null;
}

export interface Card {
  id: string;
  slug: string;
  name: string;
  types: string[];
  superTypes: string[];
  /** „Farben“ der Karte (fury, calm, mind, body, chaos, order, neutral, colorless). */
  domains: string[];
  energy: number | null;
  might: number | null;
  power: number | null;
  keywords: string[];
  tags: string[];
  /**
   * Regeltext der Karte in Klartext, Zeilen durch "\n" getrennt; so, wie er auf dem ersten
   * Druck steht (samt Erklärungen in Klammern). Fehlt bei Karten ohne Text und in älteren
   * Katalogständen, die die App noch gespeichert hat.
   */
  text?: string;
}

export interface Sku {
  /** Stabile Kennung aus der Katalogquelle. */
  id: string;
  cardId: string;
  setId: string;
  /** Kurze Nummer, z. B. "OGN-142". */
  shortCode: string;
  /** Aufgedruckte Nummer, z. B. "OGN-142/298". */
  publicCode: string;
  printedName: string;
  rarity: string;
  /** normal | altart | ultimate */
  artVariant: string;
  isSigned: boolean;
  isOvernumbered: boolean;
  /** Stempel auf der Karte, z. B. promo, judge, summoner. */
  markers: string[];
  /** standard | oversized */
  size: string;
  finish: Finish;
  language: string;
  imageId: string | null;
  /** Vertriebswege (Slugs); nur zur Unterscheidung sonst gleicher Drucke. */
  channels: string[];
  comment: string | null;
  /** Sortierrang der Quelle. */
  rank: number;
}

export interface Print {
  /** Lesbarer Schlüssel; nur innerhalb eines Katalogstands stabil. Bestand hängt an der Sku-Id. */
  key: string;
  cardId: string;
  setId: string;
  /** Alle Finishes dieses Drucks, sortiert nach FINISHES. */
  skus: Sku[];
}

/** Wo die Kartenbilder liegen. `{id}` und `{size}` werden ersetzt. */
export interface ImageSource {
  template: string;
  /** Größenkürzel der Quelle für Raster, Detailansicht und Vollbild. */
  thumb: string;
  detail: string;
  full: string;
}

export interface Catalog {
  source: string;
  fetchedAt: string;
  images: ImageSource;
  sets: CardSet[];
  cards: Card[];
  skus: Sku[];
  /**
   * Herkunft von Promos und Sonderausgaben: Kürzel des Vertriebswegs (`Sku.channels`) →
   * lesbarer Name, z. B. "Nexus Night › Origins" oder "Worlds 2026 Bundle". Fehlt in älteren
   * Katalogständen, die die App noch gespeichert hat.
   */
  channels?: Record<string, string>;
  /** Stempel: Kürzel (`Sku.markers`) → Name, z. B. "summoner" → "Summoner Circle". */
  markerLabels?: Record<string, string>;
}

/** Verknüpfung einer Sku mit einem Cardmarket-Produkt. */
export interface CardmarketLink {
  productId: number;
  url: string;
}

/** Eine Zeile der Cardmarket-Preisdatei, Beträge in Euro. */
export interface PriceGuideRow {
  productId: number;
  low: number | null;
  trend: number | null;
  avg: number | null;
  avg30: number | null;
  lowFoil: number | null;
  trendFoil: number | null;
  avgFoil: number | null;
  avg30Foil: number | null;
}

export interface PriceGuide {
  createdAt: string;
  rows: Map<number, PriceGuideRow>;
}

/** Schnittstelle, hinter der die Katalogquelle austauschbar bleibt (z. B. später Riot-API). */
export interface CatalogSource {
  readonly name: string;
  loadCatalog(): Promise<Catalog>;
  /** Sku-Id → Cardmarket-Produkt. Skus ohne Produkt fehlen in der Map. */
  loadCardmarketLinks(): Promise<Map<string, CardmarketLink>>;
}
