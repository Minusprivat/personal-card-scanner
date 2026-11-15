# M3: Selbsttest der Erkennung mit verzerrten Katalogbildern

Erzeugt von `npm run scan:selftest`. 300 von 1804 Katalogbildern, Fingerabdruck-Version 1.

Dieser Test nutzt keine echten Fotos. Er verzerrt Katalogbilder künstlich und prüft, ob der Fingerabdruck sie unter allen 1804 Bildern wiederfindet. Das Finden und Entzerren der Karte im Kamerabild ist hier nicht enthalten.

| Verzerrung | richtiges Bild an erster Stelle | richtiges Motiv an erster Stelle | richtiges Bild unter den ersten drei | mittlerer Abstand (0–128) |
| --- | --- | --- | --- | --- |
| unverändert | 96,7 % | 99,7 % | 100,0 % | 0,0 |
| stark verkleinert (120 px breit) | 95,7 % | 99,7 % | 100,0 % | 0,5 |
| dunkel | 91,7 % | 99,7 % | 99,7 % | 3,8 |
| hell und flau | 96,0 % | 99,7 % | 99,7 % | 0,0 |
| unscharf | 94,0 % | 99,7 % | 99,7 % | 1,2 |
| Farbstich (warmes Licht) | 94,0 % | 99,7 % | 100,0 % | 1,9 |
| Rand zu groß (Karte kleiner im Ausschnitt) | 92,7 % | 99,7 % | 99,7 % | 2,6 |
| Rand abgeschnitten | 85,7 % | 98,0 % | 99,3 % | 17,3 |
| um 3° verdreht | 87,7 % | 100,0 % | 99,0 % | 14,9 |
| kopfüber | 96,7 % | 99,7 % | 100,0 % | 0,0 |
| Lichtspiegelung | 88,3 % | 100,0 % | 99,7 % | 19,5 |
| stark komprimiert | 95,0 % | 99,7 % | 99,7 % | 1,3 |
| alles zusammen (wie ein Handyfoto) | 79,7 % | 95,0 % | 97,7 % | 25,3 |

„Richtiges Motiv“ zählt auch Treffer auf einen anderen Druck derselben Karte mit gleichem Bild (zum Beispiel mit Promo-Stempel). Solche Drucke trennt später die Kartennummer.
