# M3: Erkennung auf echten Fotos

Erzeugt von `npm run scan:photos`. 43 Fotos aus `testdata/photos/`, Fingerabdruck-Version 1.

| Kennzahl | Ergebnis | Ziel |
| --- | --- | --- |
| Richtige Karte an erster Stelle | 93,0 % (40 von 43) | mindestens 95 % |
| Richtige Karte unter den ersten drei | 95,3 % (41 von 43) | mindestens 99 % |
| Richtige Fassung an erster Stelle | 90,7 % (39 von 43) | – |
| Von selbst gezählt, richtige Karte | 38 | – |
| Von selbst gezählt, falsche Karte | 0 | 0 |
| Auswahl angeboten (unsicher) | 5 | – |
| Nicht erkannt | 0 | – |
| Kartennummer gelesen und zugeordnet | 11 | – |
| Mittlere Dauer je Foto (Entwicklungs-PC) | 186 ms | unter 1 s auf dem Handy |

Ziele **nicht erreicht**. 1 Foto(s) zeigen eine Fassung, die der Katalog nicht führt; dort zählt nur die richtige Karte.

„Gezählt“ heißt: Die App hätte die Karte ohne Rückfrage in die Sitzung übernommen. „Auswahl angeboten“ heißt: Sie hätte Kandidaten zum Antippen gezeigt.

| Foto | Soll | Erkannt als | Ergebnis | Dauer |
| --- | --- | --- | --- | --- |
| 1 | RAD-065b/167-P-EN (nicht im Katalog) | OGN-197a/298 (Abstand 38, Vorsprung 4) | Auswahl angeboten, falsche Karte vorn | 423 ms |
| 2 | UNL-055/219 | UNL-055/219 (Abstand 18, Vorsprung 20) | gezählt, richtig | 171 ms |
| 3 | UNL-236/219 | UNL-236/219 (Abstand 36, Vorsprung 4, gelesen „3 UNL 236/219“) | Auswahl angeboten, richtige Karte vorn | 330 ms |
| 4 | SFD-070/221 | SFD-070/221 (Abstand 18, Vorsprung 16) | gezählt, richtig | 148 ms |
| 5 | VEN-089/166-EN | VEN-089/166-EN (Abstand 20, Vorsprung 20) | gezählt, richtig | 140 ms |
| 6 | SFD-177a/221 | SFD-177a/221 (Abstand 16, Vorsprung 22) | gezählt, richtig | 145 ms |
| 7 | VEN-089/166-EN | VEN-089/166-EN (Abstand 22, Vorsprung 18) | gezählt, richtig | 172 ms |
| 8 | RAD-131/167-EN | RAD-131/167-EN (Abstand 8, Vorsprung 32) | gezählt, richtig | 140 ms |
| 9 | RAD-018/167-EN | RAD-018/167-EN (Abstand 12, Vorsprung 28) | gezählt, richtig | 161 ms |
| 10 | VEN-017/166-P-EN | VEN-017/166-P-EN (Abstand 14, Vorsprung 22, gelesen „VEN 017/166 * P * EN“) | gezählt, richtig | 213 ms |
| 11 | VEN-097/166-P-EN | VEN-097/166-P-EN (Abstand 20, Vorsprung 12, gelesen „VEN 097/166 P EN“) | gezählt, richtig | 199 ms |
| 12 | VEN-026/166-P-EN | VEN-026/166-EN (Abstand 12, Vorsprung 20) | gezählt, richtige Karte, andere Fassung | 347 ms |
| 13 | UNL-042/219 | UNL-042/219 (Abstand 22, Vorsprung 10) | gezählt, richtig | 192 ms |
| 14 | SFD-057/221 | SFD-057/221 (Abstand 20, Vorsprung 24, gelesen „SED 057/221 /“) | gezählt, richtig | 217 ms |
| 15 | UNL-142/219 | UNL-142/219 (Abstand 26, Vorsprung 16) | gezählt, richtig | 180 ms |
| 16 | OGN-091/298 | OGN-091/298 (Abstand 14, Vorsprung 26) | gezählt, richtig | 147 ms |
| 17 | VEN-106/166-EN | VEN-106/166-EN (Abstand 20, Vorsprung 18) | gezählt, richtig | 169 ms |
| 18 | VEN-R06b-EN-P | VEN-R06b-EN-P (Abstand 32, Vorsprung 6, gelesen „VEN  RO6b * EN  P“) | gezählt, richtig | 206 ms |
| 19 | UNL-R06a | UNL-R06a (Abstand 16, Vorsprung 26, gelesen „UNL * R062 2“) | gezählt, richtig | 174 ms |
| 20 | OGN-156/298 | OGN-156/298 (Abstand 16, Vorsprung 24) | gezählt, richtig | 153 ms |
| 21 | UNL-201/219 | UNL-201/219 (Abstand 26, Vorsprung 18, gelesen „UNL 201/219“) | gezählt, richtig | 258 ms |
| 22 | RAD-155/167-EN | RAD-155/167-EN (Abstand 12, Vorsprung 30, gelesen „RAD * 155/167 * a“) | gezählt, richtig | 159 ms |
| 23 | VEN-114/166-EN | VEN-114/166-EN (Abstand 12, Vorsprung 28) | gezählt, richtig | 140 ms |
| 24 | UNL-052/219 | UNL-052/219 (Abstand 16, Vorsprung 24) | gezählt, richtig | 190 ms |
| 25 | OGN-131/298 | OGN-131/298 (Abstand 6, Vorsprung 30) | gezählt, richtig | 172 ms |
| 26 | UNL-200/219 | UNL-200/219 (Abstand 8, Vorsprung 34) | gezählt, richtig | 167 ms |
| 27 | OGN-213/298 | OGN-213/298 (Abstand 22, Vorsprung 14) | gezählt, richtig | 179 ms |
| 28 | OGN-096/298 | OGN-096/298 (Abstand 28, Vorsprung 6) | Auswahl angeboten, richtige Karte vorn | 285 ms |
| 29 | SFD-080/221 | SFD-080/221 (Abstand 22, Vorsprung 18) | gezählt, richtig | 147 ms |
| 30 | UNL-080/219 | UNL-080/219 (Abstand 24, Vorsprung 14) | gezählt, richtig | 161 ms |
| 31 | VEN-049/166-EN | VEN-049/166-EN (Abstand 16, Vorsprung 16) | gezählt, richtig | 181 ms |
| 32 | OGN-095/298 | OGN-095/298 (Abstand 22, Vorsprung 18) | gezählt, richtig | 147 ms |
| 33 | UNL-063/219 | UNL-063/219 (Abstand 28, Vorsprung 10) | gezählt, richtig | 161 ms |
| 34 | UNL-153/219 | RAD-038/167-EN (Abstand 36, Vorsprung 6) | Auswahl angeboten, falsche Karte vorn | 264 ms |
| 35 | VEN-049/166-EN | OGN-215/298 (Abstand 32, Vorsprung 4) | Auswahl angeboten, falsche Karte vorn | 232 ms |
| 36 | UNL-080/219 | UNL-080/219 (Abstand 22, Vorsprung 16) | gezählt, richtig | 119 ms |
| 37 | UNL-082/219 | UNL-082/219 (Abstand 14, Vorsprung 22) | gezählt, richtig | 156 ms |
| 38 | RAD-064/167-EN | RAD-064/167-EN (Abstand 10, Vorsprung 26) | gezählt, richtig | 133 ms |
| 39 | RAD-063/167-EN | RAD-063/167-EN (Abstand 8, Vorsprung 32, gelesen „RAD 063/167 BL“) | gezählt, richtig | 193 ms |
| 40 | RAD-089/167-EN | RAD-089/167-EN (Abstand 26, Vorsprung 10) | gezählt, richtig | 132 ms |
| 41 | RAD-051/167-EN | RAD-051/167-EN (Abstand 28, Vorsprung 12) | gezählt, richtig | 158 ms |
| 42 | RAD-130/167-EN | RAD-130/167-EN (Abstand 14, Vorsprung 24, gelesen „RAD 130/167 * EN“) | gezählt, richtig | 119 ms |
| 43 | RAD-063/167-EN | RAD-063/167-EN (Abstand 16, Vorsprung 26, gelesen „RAD 063/167 * EN“) | gezählt, richtig | 129 ms |
