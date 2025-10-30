# 💰 Community-Preissystem – Anti-Missbrauch-Mechanismen

## Problem
Wie kann die Community Preise melden, ohne dass ein Admin jeden Preis manuell im Laden überprüfen muss?

## Lösung: Multi-Layer-Schutz

### 1️⃣ **Plausibilitätschecks (automatisch)**

#### Absolute Grenzen:
- ❌ Preis < 0.10 € → Abgelehnt (zu unrealistisch)
- ❌ Preis > 500 € → Abgelehnt (zu hoch für Lebensmittel)

#### Relativer Check (Abweichung vom Durchschnitt):
```
Beispiel:
- 5 bisherige Meldungen: 1.99 €, 2.09 €, 1.95 €, 2.05 €, 1.99 €
- Durchschnitt: 2.01 €
- Neue Meldung: 5.99 € → Abweichung: +197% ⚠️

➡️ Status wird "pending_review" statt "pending"
➡️ Braucht MEHR Bestätigungen (7 statt 5 Upvotes)
```

---

### 2️⃣ **Community-Voting (Crowd-Wisdom)**

#### Normale Freigabe:
- ✅ **5 Upvotes** + **0 Downvotes** = AUTO-VERIFY
- User im Laden bestätigen den Preis → hohe Wahrscheinlichkeit, dass er stimmt

#### Schnelle Ablehnung:
- ❌ **2 Downvotes** + **mehr Downs als Ups** = AUTO-REJECT
- Offensichtlich falsche Preise werden schnell entfernt

#### Statusübergänge:
```
pending → (5 ups, 0 downs) → verified → in DB übernommen
pending → (2 downs > ups) → rejected → wird nicht angezeigt

pending_review → (7 ups, 0 downs) → verified (strengere Regel)
pending_review → (3 downs) → rejected
```

---

### 3️⃣ **Session-Tracking (Anti-Spam)**

#### Aktuell:
- User-Session = MD5-Hash der IP (anonymisiert)
- Verhindert, dass 1 Person 100x den gleichen Preis meldet

#### Erweiterbar mit:
- Rate-Limiting: Max. 10 Preismeldungen pro Stunde
- Fingerprinting: Browser-ID via Canvas/WebGL
- Optional: User-Accounts mit Reputation-Score

---

### 4️⃣ **Admin-Dashboard** (`/admin/price_reviews.html`)

#### Wann eingreifen?
- ⚠️ **Pending Review** (orange) = große Abweichung → manuell prüfen
- 🟡 **Pending** lange Zeit (>7 Tage) = zu wenig Votes → löschen oder freigeben
- 🔴 **Viele Downvotes** aber nicht genug für Auto-Reject → Admin entscheidet

#### Actions:
- **✓ Freigeben** = 5x Upvote → Status "verified" → in DB
- **✗ Ablehnen** = 3x Downvote → Status "rejected" → versteckt

---

### 5️⃣ **Optionale Erweiterungen** (Future)

#### A) Kassenbon-Upload:
```python
# In PriceReport Model bereits vorbereitet:
photo_url = Column(String(500), nullable=True)

# User lädt Kassenbon hoch → OCR extrahiert Preis → Auto-Verify
```

#### B) Historische Preis-Plausibilität:
```python
# Prüfe Preisverlauf:
last_month_avg = get_price_history(product, store, days=30)
if new_price > last_month_avg * 1.2:
    # Preis ist 20% höher als letzten Monat → Review
    status = "pending_review"
```

#### C) Store-Manager-Accounts:
```python
# Laden-Mitarbeiter können Preise direkt freigeben
if user.role == "store_manager" and user.store == report.store:
    report.status = "verified"
```

#### D) Reputation-System:
```python
# User mit vielen korrekten Meldungen werden vertrauenswürdiger
user.correct_reports += 1
if user.correct_reports > 50:
    user.trust_level = "trusted"
    # Meldungen von trusted users brauchen nur 3 statt 5 Votes
```

---

## 🎯 Fazit

**Du brauchst NICHT in den Laden, weil:**
1. ✅ Die Community verifiziert sich gegenseitig (5 User müssen zustimmen)
2. ✅ Offensichtlich falsche Preise werden automatisch gefiltert
3. ✅ Große Abweichungen werden markiert und brauchen mehr Bestätigungen
4. ✅ Admin Dashboard zeigt nur kritische Fälle (orange/rot)

**Admin-Aufwand:**
- ~5 Minuten pro Tag: Pending-Review-Fälle checken
- Meistens: Nur Draufschauen, ob plausibel → Freigeben
- Selten: Bei Missbrauchsverdacht → User-Session blockieren

**Skalierung:**
- Je mehr User, desto schneller werden Preise verifiziert
- Selbstregulierende Community (Wikipedia-Prinzip)
- Admin ist nur Backup, nicht Bottleneck

---

## 📊 Beispiel-Workflow

```
1. User A meldet: "REWE Milch 1L" = 1.99 €
   → Status: pending

2. User B,C,D,E bestätigen (alle waren heute im REWE)
   → 4 Upvotes, 0 Downvotes

3. User F bestätigt auch
   → 5 Upvotes, 0 Downvotes
   → AUTO-VERIFY ✓
   → Preis wird in ProductLocation übernommen

4. Alle anderen User sehen jetzt: 1.99 € (verifiziert ✓)
```

**Bei Missbrauch:**
```
1. Troll meldet: "REWE Milch 1L" = 0.01 €
   → Status: rejected (< 0.10 € Minimum)
   → Wird gar nicht erst gespeichert

2. Troll meldet: "REWE Milch 1L" = 15.99 €
   → Durchschnitt war 1.99 €
   → Abweichung: +703% ⚠️
   → Status: pending_review
   → Admin sieht orange Warnung im Dashboard
   → Admin lehnt ab (1 Klick)
```

---

## 🚀 Setup

1. Backend läuft bereits (uvicorn erstellt Tables automatisch)
2. Admin öffnet: `http://localhost:8000/admin/price_reviews.html`
3. Filter auf "Pending Review" → nur kritische Fälle sichtbar
4. Bei Bedarf: Freigeben/Ablehnen

**Fertig!** 🎉
