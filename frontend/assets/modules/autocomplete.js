// autocomplete.js
// Handles item autocomplete and selection (OpenFoodFacts)
import * as off from './openfoodfacts.js';

function normalizeLabels(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(s => String(s));
    if (typeof val === 'string') return val.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    return [];
}

export function setupItemAutocomplete(inputEl, onSelect) {
    const acEl = document.getElementById('item-autocomplete');
    if (!inputEl || !acEl) return;

    let acAbort = null;

    const hide = () => { acEl.style.display = 'none'; acEl.innerHTML = ''; };
    const show = (html) => { acEl.innerHTML = html; acEl.style.display = 'block'; };

    const fetchSuggestions = async (q) => {
        if (acAbort) acAbort.abort();
        const ctrl = new AbortController();
        acAbort = ctrl;
        try {
            const url = `/api/v1/openfoodfacts/search?query=${encodeURIComponent(q)}&page_size=8`;
            const res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) throw new Error('search failed');
            const data = await res.json();
            return data.products || [];
        } catch (e) {
            return [];
        }
    };

    inputEl.addEventListener('input', async () => {
        const q = inputEl.value.trim();
        if (q.length < 2) { hide(); return; }
        let items = await fetchSuggestions(q);
        console.log('OFF suggestions count:', items && items.length);
        if (!items || items.length === 0) {
            const acEl2 = document.getElementById('item-autocomplete');
            if (acEl2) {
                acEl2.innerHTML = `<div style="padding:8px;color:#64748b;">Keine Produktvorschläge gefunden (OFF).</div>`;
                acEl2.style.display = 'block';
            }
            return;
        }
        // Build suggestion HTML
        const html = items.map(it => {
            const title = it.product_name || it.generic_name || it.display_name || (it.brands && it.brands.split(',')[0]) || it.code || '';
            return `
            <div class="ac-item" data-title="${(title).replace(/"/g, '&quot;')}" data-code="${it.code || ''}">
                ${it.image_small_url ? `<img src="${it.image_small_url}" onerror="this.style.display='none'" alt="" style="width:40px;height:40px;border-radius:4px;object-fit:cover;">` : '<div style="width:40px;height:40px;border-radius:4px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;">📦</div>'}
                <div>
                    <div class="ac-title">${title}</div>
                    ${it.code ? `<div class="ac-sub">${it.code}</div>` : ''}
                </div>
            </div>
        `}).join('');
        show(html);
    });

    acEl.addEventListener('mousedown', (e) => {
        const item = e.target.closest('.ac-item');
        if (!item) return;
        const title = item.getAttribute('data-title') || '';
        const code = item.getAttribute('data-code') || item.getAttribute('data-barcode') || item.getAttribute('data-id');
        (async () => {
            let full = null;
            if (code) {
                try { full = await off.fetchOffProductByBarcode(code); } catch (e) { full = null; }
            }
            if (!full) {
                try {
                    const results = await off.fetchOffProducts(title, 1);
                    if (results && results.length > 0) full = results[0];
                } catch (e) { /* ignore */ }
            }
            if (!full) full = { product_name: title };
            if (onSelect && typeof onSelect === 'function') onSelect(full);
        })();
        hide();
    });

    document.addEventListener('click', (e) => {
        if (!acEl.contains(e.target) && e.target !== inputEl) hide();
    });
}
