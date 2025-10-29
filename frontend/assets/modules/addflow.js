// addflow.js
// Handles add-item flow: fetching OFF suggestions, rendering pending-selection, confirming/cancelling
import * as off from './openfoodfacts.js';
import * as persistence from './persistence.js';
import * as renderer from './renderer.js';
import * as scoring from './scoring.js';
import * as matcher from './matcher.js';

export function setupAddFlow({ getShoppingList, setShoppingList, getSelectedStore, saveAndRender }) {
    const addBtn = document.getElementById('add-btn');
    const itemInput = document.getElementById('item-input');
    const qtyInput = document.getElementById('quantity-input');

    function clearInputs() {
        if (itemInput) itemInput.value = '';
        if (qtyInput) qtyInput.value = '';
    }

    function normalizeLabels(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(s => String(s));
        if (typeof val === 'string') return val.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        return [];
    }

    async function addItemFromInputs() {
        if (!itemInput) return;
        const text = (itemInput.value || '').trim();
        const qty = (qtyInput && qtyInput.value) ? qtyInput.value.trim() : '';
        if (!text) return alert('Bitte gib ein Produkt ein.');
        if (!getSelectedStore()) return alert('Bitte wähle zuerst einen Laden aus.');

        const pending = window._pendingOffProduct || null;
        if (pending) {
            const item = { text: pending.product_name || text, quantity: qty, addedAt: Date.now(), off: pending };
            const list = getShoppingList();
            list.push(item);
            setShoppingList(list);
            saveAndRender();
            clearInputs();
            window._pendingOffProduct = null;
            return;
        }

        try {
            let suggestions = [];
            if (matcher && typeof matcher.findSuggestions === 'function') {
                // Use the modular matcher pipeline which combines local + OFF + scoring
                try {
                    const allProducts = window._allProductLocations || [];
                    const store = getSelectedStore();
                    const results = await matcher.findSuggestions(text, { allProducts, selectedStore: store, useLiveOFF: true });
                    console.log('addflow: matcher.findSuggestions returned', results.length, 'results');
                    // matcher returns array of { product, score, source }
                    suggestions = results.map(r => {
                        const p = r.product || r;
                        p.__fairScore = r.fairScore || scoring.computeFairScore(p, r.source || 'off');
                        return p;
                    });
                    window._pendingSuggestionsOriginal = suggestions.slice();
                    window._pendingSuggestions = suggestions.slice();
                    // Enrich suggestions (ratings/prices) and compute suggested purchase counts if user entered quantity
                    (async () => {
                        try {
                            const store = getSelectedStore();
                            await off.enrichSuggestionsWithRatingsAndPrices(window._pendingSuggestions.map(p => ({ product: p })), store);
                            // compute calculation if pending needed exists on window
                            if (window._pendingNeeded) {
                                window._pendingSuggestions.forEach(s => {
                                    const productQty = off.extractProductQuantity(s);
                                    if (productQty) {
                                        s._calculation = off.calculateOptimalQuantity(window._pendingNeeded, productQty);
                                    }
                                });
                            }
                        } catch (e) { /* ignore */ }
                    })();
                } catch (e) {
                    console.error('Matcher pipeline failed, falling back to OFF fetch:', e);
                    suggestions = await off.fetchOffProducts(text, 8);
                }
            } else {
                suggestions = await off.fetchOffProducts(text, 8);
            }
            if (suggestions && suggestions.length > 0) {
                // default: respect user's previous toggle (persisted in localStorage).
                // If the user has no saved preference, default to sorting by fair score.
                if (window._pendingSortByFair == null) {
                    const stored = localStorage.getItem('pendingSortByFair');
                    window._pendingSortByFair = (stored !== null) ? (stored === '1') : true;
                }
                const toRender = window._pendingSortByFair ? window._pendingSuggestions.slice().sort((a, b) => (b.__fairScore || scoring.computeFairScore(b, 'off')) - (a.__fairScore || scoring.computeFairScore(a, 'off'))) : suggestions.slice();
                renderPendingSuggestions(toRender);
                return;
            }
        } catch (e) {
            console.error('Error fetching OFF suggestions on add:', e);
        }
        // fallback
        const item = { text, quantity: qty, addedAt: Date.now() };
        const list = getShoppingList();
        list.push(item);
        setShoppingList(list);
        saveAndRender();
        clearInputs();
    }

    function renderPendingSelection(product) {
        const container = document.getElementById('pending-selection');
        const details = document.getElementById('pending-item-details');
        const suggestionsDiv = document.getElementById('pending-suggestions');
        if (!container || !details || !suggestionsDiv) return;
        container.style.display = 'block';
        const labels = normalizeLabels(product.labels || product.labels_tags);
        const nutri = product.nutriscore_grade || product.nutriscore || '-';
        const eco = product.ecoscore_grade || product.ecoscore || '-';
        const title = product.product_identifier || product.product_name || product.generic_name || product.display_name || (product.brands && product.brands.split(',')[0]) || product.code || window._pendingQuery || 'Produkt';
        const qtyText = product.quantity ? `<span style="color:#475569;font-size:13px;margin-left:8px;">${product.quantity}</span>` : '';
        details.innerHTML = `
            <div style="display:flex;gap:12px;align-items:center;">
                <div>${product.image_small_url ? `<img src='${product.image_small_url}' style='width:72px;height:72px;object-fit:cover;border-radius:6px;'>` : '<div style="width:72px;height:72px;border-radius:6px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;">📦</div>'}</div>
                <div>
                    <strong>${title}</strong>${qtyText}
                    <div style="color:#64748b;margin-top:6px;">NutriScore: ${nutri} • EcoScore: ${eco}</div>
                    <div style="margin-top:8px;">${labels.slice(0, 6).map(l => `<span style="background:#eef2ff;padding:4px 8px;border-radius:6px;margin-right:6px;font-size:12px;">${l}</span>`).join('')}</div>
                </div>
            </div>
        `;
        // Do not clear suggestions here — keep the suggestions list visible so users can pick other items.
        // suggestionsDiv.innerHTML = '';
    }

    function renderPendingSuggestions(suggestions) {
        const container = document.getElementById('pending-selection');
        const details = document.getElementById('pending-item-details');
        const suggestionsDiv = document.getElementById('pending-suggestions');
        if (!container || !suggestionsDiv || !details) return;
        container.style.display = 'block';

        // controls: sort toggle and legend info — render inside suggestionsDiv to keep ordering predictable
        // remove any existing controls element to avoid duplicates
        const existingControls = document.getElementById('pending-controls');
        if (existingControls) existingControls.remove();
        const controlsHtml = `
            <div id="pending-controls" style="display:flex;align-items:center;justify-content:space-between;margin:12px 0;gap:8px;">
                <div><label style="font-size:13px;color:#334155;"><input type="checkbox" id="pending-sort-fair" style="margin-right:8px;">Nach Fairness sortieren</label></div>
                <div><button id="pending-score-legend" title="Wie der Score berechnet wird (Eco,Nutri,Ethik)" style="background:#eef2ff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;">ℹ️ Score</button></div>
            </div>
        `;

        // decide order based on toggle
        const items = (window._pendingSortByFair) ? (suggestions.slice().sort((a, b) => (b.__fairScore || scoring.computeFairScore(b, 'off')) - (a.__fairScore || scoring.computeFairScore(a, 'off')))) : suggestions.slice();

        // ensure suggestions container is visible, scrollable and styled clearly
        suggestionsDiv.style.display = 'block';
        suggestionsDiv.style.maxHeight = suggestionsDiv.style.maxHeight || '320px';
        suggestionsDiv.style.minHeight = suggestionsDiv.style.minHeight || '80px';
        suggestionsDiv.style.overflowY = 'auto';
        suggestionsDiv.style.marginTop = suggestionsDiv.style.marginTop || '8px';
        suggestionsDiv.style.padding = suggestionsDiv.style.padding || '8px';
        suggestionsDiv.style.background = suggestionsDiv.style.background || '#f8fafc';
        suggestionsDiv.style.borderTop = suggestionsDiv.style.borderTop || '1px solid #e6edf3';
        suggestionsDiv.style.position = 'relative';
        suggestionsDiv.style.zIndex = suggestionsDiv.style.zIndex || '1';

        const html = items.map((p, idx) => {
            const titleBase = p.product_identifier || p.product_name || p.generic_name || p.display_name || (p.brands && p.brands.split(',')[0]) || p.code || '';
            const qtyDisplay = p.quantity ? ` <span style="color:#475569;font-size:12px;margin-left:6px;">(${p.quantity})</span>` : '';
            const title = titleBase + qtyDisplay;
            const img = p.image_small_url ? `<img src='${p.image_small_url}' style='width:52px;height:52px;object-fit:cover;border-radius:6px;'>` : '<div style="width:52px;height:52px;border-radius:6px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;">📦</div>';
            const nutri = p.nutriscore_grade || p.nutriscore || '-';
            const eco = p.ecoscore_grade || p.ecoscore || '-';
            const labels = normalizeLabels(p.labels || p.labels_tags).slice(0, 3).map(l => `<span style="background:#eef2ff;padding:4px 8px;border-radius:6px;margin-right:6px;font-size:12px;">${l}</span>`).join('');
            const comps = scoring.computeFairComponents(p, 'off');
            const fairScore = comps.total || 0;
            // color: green >=0.75, yellow >=0.5, red otherwise
            let bg = '#fff7ed';
            let color = '#92400e';
            if (fairScore >= 0.75) { bg = '#ecfdf5'; color = '#065f46'; }
            else if (fairScore >= 0.5) { bg = '#fffbeb'; color = '#854d0e'; }
            const tooltip = `Eco: ${comps.ecoScore.toFixed(2)} | Nutri: ${comps.nutriScore.toFixed(2)} | Ethics: ${comps.ethicsScore.toFixed(2)} | verified:+${comps.verifiedBoost.toFixed(2)} | local:+${comps.localBoost.toFixed(2)}`;
            // store score for reuse
            p.__fairScore = fairScore;
            return `<div class="pending-suggestion" data-idx="${idx}" style="display:flex;gap:12px;padding:8px;border-bottom:1px solid #e6edf3;cursor:pointer;align-items:center;width:100%;box-sizing:border-box;">
                <div>${img}</div>
                <div style="flex:1;">
                    <div style="display:flex;align-items:center;justify-content:space-between;"><div style="font-weight:600">${title}</div><div title="${tooltip}" style="font-size:13px;color:${color};font-weight:700;background:${bg};padding:6px 8px;border-radius:6px;">${fairScore.toFixed(2)}</div></div>
                    <div style="color:#64748b;font-size:13px;margin-top:6px;">Nutri: ${nutri} • Eco: ${eco}</div>
                    <div style="margin-top:6px;">${labels}</div>
                </div>
            </div>`;
        }).join('');
        // html length computed; rendering below
        // Put controls + suggestions into the suggestionsDiv to ensure correct ordering
        suggestionsDiv.innerHTML = controlsHtml + html;
        // wire controls
        const chk = suggestionsDiv.querySelector('#pending-sort-fair');
        if (chk) {
            chk.checked = !!window._pendingSortByFair;
            chk.addEventListener('change', () => {
                window._pendingSortByFair = chk.checked;
                try { localStorage.setItem('pendingSortByFair', window._pendingSortByFair ? '1' : '0'); } catch (e) { /* ignore */ }
                const src = window._pendingSuggestionsOriginal && window._pendingSuggestionsOriginal.length ? window._pendingSuggestionsOriginal : suggestions;
                renderPendingSuggestions(src);
            });
        }
        const legendBtn = suggestionsDiv.querySelector('#pending-score-legend');
        if (legendBtn) legendBtn.addEventListener('click', () => {
            if (window.openModal) window.openModal('score-legend-modal');
            else {
                const modal = document.getElementById('score-legend-modal');
                if (modal) modal.classList.add('active');
            }
        });
        // ensure each suggestion is visible (force some safe styles) and attach click handlers
        const children = suggestionsDiv.querySelectorAll('.pending-suggestion');
        children.forEach((el, idx) => {
            // visual safety: make items block-level, with padding/background so they are visible
            el.style.display = el.style.display || 'flex';
            el.style.width = el.style.width || '100%';
            el.style.boxSizing = el.style.boxSizing || 'border-box';
            el.addEventListener('click', async (e) => {
                let prod = items[idx];
                // Try to enrich product with full OFF data by barcode if available
                const code = prod.code || prod.barcode || prod.barcode;
                if (code && off && typeof off.fetchOffProductByBarcode === 'function') {
                    try {
                        const full = await off.fetchOffProductByBarcode(code);
                        if (full) {
                            // merge returned fields into prod
                            prod = Object.assign({}, prod, full);
                            // keep code field consistent
                            prod.code = prod.code || full.code || prod.barcode || full.barcode;
                        }
                    } catch (err) {
                        // ignore enrichment errors
                    }
                }
                window._pendingOffProduct = prod;
                window._pendingSuggestions = items.slice();
                renderPendingSelection(prod);
            });
        });
        // (debug instrumentation removed) 
        // pre-select first suggestion and expose it globally so confirm button works
        if (items.length > 0) {
            window._pendingOffProduct = items[0];
            window._pendingSuggestions = items.slice();
            renderPendingSelection(items[0]);
            // Enrich first suggestion in background to fill missing details
            (async () => {
                const first = items[0];
                const code = first.code || first.barcode;
                if (code && off && typeof off.fetchOffProductByBarcode === 'function') {
                    try {
                        const full = await off.fetchOffProductByBarcode(code);
                        if (full) {
                            Object.assign(first, full);
                            // re-render details if still selected
                            if (window._pendingOffProduct && window._pendingOffProduct === items[0]) {
                                renderPendingSelection(items[0]);
                            }
                        }
                    } catch (e) { /* ignore */ }
                }
            })();
        }
    }

    function confirmPendingItem() {
        const pending = window._pendingOffProduct;
        const qtyInput = document.getElementById('quantity-input');
        const qty = qtyInput ? qtyInput.value.trim() : '';
        if (!pending) return;
        const item = { text: pending.product_name || window._pendingQuery || 'Produkt', quantity: qty, addedAt: Date.now(), off: pending };
        const list = getShoppingList();
        list.push(item);
        setShoppingList(list);
        saveAndRender();
        const container = document.getElementById('pending-selection');
        if (container) container.style.display = 'none';
        window._pendingOffProduct = null;
        window._pendingQuery = null;
    }

    function cancelPendingItem() {
        const container = document.getElementById('pending-selection');
        if (container) container.style.display = 'none';
        window._pendingOffProduct = null;
        window._pendingQuery = null;
    }

    // Expose to global for HTML onclicks
    window.confirmPendingItem = confirmPendingItem;
    window.cancelPendingItem = cancelPendingItem;
    // Expose render function so other modules can show details
    window.renderPendingSelection = renderPendingSelection;

    // Wire add button + inputs
    if (addBtn) addBtn.addEventListener('click', () => addItemFromInputs());
    if (itemInput) itemInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItemFromInputs(); });
    if (qtyInput) qtyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItemFromInputs(); });
}
