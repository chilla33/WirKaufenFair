# 🛒 WirKaufenFair

**Open Source App für nachhaltigen und ethischen Einkauf – mit Community-Power.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.119-green.svg)](https://fastapi.tiangolo.com)

---

## 🌟 **Features**

- 🛍️ **Intelligente Einkaufslisten** – Multi-Store Support mit automatischer Persistenz
- 🤖 **Smart Matching** – Fuzzy-Suche + OpenFoodFacts Integration (2 Mio. Produkte)
- 🌱 **Nachhaltigkeits-Scores** – Eco, Nutri, Ethics (A-E Bewertung)
- 💰 **Community-Preise** – Nutzer melden & bestätigen Preise
- 📍 **GPS-Integration** – Nächste Läden zuerst (opt-in)
- 🌙 **Dark Mode** – Automatisch oder manuell
- 📱 **Responsive** – Mobile & Desktop optimiert
- 🔒 **Datenschutz** – Keine Tracking, LocalStorage, Open Source

---

## 🚀 **Quick Start**

### **Backend starten**

```bash
# 1. Virtual Environment erstellen
python -m venv .venv

# 2. Aktivieren (Windows)
.\.venv\Scripts\Activate.ps1

# 3. Dependencies installieren
pip install -r requirements.txt

# 4. Server starten
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Server läuft auf: **http://127.0.0.1:8000**

### **Frontend öffnen**

Öffne im Browser:
```
http://127.0.0.1:8000/static/shopping_list.html
```

---

## 📁 **Projekt-Struktur**

```
WirKaufenFair/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI App
│   │   ├── database.py          # SQLAlchemy Setup
│   │   ├── models.py            # DB Models
│   │   ├── openfoodfacts_routes.py  # OFF API
│   │   ├── rating_routes.py     # Bewertungen
│   │   └── ethics_db.py         # Ethics-Score
│   └── requirements.txt         # Python Dependencies (legacy)
│
├── frontend/
│   ├── index.html               # Landing Page
│   ├── shopping_list.html       # Hauptanwendung
│   ├── hilfe.html              # Hilfe & Dokumentation
│   ├── impressum.html          # Impressum
│   ├── style.css               # Global Styles (inkl. Dark Mode)
│   └── assets/
│       ├── shopping_list_v2.js # Main Logic (66KB - TO REFACTOR)
│       ├── shopping_list_enhanced.js
│       └── price_verification_dialog.js
│
├── requirements.txt            # ✅ Python Dependencies (ROOT)
├── .gitignore                  # ✅ Git Ignore Rules
├── REFACTORING.md             # ✅ Refactoring Plan
├── README.md                   # This file
└── LICENSE.md                  # MIT License
```

---

## 🛠️ **Tech Stack**

**Backend:**
- **FastAPI** (0.119) – Modern Python Web Framework
- **SQLAlchemy** (2.0) – ORM
- **Uvicorn** – ASGI Server
- **Pydantic** – Data Validation
- **httpx** – Async HTTP Client (für OFF API)

**Frontend:**
- **Vanilla JavaScript** – Kein Framework (bewusste Entscheidung)
- **CSS Variables** – Dark Mode Support
- **LocalStorage** – Client-side Persistenz
- **Native ES6+** – Moderne JS Features

**APIs:**
- **OpenFoodFacts** – 2 Mio. Produkte mit Scores
- **Custom Backend** – Community-Daten (Preise, Läden)

---

## 📖 **Dokumentation**

- **Hilfe:** http://127.0.0.1:8000/static/hilfe.html
- **API Docs:** http://127.0.0.1:8000/docs (Swagger UI)
- **Refactoring Plan:** [REFACTORING.md](REFACTORING.md)

---

## 🧪 **Entwicklung**

### **Dependencies aktualisieren**
```bash
pip install --upgrade -r requirements.txt
```

### **Neue Dependency hinzufügen**
```bash
pip install <package>
pip freeze > requirements.txt
```

### **Datenbank zurücksetzen**
```bash
rm backend.db
# Server neu starten → DB wird neu erstellt
```

### **Tests ausführen** (TODO)
```bash
pytest backend/tests/
```

---

## 🎯 **Roadmap**

### ✅ **Fertig**
- [x] Multi-Store Listen
- [x] Intelligentes Matching
- [x] Kategorie-Filter
- [x] Dark Mode
- [x] GPS-Banner
- [x] Preis melden (mit/ohne Laden)
- [x] Export/Teilen
- [x] Online-Hilfe

### 🔄 **In Arbeit**
- [ ] Refactoring: `shopping_list_v2.js` → Module (66KB → 7x ~8KB)
- [ ] Bundler Setup (esbuild)
- [ ] Unit Tests

### 📋 **Geplant**
- [ ] User Accounts & Cloud-Sync
- [ ] QR-Code Import/Export
- [ ] Offline-Modus (PWA)
- [ ] Barcode-Scanner
- [ ] Receipt-Scanner mit OCR
- [ ] Route-Optimierung
- [ ] Preisalarm
- [ ] Social Features (Listen teilen)

---

## 🤝 **Contributing**

Beiträge sind willkommen! Bitte beachte:

1. **Fork** das Repo
2. **Branch** erstellen (`git checkout -b feature/mein-feature`)
3. **Commit** (`git commit -am 'Add feature'`)
4. **Push** (`git push origin feature/mein-feature`)
5. **Pull Request** erstellen

**Code Style:**
- Python: PEP 8
- JavaScript: ES6+ (keine Semicolons)
- HTML: 4 Spaces Indent

---

## 🐛 **Bugs & Features**

Gefunden einen Bug oder hast eine Idee?

- **Issues:** https://github.com/chilla33/WirkaufenFair/issues
- **Discussions:** https://github.com/chilla33/WirkaufenFair/discussions
- **Email:** kontakt@wirkaufenfair.de

---

## 📜 **Lizenz**

MIT License – siehe [LICENSE.md](LICENSE.md)

**TL;DR:** Du darfst den Code nutzen, verändern, verkaufen – solange du die Lizenz beibehältst.

---

## 🙏 **Credits**

- **OpenFoodFacts** – Produktdaten & Scores
- **Community** – Preise, Bewertungen, Feedback
- **Contributors** – Siehe [GitHub Contributors](https://github.com/chilla33/WirkaufenFair/graphs/contributors)

---

## 📞 **Kontakt**

- **Website:** https://wirkaufenfair.de (geplant)
- **Email:** kontakt@wirkaufenfair.de
- **GitHub:** [@chilla33](https://github.com/chilla33)

---

**Made with ❤️ by the Community**

*Fair einkaufen war nie einfacher!*

