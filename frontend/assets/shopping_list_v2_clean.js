// Shopping List v2 - Clean Version with Compact Layout and Total Summary
// Features: Pending item selection, Ethics scoring, Price totals, Compact UI

let selectedStore = '';
let shoppingList = [];
let allProducts = [];
let pendingItem = null;
const useLiveOFF = true;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadStores();
    await loadAllProducts();

    const storeSelect = document.getElementById('store-select');
    const quantityInput = document.getElementById('quantity-input');
    const itemInput = document.getElementById('item-input');
    const addBtn = document.getElementById('add-btn');
    const clearBtn = document.getElementById('clear-btn');

    storeSelect.addEventListener('change', (e) => {
        selectedStore = e.target.value;
        renderList();
    });

    addBtn.addEventListener('click', () => addItem());
    itemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem();
    });
    quantityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') itemInput.focus();
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('Einkaufsliste wirklich leeren?')) {
            shoppingList = [];
            renderList();
        }
    });

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
        stores.forEach(store => {
            const opt = document.createElement('option');
            opt.value = store;
            opt.textContent = store;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Error loading stores:', err);
    }
}

async function loadAllProducts() {
    // Already loaded in loadStores
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
                ${it.image_url ? `<img src="${it.image_url}" onerror="this.style.display='none'" alt="" style="width:40px;height:40px;border-radius:4px;object-fit:cover;">` : '<div style="width:40px;height:40px;border-radius:4px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;">📦</div>'}
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
        items.sort((a, b) => {
            if (a.source !== b.source) return a.source === 'local' ? -1 : 1;
            return b.score - a.score;
        });

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

// ===== OFF API =====
async function fetchOffProducts(query, limit = 20) {
    try {
        const url = `/api/v1/openfoodfacts/search?query=${encodeURIComponent(query)}&page_size=${limit}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('OFF search failed');
        const data = await res.json();
        return data.products || [];
    } catch (e) {
        console.error('OFF fetch error:', e);
        return [];
    }
}

// ===== PENDING ITEM WORKFLOW =====
function addItem() {
    const quantityInput = document.getElementById('quantity-input');
    const itemInput = document.getElementById('item-input');

    const quantityStr = quantityInput.value.trim();
    const query = itemInput.value.trim();

    if (!query) return;
    if (!selectedStore) {
        alert('Bitte wähle zuerst einen Laden aus!');
        return;
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
        <div style="font-size:18px;font-weight:600;color:#0369a1;">
            ${qtyDisplay}${pendingItem.query}
        </div>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">Suche passende Produkte...</div>
    `;

    await matchSingleItem(pendingItem);
    renderPendingSuggestions();
}

async function matchSingleItem(item) {
    const expandedQueries = [
        item.query,
        ...expandQueryWithSynonyms(item.query),
        ...expandQueryWithCategories(item.query)
    ];

    const localProducts = allProducts.filter(p => p.store_name === selectedStore);
    const scoredLocal = localProducts.map(p => {
        const identifier = p.product_identifier || p.product_name || '';
        let maxScore = 0;
        expandedQueries.forEach(q => {
            const score = fuzzyMatch(q, identifier, 0.6);
            if (score > maxScore) maxScore = score;
        });
        const boost = brandBoost(item.query, identifier);
        maxScore = Math.min(1.0, maxScore + boost + 0.15);
        return { product: p, score: maxScore, source: 'local' };
    }).filter(m => m.score > 0);

    let candidates = [...scoredLocal];
    const bestLocal = scoredLocal.length ? Math.max(...scoredLocal.map(s => s.score)) : 0;
    const needOff = useLiveOFF && (scoredLocal.length === 0 || bestLocal < 0.75);

    if (needOff) {
        try {
            const offProducts = await fetchOffProducts(item.query, 30);
            const scoredOff = offProducts.map(p => {
                const identifier = p.product_identifier || p.product_name || '';
                let maxScore = 0;
                expandedQueries.forEach(q => {
                    const score = fuzzyMatch(q, identifier, 0.7);
                    if (score > maxScore) maxScore = score;
                });
                const boost = brandBoost(item.query, identifier);
                maxScore = Math.min(1.0, maxScore + boost);
                return { product: p, score: maxScore, source: 'off' };
            }).filter(m => m.score > 0.6);
            candidates = candidates.concat(scoredOff);
        } catch (e) {
            console.error('OFF fetch failed:', e);
        }
    }

    candidates.sort((a, b) => b.score - a.score);

    const qualityCandidates = candidates.filter(c => c.score >= 0.65);
    const deduped = deduplicateCandidates(qualityCandidates);

    deduped.forEach(c => {
        c.fairScore = computeFairScore(c.product, c.source);
        c.combinedScore = (c.score * 0.6) + (c.fairScore * 0.4);
    });

    const sorted = [...deduped].sort((a, b) => b.combinedScore - a.combinedScore);
    item.suggestions = sorted.slice(0, Math.max(3, Math.min(8, sorted.length)));

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

function renderPendingSuggestions() {
    const suggestionsDiv = document.getElementById('pending-suggestions');
    const detailsDiv = document.getElementById('pending-item-details');

    if (!pendingItem.suggestions || pendingItem.suggestions.length === 0) {
        suggestionsDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;">❌ Keine passenden Produkte gefunden</div>';
        detailsDiv.innerHTML = `
            <div style="font-size:18px;font-weight:600;color:#ef4444;">
                ${pendingItem.query}
            </div>
            <div style="font-size:13px;color:#ef4444;margin-top:4px;">Keine Produkte gefunden</div>
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
        <div style="font-size:16px;font-weight:600;color:#0369a1;">
            ${qtyDisplay ? qtyDisplay + ' ' : ''}${pendingItem.query}
        </div>
        <div style="font-size:13px;color:#22c55e;margin-top:4px;">✓ ${pendingItem.suggestions.length} Produkt(e) gefunden</div>
    `;

    suggestionsDiv.innerHTML = `
        <div style="font-size:14px;color:#64748b;margin-bottom:8px;">
            Wähle ein Produkt aus (beste Treffer zuerst):
        </div>
        ${pendingItem.suggestions.map((sug, idx) => renderPendingSuggestionRow(sug, idx)).join('')}
    `;
}

function renderPendingSuggestionRow(sug, idx) {
    const p = sug.product;
    const isSelected = idx === 0;
    const source = sug.source === 'local' ? 'Lokal' : 'OFF';
    const eco = (p.ecoscore || p.ecoscore_grade || '').toString().toUpperCase();
    const nutri = (p.nutriscore || p.nutriscore_grade || '').toString().toUpperCase();
    const ecoBadge = eco ? `<span style="background:#ecfeff;color:#0891b2;padding:2px 6px;border-radius:4px;font-size:11px;">Eco ${eco}</span>` : '';
    const nutriBadge = nutri ? `<span style="background:#f0fdf4;color:#16a34a;padding:2px 6px;border-radius:4px;font-size:11px;">Nutri ${nutri}</span>` : '';

    let ethicsBadge = '';
    if (p.ethics_score != null) {
        const ethicsScore = p.ethics_score;
        let ethicsColor, ethicsLabel, ethicsTitle;
        if (ethicsScore >= 0.75) {
            ethicsColor = '#22c55e'; ethicsLabel = 'Fair ✓'; ethicsTitle = 'Gute ethische Bewertung';
        } else if (ethicsScore >= 0.5) {
            ethicsColor = '#f59e0b'; ethicsLabel = 'OK'; ethicsTitle = 'Neutrale ethische Bewertung';
        } else {
            ethicsColor = '#ef4444'; ethicsLabel = 'Kritisch'; ethicsTitle = 'Ethische Bedenken';
        }
        if (p.ethics_issues && p.ethics_issues.length > 0) {
            ethicsTitle += ':\\n' + p.ethics_issues.join('\\n');
        }
        ethicsBadge = `<span style="background:${ethicsColor};color:white;padding:2px 6px;border-radius:4px;font-size:11px;cursor:help;" title="${ethicsTitle}">${ethicsLabel}</span>`;
    }

    const matchQuality = sug.score >= 0.9 ? '🟢' : sug.score >= 0.75 ? '🟡' : '🟠';

    let priceDisplay = '';
    if (p.current_price != null) {
        priceDisplay = `${p.current_price.toFixed(2)} €`;
    } else if (p.estimated_price != null) {
        priceDisplay = `≈ ${p.estimated_price.toFixed(2)} €`;
    }

    const unitPrice = calculateUnitPrice(p);
    if (unitPrice && priceDisplay) {
        priceDisplay += ` <span style="color:#94a3b8;font-size:10px;">(${unitPrice.display})</span>`;
    }

    const qty = p.size_amount && p.size_unit ? ` • ${p.size_amount} ${p.size_unit}` : '';

    let imageHtml = '';
    if (p.image_url) {
        imageHtml = `<img src="${p.image_url}" style="width:64px;height:64px;min-width:64px;border-radius:8px;object-fit:cover;border:2px solid #e5e7eb;" onerror="this.style.display='none'" loading="lazy" alt="${p.product_name || 'Produktbild'}">`;
    } else {
        imageHtml = `<div style="width:64px;height:64px;min-width:64px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:28px;">📦</div>`;
    }

    const borderColor = isSelected ? '#22c55e' : '#e5e7eb';
    const bgColor = isSelected ? '#f0fdf4' : '#fff';

    return `
        <div onclick="window.selectPendingProduct(${idx})" 
             style="display:flex;align-items:center;gap:12px;padding:12px;border:2px solid ${borderColor};border-radius:8px;margin-top:8px;background:${bgColor};cursor:pointer;transition:all 0.2s;"
             onmouseover="this.style.borderColor='#0ea5e9'; this.style.background='#f0f9ff';"
             onmouseout="this.style.borderColor='${borderColor}'; this.style.background='${bgColor}';">
            ${imageHtml}
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;color:#0f172a;word-break:break-word;display:flex;align-items:center;gap:6px;">
                    <span title="Match-Qualität">${matchQuality}</span>
                    ${p.product_identifier || p.product_name || ''}
                    ${isSelected ? '<span style="background:#22c55e;color:white;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:8px;">✓ Ausgewählt</span>' : ''}
                </div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;">
                    ${source}${qty} ${priceDisplay ? `• ${priceDisplay}` : ''} ${ecoBadge} ${nutriBadge} ${ethicsBadge}
                </div>
            </div>
        </div>
    `;
}

window.selectPendingProduct = function (idx) {
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

    renderPendingSuggestions();
};

window.confirmPendingItem = function () {
    if (!pendingItem || !pendingItem.matched) {
        alert('Bitte wähle ein Produkt aus!');
        return;
    }

    shoppingList.push({ ...pendingItem });

    pendingItem = null;
    document.getElementById('pending-selection').style.display = 'none';

    renderList();
};

window.cancelPendingItem = function () {
    pendingItem = null;
    document.getElementById('pending-selection').style.display = 'none';
};

// ===== SHOPPING LIST RENDERING (COMPACT) =====
function removeItem(index) {
    shoppingList.splice(index, 1);
    renderList();
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

        return `
            <div class="list-item ${matchedClass}">
                ${imageHtml}
                <div class="item-text">
                    <div class="item-query">${queryDisplay}</div>
                    ${matchedDisplay}
                    ${locationDisplay}
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

// Expose global functions
window.removeShoppingItem = removeItem;
