# 🚀 Neue Features & Roadmap

## ✅ **Kürzlich implementiert**

### 1. 📦 **Kompakte Einkaufsliste mit Aufklapp-Funktion**
- Initial kompakte Ansicht (Name, Menge, Preis)
- ▼-Button zum Aufklappen der Details
- Details: Gang, Regal, Bewertung, Notizen, Preis melden
- **Bonus:** Produktbild wird beim Aufklappen von 64px auf 128px vergrößert
- Klick aufs Bild öffnet Vollbild

### 2. ⏰ **Preis-Zeitstempel**
- Alle Preise zeigen Alter: `1.09 € (vor 3d)`
- Hilft User zu erkennen, ob Preis aktuell ist
- Motiviert zur Aktualisierung alter Preise

### 3. ⚖️ **Rechtliche Absicherung**
- `frontend/impressum.html` mit vollständigem Haftungsausschluss
- Gelber Disclaimer unter jeder Einkaufsliste
- "Preise ohne Gewähr" klar kommuniziert

### 4. 🏷️ **Regionale Produkte**
- Neue DB-Felder in `ProductLocation`:
  - `is_regional`: 0=überall, 1=nur diese Filiale, 2=nur diese Region
  - `availability_notes`: z.B. "Kartoffeln vom Hof Müller"
- Ermöglicht Kennzeichnung lokaler Spezialitäten
- Frontend zeigt Badge: `🌾 Regional`

### 5. 📸 **Kassenbon-Scanner (Beta)**
**Neue Seite:** `frontend/receipt_scanner.html`

**Features:**
- Upload von Kassenbon-Fotos
- OCR mit Tesseract.js (im Browser!)
- Automatische Erkennung von:
  - Laden (REWE, EDEKA, ...)
  - Produkte
  - Preise
- User kann Ergebnisse prüfen und speichern
- Ein-Klick-Import mehrerer Preise

**Tech-Stack:**
- Tesseract.js 4.x (Open Source OCR)
- Läuft komplett im Browser (kein Server-Upload nötig)
- Deutsch-Sprachpaket für bessere Erkennung

**Accuracy:**
- ~70-90% bei guten Fotos
- User muss Ergebnisse prüfen (daher Beta)
- Funktioniert am besten mit klaren, gut beleuchteten Fotos

### 6. 📈 **Preisverlauf-Chart**
**Neue Seite:** `frontend/price_history.html`

**Features:**
- Zeigt Preisentwicklung der letzten 6 Monate
- Chart.js für schöne Visualisierung
- Statistiken:
  - Aktueller Preis
  - Trend (↑ / ↓ in %)
  - Min/Max/Durchschnitt
  - Anzahl Meldungen
- Filter nach Produkt + Laden

**Use Cases:**
- "Wann ist Milch am günstigsten?"
- "Steigen Preise vor Feiertagen?"
- "Wo lohnt sich der Einkauf?"

### 7. ✓ **Upvote mit Korrektur-Dialog**
**Neue Datei:** `frontend/assets/price_verification_dialog.js`

**Workflow:**
```
User klickt "Preis bestätigen"
→ Dialog: "Stimmt dieser Preis?"
   [✓ Ja, bestätigen]  [✏️ Korrigieren]

Falls Korrektur:
→ Eingabefeld erscheint
→ User gibt neuen Preis ein
→ Alter Preis wird ge-downvotet
→ Neuer Preis wird angelegt
→ Toast: "Preis korrigiert, danke!"
```

**Vorteile:**
- Ermutigt zur Datenqualität
- User können direkt korrigieren statt nur downvoten
- Community-Daten werden schneller besser
- Gamification: "Du hilfst anderen!"

---

## 🎯 **Nächste Features (Roadmap)**

### Phase 1: Core-Verbesserungen (nächste 2 Wochen)

#### A) GPS-basierte Laden-Sortierung (50% fertig)
- ✅ GPS-Permission bereits implementiert
- ⏳ Store-DB mit Koordinaten fehlt noch
- ⏳ Haversine-Distanz-Berechnung
- **Ziel:** Nächster Laden = erster in Dropdown

#### B) Produktauswahl: Aufklappbare Details
- Beim Hinzufügen von Produkten
- Details klappen auf: Gang, Regal, Preis direkt eintragen
- **Vorteil:** User im Laden können sofort alles eintragen

#### C) OCR-Verbesserungen
- Foto-Preprocessing (Kontrast, Rotation)
- Bessere Parser-Regex für verschiedene Kassenbon-Formate
- Unterstützung für österreichische/schweizer Bons

---

### Phase 2: Community & Gamification (4 Wochen)

#### D) User-Accounts & Reputation
```sql
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(200) UNIQUE,
  reputation_score INT DEFAULT 0,
  badges JSON, -- ["first_price", "local_hero", "scanner_pro"]
  created_at DATETIME
);
```

**Badges:**
- 🏆 **Local Hero**: Erste Preismeldung in deinem Ort
- 📸 **Scanner Pro**: 50+ Kassenbons gescannt
- ✓ **Verifier**: 100+ Preise bestätigt
- 🌾 **Regional Fan**: 20+ regionale Produkte gemeldet

**Reputation-Score:**
- +10 für Preismeldung (verifiziert)
- +5 für korrekten Upvote
- +20 für Kassenbon-Scan
- -10 für falschen Downvote
- Trusted Users (Reputation > 500) brauchen nur 3 statt 5 Votes

#### E) Notifications
- Push: "Neuer Preis bei deinem REWE verfügbar"
- E-Mail: "Dein gemeldeter Preis wurde verifiziert!"
- In-App: "Du hast ein neues Badge verdient!"

---

### Phase 3: Advanced Features (2-3 Monate)

#### F) ML-Preis-Prognosen
```python
# Trainiere Modell mit historischen Daten:
features = [
    'produkt_kategorie',
    'saisonalität',  # Weihnachten, Sommer
    'wochentag',
    'region',
    'inflation_rate'
]

model.predict(next_price_in_7_days)
```

**UI:**
```
Milch 1L — REWE Drochtersen
Aktuell: 1.09 €
Prognose: 1.19 € (in 7 Tagen) ⚠️
→ "Jetzt kaufen empfohlen!"
```

#### G) Store-Manager-Accounts
- Laden-Mitarbeiter können sich verifizieren
- Preise von Store-Managern werden sofort verifiziert
- Können Produktstandorte (Gang/Regal) direkt pflegen
- **Vorteil:** Offizielle Daten + Community-Daten

#### H) API für Drittanbieter
```
GET /api/v2/products/{ean}/best_price?lat=53.5&lon=9.5&radius=10km
→ Returns nearest stores with prices
```

**Use Cases:**
- Shopping-Apps
- Preisvergleichs-Portale
- Smart-Home-Geräte (Alexa: "Was kostet Milch bei REWE?")

---

### Phase 4: Scale & Optimize (6+ Monate)

#### I) Crawler für Online-Shops
- Automatischer Import von REWE.de, edeka24.de
- Preise aktualisieren ohne User-Input
- **Problem:** Rechtlich kritisch (Scraping) → prüfen

#### J) Mobile App (React Native)
- Native Push-Notifications
- Offline-Modus
- Barcode-Scanner (Kamera)
- AR: "Zeige mir wo das Produkt steht"

#### K) Smart-Einkaufsliste
- KI analysiert vergangene Einkäufe
- Schlägt Produkte vor: "Du kaufst jeden Montag Milch"
- Warnt: "Kaffee ist bald leer"
- Optimiert Route automatisch

---

## 📊 **Feature-Prioritäten (nach User-Feedback)**

### Must-Have (Blocker für Launch):
1. ✅ Preis-Disclaimer (rechtlich notwendig)
2. ✅ Kassenbon-Scanner (Killer-Feature)
3. ⏳ GPS-Laden-Sortierung (User erwarten das)

### Nice-to-Have (kann später):
4. ✅ Preisverlauf (Marketing-Feature)
5. ⏳ User-Accounts (Gamification)
6. ⏳ Push-Notifications

### Future (wenn Traction da):
7. ML-Prognosen
8. Mobile App
9. API für Drittanbieter

---

## 🎨 **Design-Verbesserungen (Roadmap)**

### Jetzt:
- ✅ Kompakte Liste
- ✅ Aufklappbare Details
- ✅ Zeitstempel überall

### Nächste Woche:
- Dark Mode
- Bessere Icons (statt Emoji)
- Responsive Design (Mobile-First)

### Später:
- Animationen (Smooth Scroll)
- Skeleton Loaders (statt Spinner)
- Illustrationen (statt Platzhalter)

---

## 💡 **Ideen aus der Community**

### Eingereicht von Usern:
1. **Meal-Planning:** "Zeig mir Rezepte mit günstigen Zutaten"
2. **Budget-Tracker:** "Ich will max. 50€/Woche ausgeben"
3. **Allergien-Filter:** "Verstecke glutenhaltige Produkte"
4. **Cashback:** "Gutscheine für Preismeldungen"

### In Prüfung:
- Kooperation mit Discountern (offizielle Preis-API)
- Browser-Extension (Preise auf jeder Webseite anzeigen)
- Telegram-Bot ("@WirkaufenFairBot zeig mir Milchpreise")

---

## 🚀 **Release-Timeline**

| Version | Features | Datum |
|---------|----------|-------|
| **v1.0 (MVP)** | Einkaufsliste, Preismeldungen, Matching | ✅ Oktober 2025 |
| **v1.1** | Kassenbon-OCR, Preisverlauf, Upvote-Korrektur | ✅ Oktober 2025 |
| **v1.2** | GPS-Sortierung, Regionale Produkte, Dark Mode | 📅 November 2025 |
| **v2.0** | User-Accounts, Badges, Reputation | 📅 Dezember 2025 |
| **v2.5** | ML-Prognosen, Store-Manager, API | 📅 Q1 2026 |
| **v3.0** | Mobile App, Smart-Liste, AR | 📅 Q2 2026 |

---

## 📝 **Feedback erwünscht!**

Welche Features sind dir am wichtigsten?  
Kontakt: [deine@email.com]

**Diskussion auf GitHub:**  
https://github.com/chilla33/WirkaufenFair/discussions

---

_Stand: Oktober 2025 • Made with ❤️ for fair shopping_
