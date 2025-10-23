// main.js
// Einstiegspunkt für WirKaufenFair (modular)


import * as persistence from './modules/persistence.js';
import * as storeApi from './modules/store-api.js';
import * as matcher from './modules/matcher.js';
import * as renderer from './modules/renderer.js';
import * as handlers from './modules/ui-handlers.js';
import * as off from './modules/openfoodfacts.js';
import { renderRoute } from './modules/route.js';
import { showPriceHistory, closePriceModal } from './modules/price-history.js';

// Globaler State
let selectedStore = '';
let shoppingList = [];

function updateContext() {
    renderer.setRenderContext(shoppingList, selectedStore);
    handlers.setHandlerContext(shoppingList);
}

// Initialisierung
window.addEventListener('DOMContentLoaded', async () => {
    // Standort abfragen und dann Stores laden
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            storeApi.setUserLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
            });
            await initializeApp();
        }, async (err) => {
            // Bei Ablehnung oder Fehler: trotzdem App initialisieren (ohne Standort)
            await initializeApp();
        });
    } else {
        await initializeApp();
    }
});

async function initializeApp() {
    selectedStore = localStorage.getItem('wirkaufenfair_store') || '';
    shoppingList = persistence.loadFromLocalStorage(selectedStore);
    updateContext();
    renderer.renderList();
    await populateStoreSelect();
    wireAddButton();
    setupItemAutocomplete(document.getElementById('item-input'));
}

// Autocomplete setup (uses /api/v1/openfoodfacts/search as backend)
function setupItemAutocomplete(inputEl) {
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
        if (!items || items.length === 0) { hide(); return; }
        // Always filter suggestions to prefer fair / organic labeled products
        try {
            const filterKeywords = ['fair', 'fairtrade', 'fair-trade', 'rainforest', 'utz', 'organic', 'bio', 'biologique', 'fairtrade.org'];
            const hasFairLabel = (it) => {
                const tags = (it.labels_tags || it.labels || []).map(s => String(s).toLowerCase());
                for (const kw of filterKeywords) {
                    if (tags.some(t => t.includes(kw))) return true;
                }
                const name = (it.product_name || it.display_name || '').toLowerCase();
                if (filterKeywords.some(kw => name.includes(kw))) return true;
                return false;
            };
            const before = items.length;
            const filtered = items.filter(hasFairLabel);
            if (filtered.length > 0) items = filtered; // prefer labelled products but fall back if none
            console.log(`Autocomplete: filtered ${before} -> ${items.length} items (fair-priority)`);
        } catch (e) { /* ignore */ }
        const html = items.map(it => `
            <div class="ac-item" data-title="${(it.product_name || it.display_name || '').replace(/"/g,'&quot;')}">
                ${it.image_small_url ? `<img src="${it.image_small_url}" onerror="this.style.display='none'" alt="" style="width:40px;height:40px;border-radius:4px;object-fit:cover;">` : '<div style="width:40px;height:40px;border-radius:4px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;">📦</div>'}
                <div>
                    <div class="ac-title">${it.product_name || it.display_name || ''}</div>
                    ${it.code ? `<div class="ac-sub">${it.code}</div>` : ''}
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

function wireAddButton() {
    const addBtn = document.getElementById('add-btn');
    const itemInput = document.getElementById('item-input');
    const qtyInput = document.getElementById('quantity-input');
    if (!addBtn || !itemInput) return;
    addBtn.addEventListener('click', () => addItemFromInputs());
    itemInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItemFromInputs(); });
    qtyInput && qtyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItemFromInputs(); });
}

function addItemFromInputs() {
    const itemInput = document.getElementById('item-input');
    const qtyInput = document.getElementById('quantity-input');
    if (!itemInput) return;
    const text = (itemInput.value || '').trim();
    const qty = (qtyInput && qtyInput.value) ? qtyInput.value.trim() : '';
    if (!text) return alert('Bitte gib ein Produkt ein.');
    if (!selectedStore) return alert('Bitte wähle zuerst einen Laden aus.');
    // Simple item object
    const item = { text, quantity: qty, addedAt: Date.now() };
    shoppingList.push(item);
    // Try to enrich item with OFF data (nutriscore/ecoscore) for better fair scoring
    (async () => {
        try {
            const products = await off.fetchOffProducts(text, 1);
            if (products && products.length > 0) {
                const p = products[0];
                item.off = p;
                if (p.nutriscore_grade) item.nutriscore = p.nutriscore_grade;
                if (p.ecoscore_grade) item.ecoscore = p.ecoscore_grade;
            }
        } catch (e) {
            // ignore
        } finally {
            persistence.saveToLocalStorage(selectedStore, shoppingList);
            updateContext();
            renderer.renderList();
        }
    })();
    // clear inputs
    itemInput.value = '';
    if (qtyInput) qtyInput.value = '';
}

// Custom Dropdown für Stores
async function populateStoreSelect() {
    const container = document.getElementById('custom-store-dropdown');
    if (!container) return;
    // Ensure label remains (don't replace container content)
    let labelEl = document.getElementById('store-selected-label');
    if (!labelEl) {
        labelEl = document.createElement('div');
        labelEl.id = 'store-selected-label';
        labelEl.style.cssText = 'width:100%;padding:10px;border-radius:6px;border:1px solid #e5e7eb;font-size:16px;background:#fff;cursor:pointer;user-select:none;';
        labelEl.textContent = 'Laden auswählen...';
        container.appendChild(labelEl);
    }
    // remove existing list if present
    let listDiv = container.querySelector('.custom-dropdown-list');
    if (listDiv) listDiv.remove();
    listDiv = document.createElement('div');
    listDiv.className = 'custom-dropdown-list';
    listDiv.innerHTML = '<div class="dropdown-item" style="color:#64748b;cursor:default;">Laden auswählen...</div><div class="dropdown-item">Läden werden geladen...</div>';
    container.appendChild(listDiv);

    // Wire store search input
    const storeSearch = document.getElementById('store-search-input');
    if (storeSearch) {
        storeSearch.addEventListener('input', () => {
            const q = storeSearch.value.trim().toLowerCase();
            const items = container.querySelectorAll('.dropdown-item[data-osm]');
            items.forEach(it => {
                const txt = it.textContent.toLowerCase();
                it.style.display = txt.includes(q) ? '' : 'none';
            });
        });
        storeSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const q = storeSearch.value.trim().toLowerCase();
                const match = (window._lastFetchedStores || []).find(s => (s.full_name||'').toLowerCase().includes(q));
                if (match) {
                    // simulate click on the corresponding dropdown item
                    const el = container.querySelector(`.dropdown-item[data-osm="${match.osm_id}"]`);
                    if (el) el.click();
                }
            }
        });
    }

    // Favoriten aus localStorage holen
    let favorites = [];
    try { favorites = JSON.parse(localStorage.getItem('wirkaufenfair_favstores') || '[]'); } catch { }

    // Läden laden
    const stores = await storeApi.loadStores();
    window._lastFetchedStores = stores || [];
    if (!stores || stores.length === 0) {
        container.innerHTML = '<div class="custom-dropdown-list"><div class="dropdown-item" style="color:#64748b;cursor:default;">Laden auswählen...</div><div class="dropdown-item">(Keine Läden gefunden)</div></div>';
        return;
    }
    // Entfernung berechnen (falls Standort verfügbar)
    let userLat = null, userLng = null;
    const loc = storeApi.getUserLocation && storeApi.getUserLocation();
    if (loc && loc.latitude && loc.longitude) {
        userLat = loc.latitude;
        userLng = loc.longitude;
    }
    function calcDistance(lat1, lng1, lat2, lng2) {
        if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    stores.forEach(store => {
        if (userLat && userLng && store.lat && store.lng) {
            store.distance = calcDistance(userLat, userLng, store.lat, store.lng);
        } else {
            store.distance = null;
        }
    });
    // Gruppierung: Typ (shop) → Marke (brand) → Läden
    const groups = {};
    stores.forEach(store => {
        const shop = (store.shop || (store.tags && store.tags.shop) || 'Sonstiges').toLowerCase();
        const brand = (store.brand || store.chain || store.operator || 'Sonstige').toLowerCase();
        if (!groups[shop]) groups[shop] = {};
        if (!groups[shop][brand]) groups[shop][brand] = [];
        groups[shop][brand].push(store);
    });
    function storeSort(a, b) {
        if (a.distance != null && b.distance != null) {
            return a.distance - b.distance;
        } else if (a.distance != null) {
            return -1;
        } else if (b.distance != null) {
            return 1;
        } else {
            return (a.full_name || '').localeCompare(b.full_name || '');
        }
    }
    // Favoriten zuerst
    let html = '<div class="custom-dropdown-list"><div class="dropdown-item" style="color:#64748b;cursor:default;">Laden auswählen...</div>';
    if (favorites.length > 0) {
        const favStores = stores.filter(s => favorites.includes(String(s.osm_id)));
        favStores.sort(storeSort);
        if (favStores.length > 0) {
            html += '<div class="dropdown-group"><div class="dropdown-group-header dropdown-fav">★ Favoriten</div><div class="dropdown-group-list">';
            favStores.forEach(store => {
                html += renderDropdownItem(store, true);
            });
            html += '</div></div>';
        }
    }
    // Dann alle anderen gruppiert
    Object.keys(groups).sort().forEach(shop => {
        const shopId = 'shop_' + shop.replace(/[^a-z0-9]/gi, '');
        html += `<div class="dropdown-group"><div class="dropdown-group-header" data-group="${shopId}">${shop.charAt(0).toUpperCase() + shop.slice(1)}</div><div class="dropdown-group-list" id="${shopId}" style="display:none;">`;
        Object.keys(groups[shop]).sort().forEach(brand => {
            const brandId = shopId + '_brand_' + brand.replace(/[^a-z0-9]/gi, '');
            html += `<div class="dropdown-brand-header" data-brand="${brandId}">${brand.charAt(0).toUpperCase() + brand.slice(1)}</div><div class="dropdown-group-list" id="${brandId}" style="display:none;">`;
            const brandStores = groups[shop][brand].slice().sort(storeSort);
            brandStores.forEach(store => {
                if (favorites.includes(String(store.osm_id))) return;
                html += renderDropdownItem(store, false);
            });
            html += '</div>';
        });
        html += '</div></div>';
    });
    html += '</div>';
    // replace list content only
    const newListHtml = html; // html already contains the inner structure
    // remove previous listDiv and append updated one
    const oldList = container.querySelector('.custom-dropdown-list');
    if (oldList) oldList.remove();
    const updated = document.createElement('div');
    updated.className = 'custom-dropdown-list';
    updated.innerHTML = newListHtml.replace(/^<div class="custom-dropdown-list">|<\/div>$/g, '');
    container.appendChild(updated);

    // Interaktivität: Gruppen aufklappen
    const activeRoot = container.querySelector('.custom-dropdown-list') || container;
    activeRoot.querySelectorAll('.dropdown-group-header').forEach(header => {
        header.addEventListener('click', function () {
            const groupId = this.getAttribute('data-group');
            const group = document.getElementById(groupId);
            if (group) group.style.display = group.style.display === 'none' ? '' : 'none';
        });
    });
    activeRoot.querySelectorAll('.dropdown-brand-header').forEach(header => {
        header.addEventListener('click', function (e) {
            e.stopPropagation();
            const brandId = this.getAttribute('data-brand');
            const group = document.getElementById(brandId);
            if (group) group.style.display = group.style.display === 'none' ? '' : 'none';
        });
    });
    // Auswahl
    activeRoot.querySelectorAll('.dropdown-item').forEach(item => {
        // Nur auswählbare Läden (mit data-osm) klickbar machen
        if (!item.hasAttribute('data-osm')) {
            item.style.cursor = 'default';
            item.classList.remove('dropdown-item'); // entfernt Hover-Effekt
            return;
        }
        item.addEventListener('click', function () {
            console.log('Dropdown-Item geklickt:', this, this.getAttribute('data-osm'));
            const osmId = this.getAttribute('data-osm');
            const storeObj = (window._lastFetchedStores || []).find(s => String(s.osm_id) === String(osmId));
            if (storeObj) {
                selectedStore = String(storeObj.osm_id);
                localStorage.setItem('wirkaufenfair_store', selectedStore);
                // Reload shopping list for this store and update render context so Add button works
                shoppingList = persistence.loadFromLocalStorage(selectedStore);
                updateContext();
                renderer.renderList();
                console.log('Store ausgewählt, selectedStore set to', selectedStore);
                showStoreDetail(storeObj);
                updateStoreSelectedLabel(storeObj);
                // Markiere Auswahl
                container.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('dropdown-selected'));
                this.classList.add('dropdown-selected');
                // Dropdown nach Auswahl schließen
                const list = container.querySelector('.custom-dropdown-list');
                if (list) list.style.display = 'none';
            }
            // Label bleibt immer sichtbar und zeigt Auswahl
            updateStoreSelectedLabel(storeObj);
        });
    });
    // Nach Laden der Stores: Label immer aktualisieren (OSM-ID oder Name)
    const storeObj = getSelectedStoreObj();
    updateStoreSelectedLabel(storeObj);
}

function renderDropdownItem(store, isFav) {
    const name = store.full_name || store.chain || 'Unbekannt';
    let addr = '';
    if (store.tags) {
        const t = store.tags;
        if (t['addr:street']) addr += t['addr:street'];
        if (t['addr:housenumber']) addr += ' ' + t['addr:housenumber'];
        if (t['addr:postcode'] || t['addr:city']) {
            addr += ', ';
            if (t['addr:postcode']) addr += t['addr:postcode'] + ' ';
            if (t['addr:city']) addr += t['addr:city'];
        }
    }
    let label = isFav ? '★ ' + name : name;
    if (addr.trim()) label += ' – ' + addr.trim();
    if (store.distance != null) label += ` (${store.distance.toFixed(1)} km)`;
    return `<div class="dropdown-item${isFav ? ' dropdown-fav' : ''}" data-osm="${store.osm_id}">${label}</div>`;
}

function showStoreDetail(store) {
    const panel = document.getElementById('store-detail');
    const content = document.getElementById('detail-content');
    const title = document.getElementById('detail-title');
    const osmLink = document.getElementById('detail-osm-link');
    const favBtn = document.getElementById('fav-btn');
    if (!panel || !content) return;
    title.textContent = store.full_name || 'Laden Details';
    let html = '';
    html += `<div><strong>Marke:</strong> ${store.brand || store.chain || store.operator || '-'}</div>`;
    html += `<div><strong>Typ:</strong> ${store.shop || '-'}</div>`;
    // Adresse zusammensetzen
    let addr = '';
    if (store.tags) {
        const t = store.tags;
        if (t['addr:street']) addr += t['addr:street'];
        if (t['addr:housenumber']) addr += ' ' + t['addr:housenumber'];
        if (t['addr:postcode'] || t['addr:city']) {
            addr += ', ';
            if (t['addr:postcode']) addr += t['addr:postcode'] + ' ';
            if (t['addr:city']) addr += t['addr:city'];
        }
    }
    html += `<div><strong>Adresse:</strong> ${addr.trim() || store.location || '-'}</div>`;
    if (store.distance != null) html += `<div><strong>Entfernung:</strong> ${store.distance.toFixed(1)} km</div>`;
    if (store.tags) {
        if (store.tags.opening_hours) html += `<div><strong>Öffnungszeiten:</strong> ${store.tags.opening_hours}</div>`;
        if (store.tags.website || store.tags['contact:website']) html += `<div><strong>Website:</strong> <a href="${store.tags.website || store.tags['contact:website']}" target="_blank">${store.tags.website || store.tags['contact:website']}</a></div>`;
        if (store.tags.phone || store.tags['contact:phone']) html += `<div><strong>Telefon:</strong> ${store.tags.phone || store.tags['contact:phone']}</div>`;
        if (store.tags.wheelchair) html += `<div><strong>Rollstuhlgeeignet:</strong> ${store.tags.wheelchair}</div>`;
    }
    html += `<details style="margin-top:8px"><summary>Alle OSM-Tags</summary><pre>${JSON.stringify(store.tags || {}, null, 2)}</pre></details>`;
    content.innerHTML = html;
    osmLink.href = store.edit_url || store.osm_url || '#';
    panel.style.display = 'block';
    // Favoriten-Button setzen
    if (favBtn && store.osm_id) {
        let favorites = [];
        try { favorites = JSON.parse(localStorage.getItem('wirkaufenfair_favstores') || '[]'); } catch { }
        const isFav = favorites.includes(String(store.osm_id));
        favBtn.textContent = isFav ? '★' : '☆';
        favBtn.title = isFav ? 'Favorit entfernen' : 'Als Favorit markieren';
        favBtn.onclick = () => {
            let favs = [];
            try { favs = JSON.parse(localStorage.getItem('wirkaufenfair_favstores') || '[]'); } catch { }
            const idx = favs.indexOf(String(store.osm_id));
            if (idx >= 0) { favs.splice(idx, 1); } else { favs.push(String(store.osm_id)); }
            localStorage.setItem('wirkaufenfair_favstores', JSON.stringify(favs));
            showStoreDetail(store); // UI sofort aktualisieren
            populateStoreSelect(); // Dropdown neu sortieren
        };
        favBtn.style.visibility = 'visible';
    } else if (favBtn) {
        favBtn.style.visibility = 'hidden';
    }
}

function hideStoreDetail() {
    const panel = document.getElementById('store-detail');
    if (panel) panel.style.display = 'none';
}

// Hilfsfunktion: Aktuelle Auswahl im Label anzeigen
function updateStoreSelectedLabel(store) {
    const label = document.getElementById('store-selected-label');
    if (!label) return;
    if (!store) {
        label.textContent = 'Laden auswählen...';
        return;
    }
    let name = store.full_name || store.chain || 'Unbekannt';
    let addr = '';
    if (store.tags) {
        const t = store.tags;
        if (t['addr:street']) addr += t['addr:street'];
        if (t['addr:housenumber']) addr += ' ' + t['addr:housenumber'];
        if (t['addr:postcode'] || t['addr:city']) {
            addr += ', ';
            if (t['addr:postcode']) addr += t['addr:postcode'] + ' ';
            if (t['addr:city']) addr += t['addr:city'];
        }
    }
    let labelText = name;
    if (addr.trim()) labelText += ' – ' + addr.trim();
    if (store.distance != null) labelText += ` (${store.distance.toFixed(1)} km)`;
    label.textContent = labelText;
}

// Hilfsfunktion: Finde Store anhand von full_name ODER osm_id
function getSelectedStoreObj() {
    const stores = window._lastFetchedStores || [];
    // Versuche zuerst exakte OSM-ID, dann Fallback auf Name
    let store = stores.find(s => String(s.osm_id) === String(selectedStore));
    if (!store) store = stores.find(s => s.full_name === selectedStore);
    return store;
}

// Dropdown-Trigger: Klick auf Label zeigt Liste an
window.addEventListener('DOMContentLoaded', () => {
    const label = document.getElementById('store-selected-label');
    const container = document.getElementById('custom-store-dropdown');
    if (label && container) {
        label.addEventListener('click', () => {
            const list = container.querySelector('.custom-dropdown-list');
            if (list) list.style.display = '';
        });
    }
    // Nach Laden der Seite: Wenn ein Store gespeichert ist, Label setzen
    const storeObj = (window._lastFetchedStores || []).find(s => s.full_name === selectedStore);
    // DEBUG: Log selectedStore und storeObj
    console.log('selectedStore:', selectedStore);
    console.log('getSelectedStoreObj():', storeObj);
    updateStoreSelectedLabel(storeObj);
});
