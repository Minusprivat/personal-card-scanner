# M3: Szenentest der ganzen Erkennungskette

Erzeugt von `npm run scan:scenes`. 200 Katalogbilder je Untergrund, Fingerabdruck-Version 1.

Jedes Bild wird gedreht (bis ±35°), perspektivisch verzerrt und auf einen Untergrund gelegt. Danach läuft die ganze Kette: Karte finden, entzerren, Fingerabdruck, Abgleich mit allen 1804 Katalogbildern. Die Szenen sind künstlich: ohne Schatten, Hülle, Spiegelung und Finger. Echte Fotos fallen schlechter aus.

Alle Anteile beziehen sich auf alle Szenen. „Umriss genau“ heißt: Alle vier Ecken liegen höchstens 5 % der Kartenlänge daneben. Eine Karte kann auch bei ungenauem Umriss richtig erkannt werden.

| Untergrund | richtiges Motiv an erster Stelle | richtiges Motiv unter den ersten drei | Umriss genau |
| --- | --- | --- | --- |
| dunkles Holz | 95,5 % | 95,5 % | 87,0 % |
| grauer Tisch | 95,0 % | 95,0 % | 95,0 % |
| weißer Tisch | 95,5 % | 95,5 % | 91,5 % |
| schwarze Spielmatte | 95,0 % | 95,5 % | 79,0 % |
| grüne Spielmatte | 95,5 % | 95,5 % | 88,5 % |

Mittlere Dauer je Bild auf dem Entwicklungs-PC: 77 ms (ohne Laden von OpenCV). Auf dem Handy ist erst nach einem Test dort eine Aussage möglich.
