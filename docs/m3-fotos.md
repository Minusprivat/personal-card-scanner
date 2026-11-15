# M3: Erkennung auf echten Fotos

Erzeugt von `npm run scan:photos`. 41 Fotos aus `testdata/photos/`, Fingerabdruck-Version 1.

| Kennzahl | Ergebnis | Ziel |
| --- | --- | --- |
| Richtige Karte an erster Stelle | 92,7 % (38 von 41) | mindestens 95 % |
| Richtige Karte unter den ersten drei | 95,1 % (39 von 41) | mindestens 99 % |
| Richtige Fassung an erster Stelle | 90,2 % (37 von 41) | – |
| Von selbst gezählt, richtige Karte | 36 | – |
| Von selbst gezählt, falsche Karte | 0 | 0 |
| Auswahl angeboten (unsicher) | 5 | – |
| Nicht erkannt | 0 | – |
| Kartennummer gelesen und zugeordnet | 9 | – |
| Mittlere Dauer je Foto (Entwicklungs-PC) | 182 ms | unter 1 s auf dem Handy |

Ziele **nicht erreicht**. 1 Foto(s) zeigen eine Fassung, die der Katalog nicht führt; dort zählt nur die richtige Karte.

„Gezählt“ heißt: Die App hätte die Karte ohne Rückfrage in die Sitzung übernommen. „Auswahl angeboten“ heißt: Sie hätte Kandidaten zum Antippen gezeigt.

| Foto | Soll | Erkannt als | Ergebnis | Dauer |
| --- | --- | --- | --- | --- |
| 1 | RAD-065b/167-P-EN (nicht im Katalog) | OGN-197a/298 (Abstand 38, Vorsprung 4) | Auswahl angeboten, falsche Karte vorn | 417 ms |
| 2 | UNL-055/219 | UNL-055/219 (Abstand 18, Vorsprung 20) | gezählt, richtig | 160 ms |
| 3 | UNL-236/219 | UNL-236/219 (Abstand 36, Vorsprung 4, gelesen „3 UNL 236/219“) | Auswahl angeboten, richtige Karte vorn | 335 ms |
| 4 | SFD-070/221 | SFD-070/221 (Abstand 18, Vorsprung 16) | gezählt, richtig | 153 ms |
| 5 | VEN-089/166-EN | VEN-089/166-EN (Abstand 20, Vorsprung 20) | gezählt, richtig | 144 ms |
| 6 | SFD-177a/221 | SFD-177a/221 (Abstand 16, Vorsprung 22) | gezählt, richtig | 144 ms |
| 7 | VEN-089/166-EN | VEN-089/166-EN (Abstand 22, Vorsprung 18) | gezählt, richtig | 166 ms |
| 8 | RAD-131/167-EN | RAD-131/167-EN (Abstand 8, Vorsprung 32) | gezählt, richtig | 139 ms |
| 9 | RAD-018/167-EN | RAD-018/167-EN (Abstand 12, Vorsprung 28) | gezählt, richtig | 154 ms |
| 10 | VEN-017/166-P-EN | VEN-017/166-P-EN (Abstand 14, Vorsprung 22, gelesen „VEN 017/166 * P * EN“) | gezählt, richtig | 207 ms |
| 11 | VEN-097/166-P-EN | VEN-097/166-P-EN (Abstand 20, Vorsprung 12, gelesen „VEN 097/166 P EN“) | gezählt, richtig | 186 ms |
| 12 | VEN-026/166-P-EN | VEN-026/166-EN (Abstand 12, Vorsprung 20) | gezählt, richtige Karte, andere Fassung | 343 ms |
| 13 | UNL-042/219 | UNL-042/219 (Abstand 22, Vorsprung 10) | gezählt, richtig | 179 ms |
| 14 | SFD-057/221 | SFD-057/221 (Abstand 20, Vorsprung 24, gelesen „SED 057/221 /“) | gezählt, richtig | 209 ms |
| 15 | UNL-142/219 | UNL-142/219 (Abstand 26, Vorsprung 16) | gezählt, richtig | 173 ms |
| 16 | OGN-091/298 | OGN-091/298 (Abstand 14, Vorsprung 26) | gezählt, richtig | 141 ms |
| 17 | VEN-106/166-EN | VEN-106/166-EN (Abstand 20, Vorsprung 18) | gezählt, richtig | 163 ms |
| 18 | VEN-R06b-EN-P | VEN-R06b-EN-P (Abstand 32, Vorsprung 6, gelesen „VEN  RO6b * EN  P“) | gezählt, richtig | 191 ms |
| 19 | UNL-R06a | UNL-R06a (Abstand 16, Vorsprung 26, gelesen „UNL * R062 2“) | gezählt, richtig | 166 ms |
| 20 | OGN-156/298 | OGN-156/298 (Abstand 16, Vorsprung 24) | gezählt, richtig | 151 ms |
| 21 | UNL-201/219 | UNL-201/219 (Abstand 26, Vorsprung 18, gelesen „UNL 201/219“) | gezählt, richtig | 249 ms |
| 22 | RAD-155/167-EN | RAD-155/167-EN (Abstand 12, Vorsprung 30, gelesen „RAD * 155/167 * a“) | gezählt, richtig | 155 ms |
| 23 | VEN-114/166-EN | VEN-114/166-EN (Abstand 12, Vorsprung 28) | gezählt, richtig | 128 ms |
| 24 | UNL-052/219 | UNL-052/219 (Abstand 16, Vorsprung 24) | gezählt, richtig | 162 ms |
| 25 | OGN-131/298 | OGN-131/298 (Abstand 6, Vorsprung 30) | gezählt, richtig | 165 ms |
| 26 | UNL-200/219 | UNL-200/219 (Abstand 8, Vorsprung 34) | gezählt, richtig | 163 ms |
| 27 | OGN-213/298 | OGN-213/298 (Abstand 22, Vorsprung 14) | gezählt, richtig | 168 ms |
| 28 | OGN-096/298 | OGN-096/298 (Abstand 28, Vorsprung 6) | Auswahl angeboten, richtige Karte vorn | 271 ms |
| 29 | SFD-080/221 | SFD-080/221 (Abstand 22, Vorsprung 18) | gezählt, richtig | 141 ms |
| 30 | UNL-080/219 | UNL-080/219 (Abstand 24, Vorsprung 14) | gezählt, richtig | 150 ms |
| 31 | VEN-049/166-EN | VEN-049/166-EN (Abstand 16, Vorsprung 16) | gezählt, richtig | 172 ms |
| 32 | OGN-095/298 | OGN-095/298 (Abstand 22, Vorsprung 18) | gezählt, richtig | 142 ms |
| 33 | UNL-063/219 | UNL-063/219 (Abstand 28, Vorsprung 10) | gezählt, richtig | 152 ms |
| 34 | UNL-153/219 | RAD-038/167-EN (Abstand 36, Vorsprung 6) | Auswahl angeboten, falsche Karte vorn | 252 ms |
| 35 | VEN-049/166-EN | OGN-215/298 (Abstand 32, Vorsprung 4) | Auswahl angeboten, falsche Karte vorn | 225 ms |
| 36 | UNL-080/219 | UNL-080/219 (Abstand 22, Vorsprung 16) | gezählt, richtig | 117 ms |
| 37 | UNL-082/219 | UNL-082/219 (Abstand 14, Vorsprung 22) | gezählt, richtig | 149 ms |
| 38 | RAD-064/167-EN | RAD-064/167-EN (Abstand 10, Vorsprung 26) | gezählt, richtig | 132 ms |
| 39 | RAD-063/167-EN | RAD-063/167-EN (Abstand 8, Vorsprung 32, gelesen „RAD 063/167 BL“) | gezählt, richtig | 184 ms |
| 40 | RAD-089/167-EN | RAD-089/167-EN (Abstand 26, Vorsprung 10) | gezählt, richtig | 125 ms |
| 41 | RAD-051/167-EN | RAD-051/167-EN (Abstand 28, Vorsprung 12) | gezählt, richtig | 156 ms |
