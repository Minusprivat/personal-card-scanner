# M3: Szenentest der ganzen Erkennungskette

Erzeugt von `npm run scan:scenes`. 200 Katalogbilder je Untergrund, Fingerabdruck-Version 1.

Jedes Bild wird gedreht (bis ±35°), perspektivisch verzerrt und auf einen Untergrund gelegt. Danach läuft die ganze Kette: Karte finden, entzerren, Fingerabdruck, Abgleich mit allen 1804 Katalogbildern. Die Szenen sind künstlich: ohne Schatten, Hülle, Spiegelung und Finger. Echte Fotos fallen schlechter aus.

Alle Anteile beziehen sich auf alle Szenen. „Umriss genau“ heißt: Alle vier Ecken liegen höchstens 5 % der Kartenlänge daneben. Eine Karte kann auch bei ungenauem Umriss richtig erkannt werden.

| Untergrund | richtiges Motiv an erster Stelle | richtiges Motiv unter den ersten drei | Umriss genau |
| --- | --- | --- | --- |
| dunkles Holz | 95,5 % | 95,5 % | 96,0 % |
| grauer Tisch | 95,0 % | 95,0 % | 99,0 % |
| weißer Tisch | 95,5 % | 95,5 % | 99,0 % |
| schwarze Spielmatte | 90,5 % | 92,0 % | 86,5 % |
| grüne Spielmatte | 94,5 % | 94,5 % | 95,0 % |

Mittlere Dauer je Bild auf dem Entwicklungs-PC: 45 ms (ohne Laden von OpenCV). Auf dem Handy ist erst nach einem Test dort eine Aussage möglich.
