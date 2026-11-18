import { Browser } from '@capacitor/browser';
import type { MouseEvent } from 'react';
import { isNativeApp } from './save';

/**
 * Öffnet eine fremde Seite, ohne die App zu verlassen.
 *
 * Android-App: als Browser-Fenster über der App (Chrome Custom Tab). Das Fenster gehört zu
 * Chrome und teilt dessen Anmeldungen; die App selbst sieht weder Seite noch Passwort.
 * „Zurück“ führt wieder in die App. Web-App: in einem neuen Tab.
 *
 * `Browser` wird wie jeder Capacitor-Baustein nur direkt aufgerufen, nie aus einer
 * async-Funktion zurückgegeben (siehe updater.ts).
 */
export function openPage(url: string): void {
  if (!isNativeApp()) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  // Ältere APKs kennen den Baustein noch nicht; dann übernimmt der normale Browser.
  void Browser.open({ url, toolbarColor: '#0a1420' }).catch(() => window.open(url, '_blank', 'noopener'));
}

/**
 * Für gewöhnliche Links (`<a href target="_blank">`): In der Android-App öffnet der Klick das
 * Browser-Fenster über der App, im Browser bleibt es beim normalen Link.
 */
export const inAppLink = (url: string) => (event: MouseEvent) => {
  if (!isNativeApp()) return;
  event.preventDefault();
  openPage(url);
};
