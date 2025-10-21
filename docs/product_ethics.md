# Produktspezifische Ethikrichtlinien

Dieses Dokument beschreibt, wie ethische Aspekte konkret in die Produktdaten, das Scoring und die UI aufgenommen werden. Ziel: Produkte nicht nur technisch und ökologisch bewerten, sondern auch ethische Risiken, Transparenz und Handlungsoptionen sichtbar machen.

## Kernelemente

- Ethische Kriterien: Welche Aspekte wir messen (z. B. faire Arbeitsbedingungen, Kinderarbeit‑Risiko, Lieferantentransparenz, Konfliktrohstoffe, Tierwohl).
- Evidenz & Quellen: Jede ethische Bewertung braucht eine Quelle (z. B. Zertifikat, EPD, NGO‑Report, Herstellerangabe) oder einen Verifizierbaren Hinweis (Foto, Beleg).
- Contestability: Nutzer sollen Bewertungen anfechten können; Beiträge protokolliert und überprüfbar.

## Empfohlene ethische Kriterien (Produkt‑Level)

1. Lieferketten‑Transparenz (weight 25%)
   - Gibt es öffentlich zugängliche Informationen über Zulieferer? Zertifikate? Firmenberichte?
2. Arbeitsbedingungen (weight 25%)
   - Hinweise auf faire Löhne, Gewerkschaftsrechte, Audits oder negative Berichte.
3. Konfliktmaterialien & Herkunft (weight 15%)
   - Risiko für Konfliktmineralien, Tropenholz ohne Zertifikat, seltene Mineralien.
4. Tierwohl (weight 10%)
   - Relevant für Textilien, Lebensmittel, Kosmetik (tierische Inhaltsstoffe, Tierversuche).
5. Produkt‑Ökologie & Ressourcenschonung (weight 15%)
   - Materialwahl, Recyclingquote, Reparierbarkeit (integriert mit Umwelt‑Score).
6. Verpackung & Entsorgung (weight 10%)

Gewichtung ist nur ein Vorschlag; Nutzer können später ihre eigenen Prioritäten setzen.

## Datenanforderungen & Provenance

- `ethics_evidence`: Liste von Quellen (type, url, summary, confidence)
- `ethics_score`: numerischer Aggregatwert (0–100) und Breakdown nach Kriterien
- `ethics_flags`: enum tags z.B. ["low_transparency", "conflict_material_risk", "animal_testing"]
- `ethics_verified`: boolean + verifier_id + verified_at
- `ethics_dispute_count`: int

Quellen priorisieren: 1) offizielle Zertifikate (EPD, Fairtrade, GOTS), 2) NGO‑Reports / Medienrecherchen, 3) Herstellerangaben (mit Vorsicht), 4) Community‑Belege (Fotos, receipts).

## UI/UX Empfehlungen

- Produktdetail: eigene Sektion "Ethik & Soziales" mit Score‑Breakdown, Top‑3 Quellen und CTA "Problem melden".
- Badges: "Ethics Verified", "Low Transparency", "Contested" (visible on product card).
- Shopping‑List: Priorisiere Produkte mit höheren `ethics_score` und ermögliche "Ethics‑First" Sortierung.

## Moderation & Review Workflow

1. Beitrag (community oder import) legt `ethics_evidence` an mit optionalen Fotos/links.
2. Automatischer Plausibilitätscheck (z. B. URL domain, certificate format).
3. Verifizierer (trusted moderators) prüfen und setzen `ethics_verified`.
4. Bei Konflikten: Produkt in "Contested" Status bis Review abgeschlossen.

## Konflikt‑ und Interessensregel

- Monetäre Beziehungen zu Herstellern müssen offengelegt werden.
- Keine Monetarisierung, die das Scoring ohne klare Kennzeichnung beeinflusst (z. B. versteckte Sponsored Scores).

## Tests & Monitoring (Bias / Fairness)

- Periodische Tests: Score‑Distribution per Kategorie/brand to detect bias.
- Alerts: Wenn ein Brand plötzlich viele "low_transparency" Flags erhält, Review durch Team.
- Logging: alle Änderungen an `ethics_score` versioniert für Audits.

## MVP‑Priorität (1–3)

1. Minimal: add `ethics_score`, `ethics_flags`, `ethics_evidence` (text/url) + display in product detail.
2. Medium: verification flow, badges, contest button, basic moderator UI.
3. Full: automated source ingestion (EPDs, NGO feeds), bias tests and scheduled audits.

## Beispiel‑UX Text (Produktdetail)

"Ethik‑Bewertung: 72/100 — Dieses Produkt hat gute Materialtransparenz, allerdings fehlen unabhängige Arbeitsrechts‑Audits. Quellen: Herstellerangabe, Foto der Verpackung. Bei Fragen melde das Produkt bitte hier."
