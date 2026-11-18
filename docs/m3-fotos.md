# M3: Erkennung auf echten Fotos

Erzeugt von `npm run scan:photos`. 85 Fotos aus `testdata/photos/`, Fingerabdruck-Version 1.

| Kennzahl | Ergebnis | Ziel |
| --- | --- | --- |
| Richtige Karte an erster Stelle | 92,9 % (79 von 85) | mindestens 95 % |
| Richtige Karte unter den ersten drei | 94,1 % (80 von 85) | mindestens 99 % |
| Richtige Fassung an erster Stelle | 91,8 % (78 von 85) | – |
| Von selbst gezählt, richtige Karte | 78 | – |
| Von selbst gezählt, falsche Karte | 0 | 0 |
| Auswahl angeboten (unsicher) | 7 | – |
| Nicht erkannt | 0 | – |
| Kartennummer gelesen und zugeordnet | 26 | – |
| Mittlere Dauer je Foto (Entwicklungs-PC) | 204 ms | unter 1 s auf dem Handy |

Ziele **nicht erreicht**. 3 Foto(s) zeigen eine Fassung, die der Katalog nicht führt; dort zählt nur die richtige Karte.

„Gezählt“ heißt: Die App hätte die Karte ohne Rückfrage in die Sitzung übernommen. „Auswahl angeboten“ heißt: Sie hätte Kandidaten zum Antippen gezeigt.

| Foto | Soll | Erkannt als | Ergebnis | Dauer |
| --- | --- | --- | --- | --- |
| 1 | VEN-193*/166-EN | VEN-193/166-EN (Abstand 22, Vorsprung 20) | gezählt, richtige Karte, andere Fassung | 424 ms |
| 2 | SFD-245/221 | SFD-245/221 (Abstand 22, Vorsprung 20, gelesen „SFD 245/221“) | gezählt, richtig | 168 ms |
| 3 | SFD-245/221 | SFD-245/221 (Abstand 22, Vorsprung 18) | gezählt, richtig | 381 ms |
| 4 | OGN-308/298 | OGN-308/298 (Abstand 10, Vorsprung 32, gelesen „OGN 308/298“) | gezählt, richtig | 323 ms |
| 5 | VEN-002/166-EN | VEN-002/166-EN (Abstand 10, Vorsprung 32, gelesen „VEN 002/166 EN“) | gezählt, richtig | 218 ms |
| 6 | SFD-245/221 | SFD-245/221 (Abstand 18, Vorsprung 20, gelesen „SF 245/221“) | gezählt, richtig | 226 ms |
| 7 | SFD-245/221 | SFD-245/221 (Abstand 22, Vorsprung 18) | gezählt, richtig | 310 ms |
| 8 | SFD-245/221 | SFD-245/221 (Abstand 26, Vorsprung 14, gelesen „SFD 245/221“) | gezählt, richtig | 173 ms |
| 9 | SFD-079/221 | SFD-079/221 (Abstand 24, Vorsprung 14, gelesen „SFD 079/221“) | gezählt, richtig | 252 ms |
| 10 | VEN-002/166-EN | VEN-002/166-EN (Abstand 20, Vorsprung 18, gelesen „LV 002/166 * EN“) | gezählt, richtig | 274 ms |
| 11 | SFD-079/221 | SFD-079/221 (Abstand 18, Vorsprung 20, gelesen „LED * 079/221“) | gezählt, richtig | 155 ms |
| 12 | SFD-079/221 | SFD-079/221 (Abstand 18, Vorsprung 22) | gezählt, richtig | 261 ms |
| 13 | UNL-169/219 | UNL-169/219 (Abstand 16, Vorsprung 20) | gezählt, richtig | 302 ms |
| 14 | UNL-169/219 | UNL-169/219 (Abstand 18, Vorsprung 20, gelesen „UNL 169/219“) | gezählt, richtig | 164 ms |
| 15 | UNL-169/219-P | UNL-169/219-P (Abstand 24, Vorsprung 18) | gezählt, richtig | 293 ms |
| 16 | UNL-001/219 | UNL-001/219 (Abstand 20, Vorsprung 16, gelesen „UNL 001/219“) | gezählt, richtig | 143 ms |
| 17 | SFD-049/221 | SFD-049/221 (Abstand 10, Vorsprung 30) | gezählt, richtig | 289 ms |
| 18 | UNL-169/219-P | UNL-169/219-P (Abstand 16, Vorsprung 24, gelesen „INL 169/219  P“) | gezählt, richtig | 162 ms |
| 19 | UNL-001/219 | UNL-001/219 (Abstand 12, Vorsprung 26, gelesen „UNL 001/219“) | gezählt, richtig | 139 ms |
| 20 | SFD-049/221 | SFD-049/221 (Abstand 14, Vorsprung 26, gelesen „SFD 049/221“) | gezählt, richtig | 145 ms |
| 21 | SFD-049/221 | SFD-049/221 (Abstand 16, Vorsprung 26, gelesen „E 56D 049/221 a“) | gezählt, richtig | 229 ms |
| 22 | SFD-169/221 | OGN-114/298 (Abstand 36, Vorsprung 8) | Auswahl angeboten, falsche Karte vorn | 298 ms |
| 23 | UNL-169/219 | UNL-169/219 (Abstand 16, Vorsprung 24) | gezählt, richtig | 296 ms |
| 24 | VEN-084/166-EN | VEN-084/166-EN (Abstand 10, Vorsprung 26) | gezählt, richtig | 303 ms |
| 25 | OGS-010/024 | OGS-010/024 (Abstand 30, Vorsprung 10) | gezählt, richtig | 119 ms |
| 26 | VEN-137/166-EN | VEN-137/166-EN (Abstand 14, Vorsprung 26) | gezählt, richtig | 126 ms |
| 27 | VEN-148/166-EN | VEN-148/166-EN (Abstand 20, Vorsprung 20) | gezählt, richtig | 86 ms |
| 28 | RAD-065b/167-P-EN (nicht im Katalog) | VEN-109/166-EN (Abstand 34, Vorsprung 6) | Auswahl angeboten, falsche Karte vorn | 333 ms |
| 29 | RAD-092/167-EN | RAD-092/167-EN (Abstand 16, Vorsprung 28) | gezählt, richtig | 122 ms |
| 30 | RAD-177/167-EN | RAD-177/167-EN (Abstand 22, Vorsprung 20) | gezählt, richtig | 501 ms |
| 31 | VEN-084/166-EN | VEN-084/166-EN (Abstand 20, Vorsprung 14, gelesen „VEN 084/165 EN“) | gezählt, richtig | 245 ms |
| 32 | OGS-010/024 | OGS-010/024 (Abstand 30, Vorsprung 10) | gezählt, richtig | 127 ms |
| 33 | SFD-177a/221 | SFD-177a/221 (Abstand 16, Vorsprung 22) | gezählt, richtig | 133 ms |
| 34 | VEN-089/166-EN | VEN-089/166-EN (Abstand 24, Vorsprung 16) | gezählt, richtig | 170 ms |
| 35 | RAD-131/167-EN | RAD-131/167-EN (Abstand 10, Vorsprung 32) | gezählt, richtig | 131 ms |
| 36 | RAD-018/167-EN | RAD-018/167-EN (Abstand 12, Vorsprung 28) | gezählt, richtig | 139 ms |
| 37 | VEN-017/166-P-EN | VEN-017/166-P-EN (Abstand 16, Vorsprung 20, gelesen „VEN * 017/166 * P EN“) | gezählt, richtig | 178 ms |
| 38 | VEN-097/166-P-EN | VEN-097/166-P-EN (Abstand 16, Vorsprung 18, gelesen „VEN 097/166  P EN“) | gezählt, richtig | 173 ms |
| 39 | VEN-026/166-P-EN | VEN-026/166-P-EN (Abstand 10, Vorsprung 24, gelesen „VEN * 026/166  P EN“) | gezählt, richtig | 230 ms |
| 40 | UNL-042/219 | UNL-042/219 (Abstand 22, Vorsprung 10) | gezählt, richtig | 166 ms |
| 41 | SFD-057/221 | SFD-057/221 (Abstand 14, Vorsprung 26, gelesen „SFD 057/221“) | gezählt, richtig | 197 ms |
| 42 | UNL-142/219 | UNL-142/219 (Abstand 22, Vorsprung 20) | gezählt, richtig | 195 ms |
| 43 | RAD-179/167-EN | RAD-179/167-EN (Abstand 30, Vorsprung 14) | gezählt, richtig | 288 ms |
| 44 | OGN-091/298 | OGN-091/298 (Abstand 14, Vorsprung 26) | gezählt, richtig | 134 ms |
| 45 | VEN-106/166-EN | VEN-106/166-EN (Abstand 22, Vorsprung 18) | gezählt, richtig | 151 ms |
| 46 | VEN-R06b-EN-P | VEN-R06b-EN-P (Abstand 30, Vorsprung 10, gelesen „VEN  R0O6b * EN  P a“) | gezählt, richtig | 264 ms |
| 47 | UNL-R06a | UNL-R06a (Abstand 14, Vorsprung 26, gelesen „UNL * R062 J“) | gezählt, richtig | 151 ms |
| 48 | OGN-156/298 | OGN-156/298 (Abstand 16, Vorsprung 24) | gezählt, richtig | 133 ms |
| 49 | UNL-201/219 | UNL-201/219 (Abstand 24, Vorsprung 20) | gezählt, richtig | 291 ms |
| 50 | RAD-065b/167-P-EN (nicht im Katalog) | VEN-086/166-P-EN (Abstand 36, Vorsprung 6) | Auswahl angeboten, falsche Karte vorn | 345 ms |
| 51 | UNL-055/219 | UNL-055/219 (Abstand 14, Vorsprung 20) | gezählt, richtig | 142 ms |
| 52 | UNL-236/219 | UNL-236/219 (Abstand 20, Vorsprung 22) | gezählt, richtig | 392 ms |
| 53 | SFD-070/221 | SFD-070/221 (Abstand 14, Vorsprung 20) | gezählt, richtig | 142 ms |
| 54 | VEN-089/166-EN | VEN-089/166-EN (Abstand 12, Vorsprung 26) | gezählt, richtig | 141 ms |
| 55 | RAD-130/167-EN | RAD-130/167-EN (Abstand 14, Vorsprung 24, gelesen „RAD 130/167 EN“) | gezählt, richtig | 171 ms |
| 56 | RAD-063/167-EN | RAD-063/167-EN (Abstand 16, Vorsprung 26, gelesen „RAD 063/167 * EN“) | gezählt, richtig | 184 ms |
| 57 | KDA-001*/005-EN | RAD-030/167-EN (Abstand 36, Vorsprung 0) | Auswahl angeboten, falsche Karte vorn | 197 ms |
| 58 | VEN-114/166-EN | VEN-114/166-EN (Abstand 12, Vorsprung 28) | gezählt, richtig | 151 ms |
| 59 | OGN-095/298 | OGN-095/298 (Abstand 22, Vorsprung 18) | gezählt, richtig | 134 ms |
| 60 | UNL-063/219 | UNL-063/219 (Abstand 26, Vorsprung 12) | gezählt, richtig | 183 ms |
| 61 | UNL-052/219 | UNL-052/219 (Abstand 16, Vorsprung 24) | gezählt, richtig | 142 ms |
| 62 | OGN-131/298 | OGN-131/298 (Abstand 6, Vorsprung 30) | gezählt, richtig | 153 ms |
| 63 | UNL-200/219 | UNL-200/219 (Abstand 8, Vorsprung 32) | gezählt, richtig | 156 ms |
| 64 | OGN-213/298 | OGN-213/298 (Abstand 20, Vorsprung 16) | gezählt, richtig | 185 ms |
| 65 | OGN-096/298 | OGN-096/298 (Abstand 20, Vorsprung 14) | gezählt, richtig | 109 ms |
| 66 | SFD-080/221 | SFD-080/221 (Abstand 24, Vorsprung 16) | gezählt, richtig | 117 ms |
| 67 | UNL-080/219 | UNL-080/219 (Abstand 22, Vorsprung 14) | gezählt, richtig | 143 ms |
| 68 | VEN-049/166-EN | VEN-049/166-EN (Abstand 18, Vorsprung 16) | gezählt, richtig | 143 ms |
| 69 | RAD-155/167-EN | RAD-155/167-EN (Abstand 12, Vorsprung 28, gelesen „RAD * 155/167 * B“) | gezählt, richtig | 176 ms |
| 70 | VEN-049/166-EN | VEN-049/166-EN (Abstand 28, Vorsprung 8) | gezählt, richtig | 153 ms |
| 71 | VEN-092/166-EN | VEN-092/166-EN (Abstand 16, Vorsprung 24, gelesen „VEN 092/166 * EN“) | gezählt, richtig | 311 ms |
| 72 | VEN-R06b-EN-P | VEN-R06b-EN-P (Abstand 30, Vorsprung 10) | gezählt, richtig | 355 ms |
| 73 | SFD-234/221 | SFD-234/221 (Abstand 34, Vorsprung 6, gelesen „Y SFD 234/221“) | Auswahl angeboten, richtige Karte vorn | 269 ms |
| 74 | RAD-092/167-EN | RAD-092/167-EN (Abstand 14, Vorsprung 26) | gezählt, richtig | 93 ms |
| 75 | RAD-065b/167-P-EN (nicht im Katalog) | UNL-160/219 (Abstand 36, Vorsprung 4) | Auswahl angeboten, falsche Karte vorn | 305 ms |
| 76 | VEN-148/166-EN | VEN-148/166-EN (Abstand 20, Vorsprung 20) | gezählt, richtig | 78 ms |
| 77 | UNL-080/219 | UNL-080/219 (Abstand 18, Vorsprung 20) | gezählt, richtig | 145 ms |
| 78 | UNL-082/219 | UNL-082/219 (Abstand 12, Vorsprung 26) | gezählt, richtig | 126 ms |
| 79 | RAD-064/167-EN | RAD-064/167-EN (Abstand 12, Vorsprung 24) | gezählt, richtig | 126 ms |
| 80 | RAD-063/167-EN | RAD-063/167-EN (Abstand 6, Vorsprung 34) | gezählt, richtig | 332 ms |
| 81 | RAD-089/167-EN | RAD-089/167-EN (Abstand 20, Vorsprung 20) | gezählt, richtig | 133 ms |
| 82 | RAD-051/167-EN | RAD-051/167-EN (Abstand 24, Vorsprung 8) | gezählt, richtig | 183 ms |
| 83 | RAD-091a/167-EN | RAD-091a/167-EN (Abstand 28, Vorsprung 10) | gezählt, richtig | 140 ms |
| 84 | RAD-137/167-EN | RAD-137/167-EN (Abstand 20, Vorsprung 20) | gezählt, richtig | 91 ms |
| 85 | UNL-153/219 | OGN-143/298 (Abstand 30, Vorsprung 6) | Auswahl angeboten, falsche Karte vorn | 298 ms |
