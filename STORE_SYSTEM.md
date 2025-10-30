# 🏪 Hierarchisches Laden-System + Preisgültigkeit

## Problem

**Dilemmata:**
1. **Spezifisch vs. Generisch:**
   - Nur "REWE" → Preis gilt für alle REWEs (ungenau, da Preise lokal variieren können)
   - "REWE Drochtersen" → Preis ist genau, aber zu wenig User für 5 Upvotes

2. **Zeitliche Gültigkeit:**
   - Preise ändern sich (Angebote, Inflation)
   - Alte Preise mit vielen Votes sollten nicht ewig bleiben

3. **Skalierung:**
   - Kleine Orte haben wenig User
   - Große Ketten haben viele Daten, aber lokal unterschiedlich

---

## Lösung: Hybrides 3-Level-System

### 📊 **Level 1: Spezifischer Standort** (höchste Priorität)

```
Produkt: "Milch 1L"
Laden: "REWE Drochtersen"
Preis: 1.09 € (verifiziert, 5 Upvotes)
Alter: 3 Tage
```

**Angezeigt als:** `1.09 € (✓5)`

---

### 📊 **Level 2: Ketten-Durchschnitt** (Fallback)

Wenn Level 1 nicht vorhanden:
```
Produkt: "Milch 1L"
Kette: "REWE" (alle Filialen)
Preise letzte 30 Tage:
  - REWE Hamburg: 1.15 € (7 Tage alt)
  - REWE Bremen: 1.09 € (2 Tage alt)
  - REWE Stade: 1.12 € (5 Tage alt)
  
Durchschnitt: 1.12 €
```

**Angezeigt als:** `≈ 1.12 € ⌀`  
**Tooltip:** "≈ Durchschnitt von 3 REWE-Filialen"

---

### 📊 **Level 3: Veralteter Preis** (mit Warnung)

Wenn Preis >30 Tage alt:
```
Produkt: "Milch 1L"
Laden: "REWE Drochtersen"
Preis: 1.09 € (verifiziert, aber 45 Tage alt)
```

**Angezeigt als:** `1.09 € ⏰`  
**Tooltip:** "Preis ist 45 Tage alt"  
**Aktion:** User werden ermutigt, neuen Preis zu melden

---

## 🎯 Implementierung

### Backend-Logik (`get_best_price`)

```python
1. Prüfe spezifischen Standort (z.B. "REWE Drochtersen")
   ├─ Preis vorhanden UND < 30 Tage alt?
   │  └─ ✓ Verwende diesen (Level 1)
   └─ Preis > 30 Tage alt?
      └─ ⚠️ Verwende, aber markiere als "outdated"

2. Kein spezifischer Preis? → Prüfe Kette
   ├─ Hole alle Preise für "REWE*" (letzte 30 Tage)
   ├─ Berechne Durchschnitt
   └─ ✓ Verwende Durchschnitt (Level 2)

3. Gar nichts gefunden?
   └─ ✗ "Kein Preis verfügbar"
```

### Frontend-Anzeige

**Icons:**
- `✓5` = Verifiziert mit 5 Upvotes
- `3↑` = Pending mit 3 Upvotes
- `⌀` = Ketten-Durchschnitt
- `⏰` = Veraltet (>30 Tage)
- `≈` = Geschätzt/Nicht verifiziert

---

## 📋 Laden-Auswahl im Frontend

### Hierarchische Dropdown:

```
[ Laden wählen          ▼]

REWE (alle Filialen)
  → REWE Drochtersen
  → REWE Hamburg Altona
  → REWE Stade

EDEKA (alle Filialen)
  → EDEKA Drochtersen
  → EDEKA Hamburg

ALDI
LIDL
...
```

### Logik:

1. **User wählt "REWE (alle Filialen)":**
   - Matching verwendet alle REWE-Produkte
   - Preise werden als Ketten-Durchschnitt berechnet
   - Gut für: Preisvergleich, Produktsuche

2. **User wählt "REWE Drochtersen":**
   - Matching bevorzugt Standort-spezifische Daten
   - Falls nicht vorhanden: Fallback auf Ketten-Daten
   - Gut für: Konkrete Einkaufstour

---

## ⚙️ Zeitbasierte Preisgültigkeit

### Auto-Invalidierung:

```python
# Preise > 30 Tage werden als "outdated" markiert
# Preise > 90 Tage werden aus Best-Price-Berechnung ausgeschlossen
# Preise > 180 Tage werden archiviert (nicht gelöscht!)
```

### Preis-Historie:

Alle Preise werden gespeichert mit:
- `valid_from`: Zeitpunkt der Meldung
- `valid_until`: NULL = aktuell gültig, sonst Ersetzungszeitpunkt
- `created_at`: Original-Meldungsdatum

**Vorteil:**
- Preisverlaufs-Charts möglich
- Saisonale Trends erkennbar
- Historische Daten für ML-Modelle

---

## 💡 Anreize für User

### Problem: Zu wenig Votes in kleinen Orten

**Lösungen:**

1. **Gamification:**
   ```
   "Sei der Erste, der den Preis für REWE Drochtersen meldet!"
   → Badge: "Local Hero 🏆"
   ```

2. **Niedrigere Schwelle für kleine Orte:**
   ```python
   if location_size < 10_000_einwohner:
       required_votes = 3  # statt 5
   ```

3. **Bonus für erste Meldung:**
   ```python
   if is_first_report_for_location:
       confidence_score = 0.7  # statt 0.5
       # → Schnellere Freigabe
   ```

4. **Temporäre Fallback-Regeln:**
   ```
   Wenn <3 Votes nach 7 Tagen:
   → Status = "provisionally_verified"
   → Wird angezeigt mit Warnung: "Noch nicht bestätigt"
   ```

---

## 🚀 Migration-Plan

### Phase 1: Jetzt (Minimal Viable)
- ✅ Hierarchische Dropdown (Kette + Standort)
- ✅ Ketten-Durchschnitt als Fallback
- ✅ 30-Tage-Gültigkeit
- ✅ Veraltete Preise markieren

### Phase 2: Später (wenn mehr User)
- ⏳ Geo-Matching (GPS → nächster Laden)
- ⏳ Store-Model in DB (mit Koordinaten)
- ⏳ Automatische Preis-Invalidierung (Cron-Job)
- ⏳ Push-Notifications: "Neuer Preis bei deinem REWE"

### Phase 3: Fortgeschritten
- ⏳ ML-Modell für Preis-Prognosen
- ⏳ OCR für Kassenbons → Auto-Preisimport
- ⏳ API-Integration mit Laden-Websites

---

## 📊 Beispiel-Szenarien

### Szenario 1: Hamburg (viele User)

```
User sucht "Milch 1L" bei "REWE Hamburg Altona"

✓ Standort hat 50 Preismeldungen → 1.09 € (✓12)
→ User sieht: verifizierten, aktuellen Preis
```

### Szenario 2: Drochtersen (wenige User)

```
User sucht "Milch 1L" bei "REWE Drochtersen"

✗ Standort hat 0 Meldungen
✓ Kette "REWE" hat 200 Meldungen → 1.12 € (⌀)
→ User sieht: Ketten-Durchschnitt mit Hinweis
→ App ermutigt: "Hilf der Community – melde den Preis!"
```

### Szenario 3: Veralteter Preis

```
User sucht "Milch 1L" bei "REWE Drochtersen"

✓ Standort hat 1 Meldung (45 Tage alt) → 1.09 € (⏰)
→ User sieht: veralteten Preis mit Warnung
→ App ermutigt: "Preis aktualisieren?"
```

---

## ✅ Vorteile dieses Systems

1. **Funktioniert in kleinen Orten:**
   - Ketten-Durchschnitt als Fallback
   - Niedrigere Vote-Schwelle möglich

2. **Bleibt aktuell:**
   - 30-Tage-Fenster
   - Alte Preise werden markiert

3. **Flexibel:**
   - User kann zwischen Kette und Standort wählen
   - System lernt aus Daten

4. **Skaliert:**
   - Je mehr User, desto besser die Daten
   - Kleine Orte profitieren von Ketten-Daten

5. **Ehrlich:**
   - Ketten-Durchschnitt wird klar als "≈ ⌀" markiert
   - Veraltete Preise werden mit "⏰" gekennzeichnet

---

## 🎯 TL;DR

**Kurzfassung:**

✅ **User wählt Kette** → bekommt Durchschnitt aller Filialen  
✅ **User wählt Standort** → bekommt exakten Preis (falls vorhanden) oder Ketten-Durchschnitt  
✅ **Preise > 30 Tage** → werden als veraltet markiert  
✅ **Wenig Votes** → Ketten-Daten als Backup  
✅ **Admin muss nicht** in jeden Laden fahren – Community regelt das  

**Das Beste aus beiden Welten:** Genauigkeit + Verfügbarkeit! 🚀
