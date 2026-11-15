# M3: Lesen der Kartennummer

Erzeugt von `npm run scan:numbers`. 60 Katalogbilder in voller Größe, verkleinert auf die angegebene Kartenhöhe; jede zweite Karte steht kopf.

Gelesen wird nur die Nummernzeile. Der Text wird unscharf mit den Nummern aller Drucke derselben Karte verglichen (bis zu zwei Zeichenfehler). „Falsch“ heißt: einem anderen Druck zugeordnet. „Nicht lesbar“ heißt: keine eindeutige Zuordnung; der Scanner fällt dann auf den Bildabgleich zurück.

| Kartenhöhe im Bild | richtig zugeordnet | falsch zugeordnet | nicht lesbar |
| --- | --- | --- | --- |
| 800 px | 86,7 % | 1,7 % | 11,7 % |
| 600 px | 91,7 % | 0,0 % | 8,3 % |
| 480 px | 85,0 % | 3,3 % | 11,7 % |
| 400 px | 61,7 % | 1,7 % | 36,7 % |

Der Test nutzt saubere Katalogbilder. Echte Fotos mit Unschärfe, Spiegelung oder Hülle fallen schlechter aus. Das Sternchen signierter Karten liest die Texterkennung nicht; signierte und unsignierte Fassungen trennt sie deshalb nicht.

## Nicht richtig zugeordnet bei 600 px

| Erwartet | Gelesen | Zugeordnet |
| --- | --- | --- |
| OGN-261/298 | AON T/29 3 | keine Zuordnung |
| RAD-174/167-EN | (nichts) | keine Zuordnung |
| RAD-014/167-P-EN | BAD 087147 EN | keine Zuordnung |
| OGN-259/298 | Oa | keine Zuordnung |
| SFD-230*/221 | Z0 4 | keine Zuordnung |
