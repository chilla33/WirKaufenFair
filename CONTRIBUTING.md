# 🤝 Contributing zu WirKaufenFair

Danke, dass du zu WirKaufenFair beitragen möchtest! Dieses Dokument erklärt, wie du helfen kannst.

---

## 📋 **Code of Conduct**

Wir erwarten von allen Contributors:
- ✅ Respektvolle Kommunikation
- ✅ Konstruktives Feedback
- ✅ Hilfsbereitschaft gegenüber Anfängern
- ❌ Keine Diskriminierung, Belästigung, Spam

---

## 🚀 **Wie kann ich helfen?**

### 1. **Bugs melden**
Gefunden einen Bug? Erstelle ein [Issue](https://github.com/chilla33/WirkaufenFair/issues/new):
- **Titel:** Kurze Beschreibung des Problems
- **Schritte:** Wie kann der Bug reproduziert werden?
- **Erwartetes Verhalten:** Was sollte passieren?
- **Tatsächliches Verhalten:** Was passiert stattdessen?
- **Screenshots:** Falls hilfreich
- **Browser/OS:** Chrome 120, Windows 11, etc.
- **Console-Logs:** F12 → Console → Fehler kopieren

### 2. **Features vorschlagen**
Idee für ein neues Feature? Erstelle eine [Discussion](https://github.com/chilla33/WirkaufenFair/discussions):
- **Was:** Beschreibe das Feature
- **Warum:** Welches Problem löst es?
- **Wie:** Grobe Implementierungsidee (optional)
- **Mockups:** UI-Skizzen (optional)

### 3. **Code beitragen**
Pull Requests sind willkommen! Siehe [Entwicklungs-Workflow](#entwicklungs-workflow) unten.

### 4. **Dokumentation verbessern**
- Typos fixen
- Hilfe-Seite erweitern (`frontend/hilfe.html`)
- README ergänzen
- Code-Kommentare hinzufügen

### 5. **Daten beitragen**
- **Preise melden** – Je mehr Nutzer, desto besser die Daten
- **Produkte vorschlagen** – Fehlende Produkte melden
- **Läden hinzufügen** – Neue Standorte eintragen

---

## 💻 **Entwicklungs-Workflow**

### **Setup**

1. **Fork** das Repository
   ```bash
   # Klicke auf "Fork" auf GitHub
   ```

2. **Clone** dein Fork
   ```bash
   git clone https://github.com/DEIN-USERNAME/WirkaufenFair.git
   cd WirkaufenFair
   ```

3. **Virtual Environment** erstellen
   ```bash
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1  # Windows
   # oder: source .venv/bin/activate  # Linux/Mac
   ```

4. **Dependencies** installieren
   ```bash
   pip install -r requirements.txt
   ```

5. **Server starten**
   ```bash
   python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
   ```

6. **Frontend öffnen**
   ```
   http://127.0.0.1:8000/static/shopping_list.html
   ```

### **Branch erstellen**

```bash
git checkout -b feature/mein-feature
# ODER
git checkout -b fix/mein-bugfix
```

**Branch-Naming:**
- `feature/` – Neue Features
- `fix/` – Bugfixes
- `docs/` – Dokumentation
- `refactor/` – Code-Refactoring
- `test/` – Tests

### **Code schreiben**

**Python (Backend):**
- PEP 8 Style Guide
- Type Hints nutzen (`def foo(bar: str) -> int:`)
- Docstrings für Funktionen
- Async/await für I/O
- SQLAlchemy ORM nutzen

**JavaScript (Frontend):**
- ES6+ Syntax
- Keine Semicolons (Prettier-Style)
- `const`/`let` statt `var`
- Arrow Functions bevorzugen
- Async/await statt Promises
- Kommentare für komplexe Logik

**HTML/CSS:**
- 4 Spaces Indent
- Semantic HTML (`<section>`, `<article>`, etc.)
- CSS Variables für Theming (`var(--text)`)
- Mobile-first Design

### **Testen**

**Manuell:**
```bash
# 1. Server starten
python -m uvicorn backend.app.main:app --reload

# 2. Frontend öffnen
# http://127.0.0.1:8000/static/shopping_list.html

# 3. Teste dein Feature:
- Laden auswählen
- Produkt hinzufügen
- Preis melden
- Export/Teilen
- Dark Mode Toggle
```

**Automatisch (TODO):**
```bash
pytest backend/tests/
```

### **Commit**

```bash
git add .
git commit -m "feat: Add barcode scanner"
```

**Commit-Messages:**
- `feat: ` – Neues Feature
- `fix: ` – Bugfix
- `docs: ` – Dokumentation
- `style: ` – Formatierung
- `refactor: ` – Code-Refactoring
- `test: ` – Tests
- `chore: ` – Build/Config

**Beispiele:**
```
feat: Add barcode scanner to product input
fix: Prevent duplicate products in list
docs: Update help page with new features
refactor: Split shopping_list_v2.js into modules
```

### **Push**

```bash
git push origin feature/mein-feature
```

### **Pull Request**

1. Gehe zu deinem Fork auf GitHub
2. Klicke "New Pull Request"
3. Beschreibe deine Änderungen:
   - **Was** hast du geändert?
   - **Warum** hast du es geändert?
   - **Wie** hast du es getestet?
   - **Screenshots** (falls UI-Änderung)
4. Klicke "Create Pull Request"

**PR-Template:**
```markdown
## Was wurde geändert?
- Feature X hinzugefügt
- Bug Y gefixt

## Warum?
Um Problem Z zu lösen

## Wie getestet?
- [x] Manuell getestet (Chrome, Firefox)
- [x] Keine Console-Errors
- [x] Dark Mode funktioniert
- [ ] Unit Tests (TODO)

## Screenshots
[Falls UI-Änderung]

## Checklist
- [x] Code folgt Style Guide
- [x] Dokumentation aktualisiert
- [x] Keine Breaking Changes
- [x] PR-Titel ist beschreibend
```

---

## 🎯 **Gute erste Issues**

Neu hier? Schau nach Issues mit dem Label:
- `good first issue` – Einfach für Anfänger
- `help wanted` – Wir brauchen Hilfe
- `documentation` – Dokumentation verbessern

---

## 🔍 **Code Review**

Jeder Pull Request wird reviewed:
- ✅ **Code-Qualität** – Lesbar, wartbar, idiomatisch
- ✅ **Tests** – Funktioniert das Feature?
- ✅ **Dokumentation** – Ist es dokumentiert?
- ✅ **Breaking Changes** – Wurde README aktualisiert?

**Review-Process:**
1. Maintainer reviewed deinen Code
2. Feedback in PR-Comments
3. Du passt Code an
4. Re-Review
5. Merge! 🎉

---

## 🛠️ **Technische Guidelines**

### **Backend (Python/FastAPI)**

**Neue API-Route hinzufügen:**
```python
# backend/app/main.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/api/v1/my-endpoint")
async def my_endpoint():
    return {"message": "Hello"}

# In main.py registrieren:
app.include_router(router)
```

**Datenbank-Modell:**
```python
# backend/app/models.py
from sqlalchemy import Column, Integer, String
from .database import Base

class MyModel(Base):
    __tablename__ = "my_table"
    
    id = Column(Integer, primary_key=True)
    name = Column(String)
```

### **Frontend (JavaScript)**

**Neue Funktion:**
```javascript
// frontend/assets/shopping_list_v2.js

/**
 * Beschreibung was die Funktion macht
 * @param {string} param - Beschreibung
 * @returns {boolean} Beschreibung
 */
async function myFunction(param) {
    try {
        const response = await fetch('/api/v1/endpoint')
        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error:', error)
        return null
    }
}
```

**Event Handler:**
```javascript
// In DOMContentLoaded
document.getElementById('my-button').addEventListener('click', () => {
    myFunction()
})
```

---

## 📚 **Ressourcen**

- **FastAPI Docs:** https://fastapi.tiangolo.com
- **SQLAlchemy Docs:** https://docs.sqlalchemy.org
- **OpenFoodFacts API:** https://world.openfoodfacts.org/data
- **MDN Web Docs:** https://developer.mozilla.org

---

## ❓ **Fragen?**

- **Discord:** (geplant)
- **Discussions:** https://github.com/chilla33/WirkaufenFair/discussions
- **Email:** kontakt@wirkaufenfair.de

---

## 🙏 **Danke!**

Jeder Beitrag hilft – egal ob klein oder groß. Gemeinsam machen wir fairen Einkauf einfacher! ❤️
