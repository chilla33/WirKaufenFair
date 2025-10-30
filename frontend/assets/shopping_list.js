// Shopping List
// Features: Pending item selection, Ethics scoring, Price totals, Compact UI

let selectedStore = '';
let shoppingList = [];
let pendingEditIndex = null; // if not null, confirm replaces item instead of push
let allProducts = [];
let pendingItem = null;
const useLiveOFF = true;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadStores();
    await loadAllProducts();

    const storeSelect = document.getElementById('store-select');
    const storeSearchInput = document.getElementById('store-search-input');
    const quantityInput = document.getElementById('quantity-input');
    const itemInput = document.getElementById('item-input');
    const addBtn = document.getElementById('add-btn');
    const clearBtn = document.getElementById('clear-btn');

    if (storeSelect) {
        storeSelect.addEventListener('change', (e) => {
            selectedStore = e.target.value;
            renderList();
        });
    } else if (storeSearchInput) {
        // When using the unified single-input store field, read selection from placeholder/localStorage
        try {
            const persisted = localStorage.getItem('wirkaufenfair_store');
            if (persisted) {
                selectedStore = persisted;
            }
        } catch (e) { /* ignore */ }
    }

    addBtn.addEventListener('click', () => addItem());
    itemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem();
    });
    quantityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') itemInput.focus();
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
        if (confirm('Einkaufsliste wirklich leeren?')) {
            shoppingList = [];
            renderList();
        }
        });
    }

    setupItemAutocomplete(itemInput);
});

async function loadStores() {
    try {
        const res = await fetch('/api/v1/product_locations');
        const data = await res.json();
        allProducts = Array.isArray(data) ? data : [];

        const staticStores = ['REWE', 'EDEKA', 'ALDI', 'LIDL', 'PENNY', 'NETTO', 'dm', 'ROSSMANN'];
        const dbStores = [...new Set(allProducts.map(p => p.store_name))];
        let stores = [...new Set([...staticStores, ...dbStores])].filter(Boolean).sort();

        const select = document.getElementById('store-select');
        if (select) {
            stores.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store;
                opt.textContent = store;
                select.appendChild(opt);
            });
        } else {
            // no select present (single-input UI); nothing to append
        }
    } catch (err) {
        console.error('Error loading stores:', err);
    }
}

async function loadAllProducts() {
    // Already loaded in loadStores
}

// ===== AUTOCOMPLETE =====
// ===== OFF API =====
// Minimal delegators: call window-provided helpers from the dedicated OFF module.
// No local fallbacks are kept here to reduce file size and ensure a single source of truth.
const fetchOffProducts = async (query, limit = 20, maxResults = null) => {
    if (typeof window !== 'undefined' && typeof window.fetchOffProducts === 'function' && window.fetchOffProducts !== fetchOffProducts) {
        return await window.fetchOffProducts(query, limit, maxResults);
    }
    // If the module isn't loaded yet or it points back to this delegator, bail out.
    console.error('fetchOffProducts is not available or would call itself');
    return [];
};

const fetchOffProductByBarcode = async (barcode) => {
    if (typeof window !== 'undefined' && typeof window.fetchOffProductByBarcode === 'function' && window.fetchOffProductByBarcode !== fetchOffProductByBarcode) {
        return await window.fetchOffProductByBarcode(barcode);
    }
    console.error('fetchOffProductByBarcode is not available or would call itself');
    return null;
};

const enrichLocalProductsWithOFF = async (scoredLocal) => {
    if (typeof window !== 'undefined' && typeof window.enrichLocalProductsWithOFF === 'function' && window.enrichLocalProductsWithOFF !== enrichLocalProductsWithOFF) {
        return await window.enrichLocalProductsWithOFF(scoredLocal, useLiveOFF);
    }
    // no-op when not provided or would recurse
    return;
};

// ===== MATCHING & SCORING =====
const SYNONYMS = {
    'milch': ['milch', 'vollmilch', 'frischmilch', 'h-milch'],
    'joghurt': ['joghurt', 'jogurt', 'yogurt', 'yoghurt'],
    'käse': ['käse', 'cheese', 'gouda', 'emmentaler'],
    'brot': ['brot', 'bread', 'vollkornbrot', 'toast']
};

const CATEGORIES = {
    'obst': ['apfel', 'birne', 'banane', 'orange', 'erdbeere'],
    'gemüse': ['tomate', 'gurke', 'paprika', 'salat', 'möhre', 'kartoffel'],
    'milchprodukte': ['milch', 'joghurt', 'käse', 'quark', 'sahne', 'butter'],
    'fleisch': ['rind', 'schwein', 'hähnchen', 'huhn', 'pute', 'wurst'],
    'getränke': ['wasser', 'saft', 'limonade', 'cola', 'tee', 'kaffee', 'bier']
};

const BRANDS = ['danone', 'müller', 'arla', 'weihenstephan', 'alpro', 'oatly', 'nestlé', 'coca-cola'];
const STOP_WORDS = new Set(['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem', 'und', 'oder', 'mit', 'ohne', 'für', 'zum', 'zur', 'von', 'im', 'in', 'auf', 'an', 'am', 'zu', 'bei']);
const UNIT_WORDS = ['g', 'kg', 'ml', 'l', 'liter', 'st', 'stk', 'stück', 'x', 'pack', 'packung'];

function stripQuantities(text) {
    return (text || '')
        .toLowerCase()
        .replace(/\d+[\,\.]?\d*\s*(g|kg|ml|l|liter|st|stk|x)\b/g, ' ')
        .replace(/\b\d+x\b/g, ' ')
        .replace(/\b\d+[\,\.]?\d*\b/g, ' ')
        .replace(/[^a-zäöüß\s]/g, ' ');
}

function getCoreQueryTokens(query) {
    const cleaned = stripQuantities(query);
    const tokens = cleaned.split(/\s+/).filter(t => t && t.length >= 3 && !STOP_WORDS.has(t));
    return tokens;
}

const GRADE_SCORE = { 'A': 1.0, 'B': 0.8, 'C': 0.6, 'D': 0.4, 'E': 0.2 };

function computeFairScore(product, source) {
    const eco = (product.ecoscore || product.ecoscore_grade || '').toString().toUpperCase();
    const nutri = (product.nutriscore || product.nutriscore_grade || '').toString().toUpperCase();
    const ecoScore = GRADE_SCORE[eco] || 0;
    const nutriScore = GRADE_SCORE[nutri] || 0;
    const ethicsScore = product.ethics_score || 0.6;
    const verifiedBoost = product.status === 'verified' ? 0.05 : 0;
    const localBoost = source === 'local' ? 0.03 : 0;

    return (ecoScore * 0.4) + (ethicsScore * 0.3) + (nutriScore * 0.2) + verifiedBoost + localBoost;
}

function deduplicateCandidates(candidates) {
    const groups = new Map();

    for (const cand of candidates) {
        const p = cand.product;
        const barcode = p.barcode || '';
        const normalizedName = normalizeProductName(p.product_identifier || p.product_name || '');
        const key = barcode || normalizedName;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(cand);
    }

    const deduped = [];
    for (const items of groups.values()) {
        // Choose best purely by score first (no local bias)
        items.sort((a, b) => b.score - a.score);

        const best = items[0];

        if (items.length > 1) {
            const local = items.find(i => i.source === 'local');
            const off = items.find(i => i.source === 'off');

            if (local && off) {
                if (!local.product.ecoscore && off.product.ecoscore) {
                    local.product.ecoscore = off.product.ecoscore;
                    local.product.ecoscore_grade = off.product.ecoscore_grade;
                }
                if (!local.product.nutriscore && off.product.nutriscore) {
                    local.product.nutriscore = off.product.nutriscore;
                    local.product.nutriscore_grade = off.product.nutriscore_grade;
                }
                if (!local.product.image_url && off.product.image_url) {
                    local.product.image_url = off.product.image_url;
                }
                if (!local.product.ethics_score && off.product.ethics_score) {
                    local.product.ethics_score = off.product.ethics_score;
                    local.product.ethics_issues = off.product.ethics_issues;
                }
            }
        }

        deduped.push(best);
    }

    return deduped;
}

function normalizeProductName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '');
}

function calculateUnitPrice(product) {
    const price = product.current_price || product.estimated_price;
    if (!price) return null;

    const amount = product.size_amount;
    const unit = (product.size_unit || '').toLowerCase();

    if (!amount || !unit) return null;

    if (unit === 'g' || unit === 'kg') {
        const kg = unit === 'g' ? amount / 1000 : amount;
        return { value: price / kg, unit: 'kg', display: `${(price / kg).toFixed(2)} €/kg` };
    } else if (unit === 'ml' || unit === 'l') {
        const l = unit === 'ml' ? amount / 1000 : amount;
        return { value: price / l, unit: 'l', display: `${(price / l).toFixed(2)} €/L` };
    }

    return null;
}

function expandQueryWithSynonyms(query) {
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);
    const expanded = new Set([q]);

    words.forEach(word => {
        for (const [key, synonyms] of Object.entries(SYNONYMS)) {
            if (word === key || synonyms.includes(word)) {
                expanded.add(key);
                synonyms.forEach(syn => expanded.add(syn));
            }
        }
    });

    return Array.from(expanded).filter(x => x !== q);
}

function expandQueryWithCategories(query) {
    const q = query.toLowerCase().trim();
    const expanded = new Set();

    for (const [category, items] of Object.entries(CATEGORIES)) {
        if (items.includes(q) || q.includes(category)) {
            items.forEach(item => expanded.add(item));
        }
    }

    return Array.from(expanded);
}

function brandBoost(query, targetProduct) {
    const q = query.toLowerCase();
    const t = targetProduct.toLowerCase();

    for (const brand of BRANDS) {
        if (q.includes(brand) && t.includes(brand)) {
            return 0.2;
        }
    }
    return 0;
}

function fuzzyMatch(query, target, threshold = 0.6) {
    const q = query.toLowerCase().trim();
    const t = target.toLowerCase().trim();

    if (t.includes(q)) return 1.0;

    const qWords = q.split(/\s+/);
    const tWords = t.split(/\s+/);

    if (qWords.length === 1 && tWords.some(w => w === q)) {
        return 0.95;
    }

    const multiScore = multiTokenMatch(q, t);
    if (multiScore >= 0.7) return multiScore;

    const distance = levenshteinDistance(q, t);
    const maxLen = Math.max(q.length, t.length);
    const similarity = 1 - (distance / maxLen);

    return similarity >= Math.max(threshold, 0.7) ? similarity : 0;
}

function multiTokenMatch(query, target) {
    const qTokens = query.toLowerCase().trim().split(/\s+/);
    const tTokens = target.toLowerCase().trim().split(/\s+/);

    let matchCount = 0;
    for (const qt of qTokens) {
        if (tTokens.some(tt => tt.includes(qt) || qt.includes(tt))) {
            matchCount++;
        }
    }

    return matchCount / qTokens.length;
}

function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

function parseQuantity(quantityStr) {
    if (!quantityStr) return null;
    const match = quantityStr.trim().match(/^([\d.,]+)\s*(g|kg|ml|l|x|stück|st)?$/i);
    if (!match) return null;

    let amount = parseFloat(match[1].replace(',', '.'));
    let unit = (match[2] || 'x').toLowerCase();

    if (unit === 'kg') { amount *= 1000; unit = 'g'; }
    if (unit === 'l') { amount *= 1000; unit = 'ml'; }
    if (unit === 'stück' || unit === 'st') { unit = 'x'; }

    return { amount, unit };
}

function extractProductQuantity(product) {
    if (product.size_amount && product.size_unit) {
        let amount = product.size_amount;
        let unit = product.size_unit.toLowerCase();

        if (unit === 'kg') { amount *= 1000; unit = 'g'; }
        if (unit === 'l') { amount *= 1000; unit = 'ml'; }
        if (unit === 'stück' || unit === 'st') { unit = 'x'; }

        return { amount, unit };
    }

    const quantity = product.quantity || '';
    const match = quantity.match(/([\d.,]+)\s*(g|kg|ml|l|cl|dl)/i);
    if (!match) return null;

    let amount = parseFloat(match[1].replace(',', '.'));
    let unit = match[2].toLowerCase();

    if (unit === 'kg') { amount *= 1000; unit = 'g'; }
    if (unit === 'l') { amount *= 1000; unit = 'ml'; }
    if (unit === 'cl') { amount *= 10; unit = 'ml'; }
    if (unit === 'dl') { amount *= 100; unit = 'ml'; }

    return { amount, unit };
}

function calculateOptimalQuantity(needed, productQty) {
    if (!needed || !productQty) return null;
    if (needed.unit !== productQty.unit) return null;

    const count = Math.ceil(needed.amount / productQty.amount);
    const totalAmount = count * productQty.amount;

    return { count, totalAmount, unit: needed.unit };
}

function formatUnit(amount, unit) {
    if (!unit) return amount.toString();
    if (unit === 'g' && amount >= 1000) {
        return `${(amount / 1000).toFixed(2)} kg`;
    }
    if (unit === 'ml' && amount >= 1000) {
        return `${(amount / 1000).toFixed(2)} L`;
    }
    return `${amount} ${unit}`;
}

// ===== AUTOCOMPLETE =====
function setupItemAutocomplete(inputEl) {
    const acEl = document.getElementById('item-autocomplete');
    if (!inputEl || !acEl) return;

    let acAbort = null;

    const hide = () => {
        acEl.style.display = 'none';
        acEl.innerHTML = '';
    };

    const show = (html) => {
        acEl.innerHTML = html;
        acEl.style.display = 'block';
    };

    const fetchSuggestions = async (q) => {
        if (acAbort) acAbort.abort();
        const ctrl = new AbortController();
        acAbort = ctrl;
        try {
            const url = `/api/v1/openfoodfacts/autocomplete?query=${encodeURIComponent(q)}&limit=8`;
            const res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) throw new Error('ac failed');
            return await res.json();
        } catch (e) {
            return [];
        }
    };

    inputEl.addEventListener('input', async () => {
        const q = inputEl.value.trim();
        if (q.length < 2) { hide(); return; }
        const items = await fetchSuggestions(q);
        if (!items || items.length === 0) { hide(); return; }
        const html = items.map(it => `
            <div class="ac-item" data-title="${(it.display || '').replace(/"/g, '&quot;')}">
                ${it.image_url ? `<img src="${it.image_url}" onerror="this.style.display='none'" alt="" style="width:40px;height:40px;border-radius:4px;object-fit:cover;">` : '<div style="width:40px;height:40px;border-radius:4px;background:var(--input-bg);display:flex;align-items:center;justify-content:center;">📦</div>'}
                <div>
                    <div class="ac-title">${it.display || ''}</div>
                    ${it.barcode ? `<div class="ac-sub">${it.barcode}</div>` : ''}
                </div>
            </div>
        `).join('');
        show(html);
    });

    acEl.addEventListener('mousedown', (e) => {
        const item = e.target.closest('.ac-item');
        if (!item) return;
        const title = item.getAttribute('data-title') || '';
        inputEl.value = title;
        hide();
    });

    document.addEventListener('click', (e) => {
        if (!acEl.contains(e.target) && e.target !== inputEl) hide();
    });
}

// ===== OFF API =====
// Delegate to window.fetchOffProducts provided by modules/off-api.js when available.
// Delegators for OFF helpers are defined above as consts; no duplicates here.

// ===== PENDING ITEM WORKFLOW =====
function addItem() {
    const quantityInput = document.getElementById('quantity-input');
    const itemInput = document.getElementById('item-input');

    const quantityStr = quantityInput.value.trim();
    const query = itemInput.value.trim();

    if (!query) return;
    if (!selectedStore) {
        // Do not block adding items when no store selected. Persist under a general list key.
        console.warn('Kein Laden ausgewählt — Artikel wird unter Allgemein gespeichert');
    }

    const needed = parseQuantity(quantityStr);

    pendingItem = {
        query,
        needed,
        matched: null,
        matchScore: 0,
        matchedSource: null,
        calculation: null,
        suggestions: []
    };

    quantityInput.value = '';
    itemInput.value = '';

    showPendingSelection();
}

async function showPendingSelection() {
    const container = document.getElementById('pending-selection');
    const detailsDiv = document.getElementById('pending-item-details');
    const suggestionsDiv = document.getElementById('pending-suggestions');

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    let qtyDisplay = '';
    if (pendingItem.needed) {
        qtyDisplay = `<strong>${formatUnit(pendingItem.needed.amount, pendingItem.needed.unit)}</strong> `;
    }
    detailsDiv.innerHTML = `
        <div style="font-size:18px;font-weight:600;color:var(--accent);">
            ${qtyDisplay}${pendingItem.query}
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Suche passende Produkte...</div>
    `;

    await matchSingleItem(pendingItem);
    // If we came from editing, keep the previously selected product highlighted when possible
    if (pendingItem && pendingItem._originalMatched) {
        const original = pendingItem._originalMatched;
        const found = pendingItem.suggestions.find(s => {
            const p = s.product;
            return (original.id && p.id && original.id === p.id) ||
                (original.barcode && p.barcode && original.barcode === p.barcode) ||
                ((original.product_identifier || original.product_name) === (p.product_identifier || p.product_name));
        });
        if (found) {
            pendingItem.matched = found.product;
            pendingItem.matchScore = found.score;
            pendingItem.matchedSource = found.source;
        }
    }
    renderPendingSuggestions();
}

async function matchSingleItem(item) {
    // Build core tokens from the user's query (strip quantities and stopwords)
    const coreTokens = getCoreQueryTokens(item.query);
    console.log('Core tokens:', coreTokens);

    // Build anchor terms = tokens + their synonyms so we don't miss e.g. joghurt ~ yogurt
    const anchorTerms = new Set(coreTokens);
    coreTokens.forEach(t => {
        expandQueryWithSynonyms(t).forEach(s => anchorTerms.add(s));
    });
    const anchorList = Array.from(anchorTerms);
    console.log('Anchor terms (with synonyms):', anchorList);

    const expandedQueries = [
        ...coreTokens,
        ...coreTokens.flatMap(t => expandQueryWithSynonyms(t)),
        ...coreTokens.flatMap(t => expandQueryWithCategories(t))
    ].filter((v, i, a) => v && a.indexOf(v) === i);
    console.log('Expanded queries:', expandedQueries);

    const localProducts = allProducts.filter(p => p.store_name === selectedStore);
    const scoredLocal = localProducts.map(p => {
        const identifier = p.product_identifier || p.product_name || '';
        const idLower = identifier.toLowerCase();
        // Instead of dropping local products lacking anchors, mark whether an anchor exists
        const anchorLower = anchorList.map(a => a.toLowerCase());
        let matchedField = null;
        try {
            for (const a of anchorLower) {
                if (!a) continue;
                if (identifier && identifier.toLowerCase().includes(a)) { matchedField = 'identifier'; break; }
                if (p.brands && p.brands.toLowerCase().includes(a)) { matchedField = 'brands'; break; }
            }
        } catch (e) { matchedField = null; }
        p.__matchedField = matchedField;
        let maxScore = 0;
        expandedQueries.forEach(q => {
            const score = fuzzyMatch(q, identifier, 0.6);
            if (score > maxScore) maxScore = score;
        });
        const boost = brandBoost(item.query, identifier);
        maxScore = Math.min(1.0, maxScore + boost + 0.15);
        return { product: p, score: maxScore, source: 'local' };
    }).filter(m => m.score > 0.65); // keep good local matches

    // Enriche local products with OFF data via barcode lookup
    await enrichLocalProductsWithOFF(scoredLocal);

    let candidates = [...scoredLocal];
    const bestLocal = scoredLocal.length ? Math.max(...scoredLocal.map(s => s.score)) : 0;

    // IMMER OFF holen für vollständige Daten (Eco/Nutri-Scores)
    // Auch wenn lokale Ergebnisse gut sind - für Vergleich und Vollständigkeit
    const needOff = useLiveOFF && (
        scoredLocal.length < 5 ||           // Weniger als 5 lokale Produkte
        bestLocal < 0.85 ||                 // Bestes lokales Match nicht perfekt
        scoredLocal.some(s => !s.product.ecoscore && !s.product.nutriscore) // Fehlende Scores
    );

    if (needOff) {
        try {
            console.log(`Fetching OFF products for query: "${item.query}"`);
            // Request up to 150 aggregated OFF products server-side (helps matching breadth)
            const offProducts = await fetchOffProducts(item.query, 30, 150);
            console.log(`OFF returned ${offProducts.length} products`);

            const scoredOff = offProducts.map(p => {
                const identifier = p.product_identifier || p.product_name || '';
                const idLower = identifier.toLowerCase();
                // Do not filter out products for missing anchors. Instead mark whether a strict anchor
                // exists in key fields (product_name/product_name_de/generic_name/brands) for diagnostics.
                const anchorLower = anchorList.map(a => a.toLowerCase());
                let matchedField = null;
                try {
                    for (const a of anchorLower) {
                        if (!a) continue;
                        if (p.product_name && p.product_name.toLowerCase().includes(a)) { matchedField = 'product_name'; break; }
                        if (p.product_name_de && p.product_name_de.toLowerCase().includes(a)) { matchedField = 'product_name_de'; break; }
                        if (p.generic_name && p.generic_name.toLowerCase().includes(a)) { matchedField = 'generic_name'; break; }
                        if (p.brands && p.brands.toLowerCase().includes(a)) { matchedField = 'brands'; break; }
                    }
                } catch (e) { matchedField = null; }
                p.__matchedField = matchedField;
                let maxScore = 0;
                expandedQueries.forEach(q => {
                    const score = fuzzyMatch(q, identifier, 0.7);
                    if (score > maxScore) maxScore = score;
                });
                const boost = brandBoost(item.query, identifier);
                maxScore = Math.min(1.0, maxScore + boost);
                if (maxScore > 0.70) {
                    console.log(`  ✓ Kept (score ${maxScore.toFixed(2)}): ${identifier}`);
                }
                return { product: p, score: maxScore, source: 'off' };
            });
            console.log(`After scoring, ${scoredOff.length} OFF products scored (no hard filter applied)`);
            // Keep scored OFF products (do not aggressively filter here); let later ranking decide.
            candidates = candidates.concat(scoredOff);
        } catch (e) {
            console.error('OFF fetch failed:', e);
        }
    } else {
        console.log('Skipping OFF fetch:', { localCount: scoredLocal.length, bestLocal, needOff });
    }

    candidates.sort((a, b) => b.score - a.score);

    // Do not drop candidates by an arbitrary score threshold here; dedupe then compute fair/combined
    const deduped = deduplicateCandidates(candidates);

    deduped.forEach(c => {
        c.fairScore = computeFairScore(c.product, c.source);
        c.combinedScore = (c.score * 0.6) + (c.fairScore * 0.4);

        // Boost für vollständige Produktdaten (Eco + Nutri vorhanden)
        const hasEco = c.product.ecoscore || c.product.ecoscore_grade;
        const hasNutri = c.product.nutriscore || c.product.nutriscore_grade;
        if (hasEco && hasNutri) {
            c.combinedScore += 0.05; // +5% Bonus für vollständige Daten
        }
    });

    const sorted = [...deduped].sort((a, b) => b.combinedScore - a.combinedScore);

    // Mindestens 3 Produkte anstreben, sonst Warnung
    const minProducts = 3;
    item.suggestions = sorted.slice(0, Math.max(minProducts, Math.min(8, sorted.length)));

    if (item.suggestions.length < minProducts) {
        console.warn(`Nur ${item.suggestions.length} Produkte für "${item.query}" gefunden (Minimum: ${minProducts})`);
    }

    // Load ratings and best prices for all suggestions
    await enrichSuggestionsWithRatingsAndPrices(item.suggestions);

    if (item.suggestions.length > 0) {
        const bestSug = item.suggestions[0];
        item.matched = bestSug.product;
        item.matchScore = bestSug.score;
        item.matchedSource = bestSug.source;

        if (item.needed) {
            const productQty = extractProductQuantity(item.matched);
            if (productQty) {
                item.calculation = calculateOptimalQuantity(item.needed, productQty);
            }
        }
    }
}

async function enrichSuggestionsWithRatingsAndPrices(suggestions) {
    const promises = suggestions.map(async (sug) => {
        const p = sug.product;
        const pid = p.barcode || p.product_identifier || p.product_name;
        if (!pid) return;

        // Load rating stats
        try {
            const ratingUrl = `/api/v1/ratings/stats?product_identifier=${encodeURIComponent(pid)}${selectedStore ? '&store_name=' + encodeURIComponent(selectedStore) : ''}`;
            const ratingRes = await fetch(ratingUrl);
            if (ratingRes.ok) {
                p._ratingStats = await ratingRes.json();
            }
        } catch (e) {
            console.warn('Failed to load ratings:', e);
        }

        // Load best price if not already set
        if (!p.current_price && selectedStore) {
            try {
                const priceUrl = `/api/v1/price_reports/best_price?product_identifier=${encodeURIComponent(pid)}&store_name=${encodeURIComponent(selectedStore)}`;
                const priceRes = await fetch(priceUrl);
                if (priceRes.ok) {
                    const priceData = await priceRes.json();
                    if (priceData.price) {
                        p._bestPrice = priceData;
                        p.current_price = priceData.price; // Use for calculations
                    }
                }
            } catch (e) {
                console.warn('Failed to load best price:', e);
            }
        }
    });
    await Promise.all(promises);
}

function renderPendingSuggestions() {
    const suggestionsDiv = document.getElementById('pending-suggestions');
    const detailsDiv = document.getElementById('pending-item-details');

    if (!pendingItem.suggestions || pendingItem.suggestions.length === 0) {
        suggestionsDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">❌ Keine passenden Produkte gefunden</div>';
        detailsDiv.innerHTML = `
            <div style="font-size:18px;font-weight:600;color:var(--danger);">
                ${pendingItem.query}
            </div>
            <div style="font-size:13px;color:var(--danger);margin-top:4px;">Keine Produkte gefunden</div>
        `;
        return;
    }

    let qtyDisplay = '';
    if (pendingItem.needed && pendingItem.calculation) {
        qtyDisplay = `<strong>Benötigt: ${formatUnit(pendingItem.needed.amount, pendingItem.needed.unit)}</strong> → Kaufe ${pendingItem.calculation.count}x`;
    } else if (pendingItem.needed) {
        qtyDisplay = `<strong>${formatUnit(pendingItem.needed.amount, pendingItem.needed.unit)}</strong>`;
    }

    detailsDiv.innerHTML = `
        <div style="font-size:16px;font-weight:600;color:var(--accent);">
            ${qtyDisplay ? qtyDisplay + ' ' : ''}${pendingItem.query}
        </div>
        <div style="font-size:13px;color:var(--success);margin-top:4px;">✓ ${pendingItem.suggestions.length} Produkt(e) gefunden</div>
    `;

        suggestionsDiv.innerHTML = `
        <div style="font-size:14px;color:var(--text-muted);margin-bottom:8px;">
            Wähle ein Produkt aus (beste Treffer zuerst):
        </div>
        ${pendingItem.suggestions.map((sug, idx) => renderPendingSuggestionRow(sug, idx)).join('')}
    `;

    // NOTE: No need to add event listeners here because we use onclick in HTML
}

function renderPendingSuggestionRow(sug, idx) {
    const p = sug.product;
    // Check if this product is the currently selected one
    // Use strict comparison and ensure we're comparing the same product instance
    let isSelected = false;
    if (pendingItem.matched) {
        // Try multiple comparison methods
        if (pendingItem.matched.id && p.id && pendingItem.matched.id === p.id) {
            isSelected = true;
        } else if (pendingItem.matched.barcode && p.barcode && pendingItem.matched.barcode === p.barcode) {
            isSelected = true;
        } else {
            // Fallback: compare product identifiers exactly
            const matchedName = pendingItem.matched.product_identifier || pendingItem.matched.product_name || '';
            const pName = p.product_identifier || p.product_name || '';
            if (matchedName && pName && matchedName === pName && pendingItem.matched.source === sug.source) {
                isSelected = true;
            }
        }
    }

    const source = sug.source === 'local' ? 'Lokal' : 'OFF';
    const eco = (p.ecoscore || p.ecoscore_grade || '').toString().toUpperCase();
    const nutri = (p.nutriscore || p.nutriscore_grade || '').toString().toUpperCase();
    const ecoBadge = eco ? `<span style="background:rgba(14,165,164,0.06);color:var(--accent);padding:2px 6px;border-radius:4px;font-size:11px;">Eco ${eco}</span>` : '';
    const nutriBadge = nutri ? `<span style="background:rgba(16,185,129,0.06);color:var(--success);padding:2px 6px;border-radius:4px;font-size:11px;">Nutri ${nutri}</span>` : '';

    let ethicsBadge = '';
    if (p.ethics_score != null) {
        const ethicsScore = p.ethics_score;
        let ethicsColor, ethicsLabel, ethicsTitle;
        if (ethicsScore >= 0.75) {
            ethicsColor = 'var(--success)'; ethicsLabel = 'Fair ✓'; ethicsTitle = 'Gute ethische Bewertung';
        } else if (ethicsScore >= 0.5) {
            ethicsColor = 'var(--muted)'; ethicsLabel = 'OK'; ethicsTitle = 'Neutrale ethische Bewertung';
        } else {
            ethicsColor = 'var(--danger)'; ethicsLabel = 'Kritisch'; ethicsTitle = 'Ethische Bedenken';
        }
        if (p.ethics_issues && p.ethics_issues.length > 0) {
            ethicsTitle += ':\\n' + p.ethics_issues.join('\\n');
        }
        ethicsBadge = `<span style="background:${ethicsColor};color:white;padding:2px 6px;border-radius:4px;font-size:11px;cursor:help;" title="${ethicsTitle}">${ethicsLabel}</span>`;
    }

    // Community rating badge
    let ratingBadge = '';
    if (p._ratingStats && p._ratingStats.total_ratings > 0) {
        const avg = p._ratingStats.average_rating;
        const stars = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
        ratingBadge = `<span style="background:rgba(245,158,11,0.08);color:var(--muted);padding:2px 6px;border-radius:4px;font-size:11px;cursor:help;" title="${avg.toFixed(1)}/5 aus ${p._ratingStats.total_ratings} Bewertungen">${stars} (${p._ratingStats.total_ratings})</span>`;
    }

    const matchQuality = sug.score >= 0.9 ? '🟢' : sug.score >= 0.75 ? '🟡' : '🟠';

    let priceDisplay = '';
    if (p.current_price != null) {
        priceDisplay = `${p.current_price.toFixed(2)} €`;
    } else if (p.estimated_price != null) {
        priceDisplay = `≈ ${p.estimated_price.toFixed(2)} €`;
    } else if (p._bestPrice && p._bestPrice.price != null) {
        const verified = p._bestPrice.verified ? '' : '≈ ';
        const votes = p._bestPrice.upvotes ? ` (✓${p._bestPrice.upvotes})` : '';
        priceDisplay = `${verified}${p._bestPrice.price.toFixed(2)} €${votes}`;
    }

    const unitPrice = calculateUnitPrice(p);
    if (unitPrice && priceDisplay) {
        priceDisplay += ` <span style="color:var(--text-muted);font-size:10px;">(${unitPrice.display})</span>`;
    }

    const qty = p.size_amount && p.size_unit ? ` • ${p.size_amount} ${p.size_unit}` : '';

    let imageHtml = '';
    if (p.image_url) {
        imageHtml = `<img src="${p.image_url}" style="width:64px;height:64px;min-width:64px;border-radius:8px;object-fit:cover;border:2px solid var(--border);pointer-events:none;" onerror="this.style.display='none'" loading="lazy" alt="${p.product_name || 'Produktbild'}">`;
    } else {
        imageHtml = `<div style="width:64px;height:64px;min-width:64px;border-radius:8px;background:var(--input-bg);display:flex;align-items:center;justify-content:center;font-size:28px;pointer-events:none;">📦</div>`;
    }

    const borderColor = isSelected ? 'var(--success)' : 'var(--border)';
    const bgColor = isSelected ? 'rgba(16,185,129,0.06)' : 'var(--input-bg)';
    const selectedClass = isSelected ? 'selected' : '';

    return `
        <div class="pending-product-card ${selectedClass}" data-index="${idx}" data-is-selected="${isSelected}"
             onclick="window.selectPendingProduct(${idx})"
             style="display:flex;align-items:center;gap:12px;padding:12px;border:2px solid ${borderColor};border-radius:8px;margin-top:8px;background:${bgColor};cursor:pointer;transition:all 0.2s;">
            ${imageHtml}
            <div style="flex:1;min-width:0;pointer-events:none;">
                <div style="font-weight:600;color:var(--text);word-break:break-word;display:flex;align-items:center;gap:6px;">
                    <span title="Match-Qualität">${matchQuality}</span>
                    ${p.product_identifier || p.product_name || ''}
                    ${isSelected ? '<span style="background:var(--success);color:white;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:8px;">✓ Ausgewählt</span>' : ''}
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                    ${source}${qty} ${priceDisplay ? `• ${priceDisplay}` : ''} ${ecoBadge} ${nutriBadge} ${ethicsBadge} ${ratingBadge}
                </div>
            </div>
        </div>
    `;
}

window.selectPendingProduct = function (idx) {
    if (!pendingItem) return;

    const sug = pendingItem.suggestions[idx];
    if (!sug) return;

    pendingItem.matched = sug.product;
    pendingItem.matchScore = sug.score;
    pendingItem.matchedSource = sug.source;

    if (pendingItem.needed) {
        const productQty = extractProductQuantity(sug.product);
        if (productQty) {
            pendingItem.calculation = calculateOptimalQuantity(pendingItem.needed, productQty);
        }
    }

    // Update UI immediately: Reset all cards, then highlight selected
    const cards = document.querySelectorAll('.pending-product-card');

    cards.forEach((card, i) => {
        if (i === idx) {
            // Selected card
            card.setAttribute('data-is-selected', 'true');
            card.style.borderColor = 'var(--success)';
            card.style.background = 'rgba(16,185,129,0.06)';
        } else {
            // Unselected cards
            card.setAttribute('data-is-selected', 'false');
            card.style.borderColor = 'var(--border)';
            card.style.background = 'var(--input-bg)';
        }
    });

    // Update badges without full re-render
    cards.forEach((card, i) => {
        const contentDiv = card.querySelector('div[style*="flex:1"]');
        const titleDiv = contentDiv?.querySelector('div:first-child');
        if (!titleDiv) return;

        // Remove existing "Ausgewählt" badge
        const existingBadges = titleDiv.querySelectorAll('span');
        existingBadges.forEach(badge => {
            if (badge.textContent.includes('Ausgewählt')) {
                badge.remove();
            }
        });

        // Add badge to selected card
        if (i === idx) {
            const badge = document.createElement('span');
            badge.style.cssText = 'background:var(--success);color:white;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:8px;';
            badge.textContent = '✓ Ausgewählt';
            titleDiv.appendChild(badge);
        }
    });
}; window.confirmPendingItem = function () {
    if (!pendingItem || !pendingItem.matched) {
        alert('Bitte wähle ein Produkt aus!');
        return;
    }

    const itemData = { ...pendingItem };

    if (pendingEditIndex !== null) {
        shoppingList[pendingEditIndex] = itemData;
        pendingEditIndex = null;
    } else {
        shoppingList.push(itemData);
    }

    pendingItem = null;
    document.getElementById('pending-selection').style.display = 'none';

    renderList();
};

window.cancelPendingItem = function () {
    pendingItem = null;
    pendingEditIndex = null;
    document.getElementById('pending-selection').style.display = 'none';
};

// ===== SHOPPING LIST RENDERING (COMPACT) =====
function removeItem(index) {
    shoppingList.splice(index, 1);
    renderList();
}

window.editShoppingItem = async function (index) {
    const base = shoppingList[index];
    if (!base) return;
    pendingEditIndex = index;
    // Prepare pending item seeded from existing
    pendingItem = {
        query: base.query,
        needed: base.needed || null,
        matched: base.matched || null,
        _originalMatched: base.matched || null,
        matchedSource: base.matchedSource || null,
        matchScore: base.matchScore || 0,
        calculation: base.calculation || null,
        suggestions: []
    };
    showPendingSelection();
}

function changeItemCount(index, delta) {
    const it = shoppingList[index];
    if (!it) return;
    if (!it.calculation) {
        it.calculation = { count: 1 };
    }
    it.calculation.count = Math.max(1, (it.calculation.count || 1) + delta);
    renderList();
}

function setItemNotes(index, notes) {
    const it = shoppingList[index];
    if (!it) return;
    it.notes = notes;
}

function setItemRating(index, rating) {
    const it = shoppingList[index];
    if (!it) return;
    it.rating = rating;
    // Persist locally per product
    const key = 'ratings';
    const ratings = JSON.parse(localStorage.getItem(key) || '{}');
    const pid = (it.matched && (it.matched.barcode || it.matched.product_identifier || it.matched.product_name)) || it.query;
    ratings[pid] = rating;
    localStorage.setItem(key, JSON.stringify(ratings));
}

async function submitPrice(index) {
    const it = shoppingList[index];
    if (!it || !it.matched) return;
    const inputEl = document.getElementById(`price-input-${index}`);
    if (!inputEl) return;
    const price = parseFloat(inputEl.value);
    if (!price || price <= 0) {
        alert('Bitte gib einen gültigen Preis ein!');
        return;
    }

    const matched = it.matched;
    const pid = matched.barcode || matched.product_identifier || matched.product_name;

    try {
        const res = await fetch('/api/v1/price_reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_identifier: pid,
                store_name: selectedStore,
                reported_price: price,
                size_amount: matched.size_amount || null,
                size_unit: matched.size_unit || null
            })
        });

        if (res.ok) {
            alert('✓ Preis gemeldet! Andere können ihn jetzt bestätigen.');
            inputEl.value = '';
            // Reload list to fetch updated price
            renderList();
        } else {
            alert('Fehler beim Melden des Preises.');
        }
    } catch (e) {
        console.error('Price submit error:', e);
        alert('Fehler beim Melden des Preises.');
    }
}

async function renderList() {
    const container = document.getElementById('list-container');
    const countBadge = document.getElementById('item-count');

    countBadge.textContent = shoppingList.length;

    if (shoppingList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>📝 Deine Einkaufsliste ist leer.</p>
                <p>Wähle einen Laden und füge Artikel hinzu!</p>
            </div>
        `;
        renderTotalSummary();
        return;
    }

    if (!selectedStore) {
        container.innerHTML = `
            <div class="empty-state">
                <p>🏪 Bitte wähle zuerst einen Laden aus.</p>
            </div>
        `;
        renderTotalSummary();
        return;
    }

    container.innerHTML = shoppingList.map((item, i) => {
        const matched = item.matched;
        const matchedClass = matched ? 'matched' : '';

        // Image
        let imageHtml = '';
        if (matched && matched.image_url) {
            imageHtml = `<img src="${matched.image_url}" class="list-item-image" onerror="this.style.display='none'" alt="Produktbild" />`;
        } else {
            imageHtml = `<div class="list-item-image-placeholder">📦</div>`;
        }

        // Query display
        let queryDisplay = item.query;
        if (item.needed) {
            queryDisplay = `${formatUnit(item.needed.amount, item.needed.unit)} ${item.query}`;
        }

        // Matched product name
        let matchedDisplay = '';
        if (matched) {
            matchedDisplay = `<div class="item-matched">→ ${matched.product_identifier || matched.product_name || ''}</div>`;
        }

        // Location
        let locationDisplay = '';
        if (matched) {
            const location = [matched.aisle, matched.shelf_label].filter(Boolean).join(', ');
            locationDisplay = `<div class="item-location">📍 ${location || 'Standort unbekannt'}</div>`;
        }

        // Price display
        let priceDisplay = '';
        let calcDisplay = '';
        if (matched && (matched.current_price || matched.estimated_price)) {
            const unitPrice = matched.current_price || matched.estimated_price;
            const totalPrice = item.calculation ? (unitPrice * item.calculation.count) : unitPrice;
            const prefix = matched.current_price ? '' : '≈ ';
            priceDisplay = `<div class="item-price">${prefix}${totalPrice.toFixed(2)} €</div>`;

            if (item.calculation && item.calculation.count > 1) {
                calcDisplay = `<div class="item-calc">${item.calculation.count}x à ${unitPrice.toFixed(2)} €</div>`;
            }
        }

        // Rating stars (1-5)
        const rating = item.rating || 0;
    const stars = [1, 2, 3, 4, 5].map(n => `<span style="cursor:pointer;color:${n <= rating ? 'var(--muted)' : 'var(--border)'};font-size:18px;" onclick="window.setItemRating(${i}, ${n}); renderList();">★</span>`).join('');

        // Notes editor
        const notes = item.notes || '';
        const notesHtml = `<textarea placeholder\\"Notizen...\\" oninput=\\"window.setItemNotes(${i}, this.value)\\" style=\\"width:100%;min-height:48px;margin-top:6px;border:1px solid var(--border);border-radius:6px;padding:6px;\\">${notes}</textarea>`;

        // Price input (if no verified price yet)
        let priceInputHtml = '';
        if (matched && !matched.current_price) {
            priceInputHtml = `<div style="margin-top:6px;display:flex;gap:6px;align-items:center;">
                <input type="number" placeholder="Preis €" step="0.01" min="0" id="price-input-${i}" style="width:80px;padding:6px;border:1px solid var(--border);border-radius:6px;">
                <button onclick="window.submitPrice(${i})" style="background:var(--success);color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;">Preis melden</button>
            </div>`;
        }

        return `
            <div class="list-item ${matchedClass}">
                ${imageHtml}
                <div class="item-text">
                    <div class="item-query">${queryDisplay}</div>
                    ${matchedDisplay}
                    ${locationDisplay}
                    <div style="margin-top:6px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <button onclick="window.editShoppingItem(${i})" style="background:var(--accent);color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;">Produkt ändern</button>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <button onclick="window.changeItemCount(${i}, -1)" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);">-</button>
                            <span style="min-width:24px;text-align:center;font-weight:600;">${(item.calculation?.count) || 1}</span>
                            <button onclick="window.changeItemCount(${i}, 1)" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);">+</button>
                        </div>
                        <div title="Bewertung" style="margin-left:8px;">${stars}</div>
                    </div>
                    ${notesHtml}
                    ${priceInputHtml}
                </div>
                <div class="item-price-box">
                    ${priceDisplay}
                    ${calcDisplay}
                </div>
                <button class="item-remove" onclick="window.removeShoppingItem(${i})" title="Entfernen">🗑️</button>
            </div>
        `;
    }).join('');

    renderTotalSummary();
}

function renderTotalSummary() {
    const totalContainer = document.getElementById('total-price-container');
    if (!totalContainer) return;

    if (shoppingList.length === 0) {
        totalContainer.innerHTML = '';
        return;
    }

    let totalPrice = 0;
    let estimatedCount = 0;
    let confirmedCount = 0;

    shoppingList.forEach(item => {
        if (item.matched && (item.matched.current_price || item.matched.estimated_price)) {
            const unitPrice = item.matched.current_price || item.matched.estimated_price;
            const itemTotal = item.calculation ? (unitPrice * item.calculation.count) : unitPrice;
            totalPrice += itemTotal;

            if (item.matched.current_price) {
                confirmedCount++;
            } else {
                estimatedCount++;
            }
        }
    });

    const hasEstimates = estimatedCount > 0;
    const prefix = hasEstimates ? 'ca. ' : '';
    const itemsText = `${shoppingList.length} Artikel`;
    const priceNote = hasEstimates ? `(${confirmedCount} bestätigt, ${estimatedCount} geschätzt)` : '';

    totalContainer.innerHTML = `
        <div class="total-summary">
            <div>
                <div class="total-label">Gesamtsumme</div>
                <div class="total-items">${itemsText} ${priceNote}</div>
            </div>
            <div class="total-amount">${prefix}${totalPrice.toFixed(2)} €</div>
        </div>
    `;
}


function exportList() {
    if (shoppingList.length === 0) {
        alert('Deine Einkaufsliste ist leer!');
        return;
    }

    let text = `🛒 Einkaufsliste — ${selectedStore || 'Unbekannt'}\\n`;
    text += `📅 ${new Date().toLocaleDateString('de-DE')}\\n\\n`;

    shoppingList.forEach((item, i) => {
        const matched = item.matched;
        const name = matched ? (matched.product_identifier || matched.product_name) : item.query;
        const count = item.calculation?.count || 1;
        const price = matched && (matched.current_price || matched.estimated_price);
        const priceText = price ? ` — ${(price * count).toFixed(2)} €` : '';

        text += `${i + 1}. ${count}x ${name}${priceText}\\n`;

        if (item.rating) {
            const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
            text += `   Bewertung: ${stars}\\n`;
        }

        if (item.notes) {
            text += `   Notiz: ${item.notes}\\n`;
        }

        text += '\\n';
    });

    // Total
    let total = 0;
    shoppingList.forEach(item => {
        if (item.matched && (item.matched.current_price || item.matched.estimated_price)) {
            const unitPrice = item.matched.current_price || item.matched.estimated_price;
            const itemTotal = item.calculation ? (unitPrice * item.calculation.count) : unitPrice;
            total += itemTotal;
        }
    });

    if (total > 0) {
        text += `\\nGesamtsumme: ca. ${total.toFixed(2)} €`;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        alert('✓ Einkaufsliste wurde in die Zwischenablage kopiert!');
    }).catch(() => {
        // Fallback: show in modal
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `<div style="background:var(--card);padding:24px;border-radius:12px;max-width:600px;max-height:80vh;overflow:auto;"><h3>Einkaufsliste teilen</h3><textarea readonly style="width:100%;min-height:300px;margin:16px 0;padding:12px;border:1px solid var(--border);border-radius:6px;">${text}</textarea><button onclick="this.closest('div[style*=fixed]').remove()" style="background:var(--accent);color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Schließen</button></div>`;
        document.body.appendChild(modal);
    });
}

// Expose global functions
window.removeShoppingItem = removeItem;
window.editShoppingItem = window.editShoppingItem;
window.changeItemCount = changeItemCount;
window.setItemNotes = setItemNotes;
window.setItemRating = setItemRating;
window.submitPrice = submitPrice;
window.exportList = exportList;
