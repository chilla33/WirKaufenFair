# Ethics Database - Anleitung

## Übersicht

Die Ethics-Datenbank (`backend/app/ethics_db.py`) bewertet Marken und Unternehmen nach ethischen Kriterien:

- **Politische Affiliationen** (z.B. AfD-Spenden)
- **Arbeitsbedingungen** (Gewerkschaftsfeindlichkeit, Ausbeutung)
- **Umwelt** (Plastik, Wasserausbeutung, CO2)
- **Steuern** (Aggressive Steuervermeidung)
- **Menschenrechte** (Kinderarbeit, Diskriminierung)

## Wie funktioniert das System?

### 1. Ethics Score (0.0 - 1.0)
- **0.85-1.0**: Vorbildlich (z.B. Genossenschaften, Bio-Marken)
- **0.75-0.84**: Gut (z.B. REWE, ALDI)
- **0.50-0.74**: OK (neutrale Bewertung)
- **0.30-0.49**: Problematisch (z.B. Coca-Cola, Amazon)
- **0.0-0.29**: Kritisch (z.B. Müller/AfD, Nestlé)

### 2. Integration in Fairness-Score

Produkte werden sortiert nach:
- **60%** Relevanz (wie gut passt die Suche?)
- **40%** Fairness:
  - **40%** Eco-Score (Umwelt)
  - **30%** Ethics-Score ⭐ **NEU!**
  - **20%** Nutri-Score (Gesundheit)
  - **10%** Verifizierung + Lokal

**Beispiel:** Weihenstephan Milch bekommt 0.2 Ethics-Score wegen Müller/AfD → landet weiter unten trotz gutem Eco-Score.

## Neue Marken hinzufügen

### Schritt 1: Issue recherchieren
Prüfe vertrauenswürdige Quellen:
- Investigative Journalismus (Spiegel, Guardian, Süddeutsche)
- NGOs (Oxfam, Greenpeace, Amnesty)
- Offizielle Berichte (EU-Kommission, Kartellamt)

### Schritt 2: Eintrag erstellen

```python
"markenname": CompanyEthics(
    name="Markenname",
    parent_company="Mutterkonzern" oder None,
    issues=[
        EthicsIssue(
            category="political|labor|environment|tax|human_rights",
            severity="critical|major|minor",
            description="Kurze Beschreibung des Problems",
            source="https://vertrauenswürdige-quelle.de/artikel",
            year=2024
        )
    ],
    ethics_score=0.3  # Bewertung nach Guidelines
)
```

### Schritt 3: Ethics Score festlegen

**Richtlinien:**

#### Critical Issues (Severity: critical)
- **AfD/Rechtsextreme Unterstützung**: 0.1-0.2
- **Schwere Menschenrechtsverletzungen**: 0.1-0.3
- **Systematische Ausbeutung**: 0.2-0.3

#### Major Issues (Severity: major)
- **Gewerkschaftsfeindlichkeit**: -0.2 vom Basis-Score
- **Schwere Umweltverschmutzung**: -0.2
- **Kinderarbeit in Lieferkette**: -0.3

#### Minor Issues (Severity: minor)
- **Vereinzelte Kritik**: -0.05 bis -0.1
- **Verbesserungswürdige Praktiken**: -0.1

## Beispiele

### Kritisch: Müller/Weihenstephan (0.2)
```python
"müller": CompanyEthics(
    name="Müller",
    parent_company="Unternehmensgruppe Theo Müller",
    issues=[
        EthicsIssue(
            category="political",
            severity="critical",
            description="Finanzierung der AfD durch Theo Müller",
            source="https://www.spiegel.de/...",
            year=2024
        )
    ],
    ethics_score=0.2
)
```

### Gut: Arla (0.85)
```python
"arla": CompanyEthics(
    name="Arla",
    parent_company="Arla Foods (Genossenschaft)",
    issues=[],
    ethics_score=0.85  # Genossenschaft, faire Praktiken
)
```

### Neutral: Unbekannte Marke (0.6)
Wenn eine Marke nicht in der DB ist, wird automatisch 0.6 (neutral) vergeben.

## Marken mit Parent Company

Tochtermarken erben die Issues der Muttergesellschaft:

```python
"weihenstephan": CompanyEthics(
    name="Weihenstephan",
    parent_company="Müller (Unternehmensgruppe Theo Müller)",
    issues=[
        EthicsIssue(
            category="political",
            severity="critical",
            description="Gehört zu Müller - indirekte AfD-Finanzierung",
            source="https://...",
            year=2024
        )
    ],
    ethics_score=0.2  # Erbt Müller-Score
)
```

## UI-Integration

### Badges im Frontend
- **Fair ✓** (grün): Ethics-Score ≥ 0.75
- **OK** (orange): Ethics-Score 0.5-0.74
- **Kritisch** (rot): Ethics-Score < 0.5

### Tooltip mit Details
Hover über Badge zeigt:
```
Ethische Bedenken:
🔴 Political: Finanzierung der AfD durch Konzernchef
```

## Weitere Marken-Vorschläge

**Priorität: Häufige Supermarkt-Produkte**

### Milchprodukte
- [ ] Bärenmarke (Hochwald)
- [ ] Landliebe (FrieslandCampina)
- [ ] Milram
- [ ] Zott

### Getränke
- [ ] Pepsi
- [ ] Red Bull
- [ ] Bionade
- [ ] Fritz-Kola

### Süßwaren
- [ ] Ferrero (Nutella, Hanuta)
- [ ] Milka (Mondelez)
- [ ] Ritter Sport
- [ ] Haribo

### Convenience
- [ ] Dr. Oetker
- [ ] Knorr (Unilever)
- [ ] Maggi (Nestlé) ✅ bereits enthalten

### Fast Food
- [ ] McDonald's
- [ ] Burger King
- [ ] Subway

## Datenquellen

### Empfohlene Quellen
1. **Correctiv**: Investigative Recherchen
2. **Lobbycontrol**: Unternehmensverflechtungen
3. **Oxfam**: Lieferketten und Arbeitsbedingungen
4. **Greenpeace**: Umweltpraktiken
5. **Amnesty International**: Menschenrechte

### Vorsicht bei
- Ungeprüfte Social-Media-Posts
- Einzelmeinungen ohne Quellen
- Veraltete Informationen (>5 Jahre)

## Aktualisierung

Nach Änderungen an `ethics_db.py`:

1. Server neu starten (lädt automatisch neu bei --reload)
2. Cache leeren: `POST /api/v1/openfoodfacts/cache/clear`
3. Browser-Cache leeren (Strg+Shift+R)

## Transparenz

**Wichtig:** Alle Ethics-Scores sind subjektiv und basieren auf verfügbaren öffentlichen Informationen. Nutzer sollen die Möglichkeit haben, eigene Bewertungen vorzunehmen.

**Zukünftige Erweiterungen:**
- [ ] User-eigene Ethics-Datenbank (persönliche Blacklist)
- [ ] Community-Voting für Ethics-Scores
- [ ] Live-Updates aus öffentlichen APIs
- [ ] Detailseite pro Marke mit Quellen

---

**Fragen oder neue Marken?** Öffne ein Issue im Repo!
