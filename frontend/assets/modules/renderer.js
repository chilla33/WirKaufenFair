// Preisberechnung für die gesamte Liste
export function calculateTotalPrice(list) {
    let total = 0;
    list.forEach(item => {
        if (item.matched && item.matched.current_price && item.calculation) {
            total += item.matched.current_price * item.calculation.count;
        } else if (item.matched && item.matched.current_price) {
            total += item.matched.current_price;
        }
    });
    return total;
}

// Alternative Listen-Renderfunktion mit Preisen und Route
import { renderRoute } from './route.js';
export function renderListWithPrices(list, store) {
    const container = document.getElementById('list-container');
    const countBadge = document.getElementById('item-count');
    countBadge.textContent = list.length;
    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>📝 Deine Einkaufsliste ist leer.</p>
                <p>Wähle einen Laden und füge Artikel hinzu!</p>
            </div>
        `;
        renderTotalPrice(list);
        renderRoute(list);
        return;
    }
    if (!store) {
        container.innerHTML = `
            <div class="empty-state">
                <p>🏪 Bitte wähle zuerst einen Laden aus.</p>
            </div>
        `;
        renderTotalPrice(list);
        renderRoute(list);
        return;
    }
        container.innerHTML = list.map((item, i) => {
            // use item.text (new) or fallback to item.query (old)
            const label = item.text || item.query || item.name || 'undefined';
            return `<div>${label}</div>`;
        }).join('');
    renderTotalPrice(list);
    renderRoute(list);
}

export function renderTotalPrice(list) {
    const container = document.getElementById('total-price-container');
    if (!container) return;
    const total = calculateTotalPrice(list);
    if (total > 0) {
        container.innerHTML = `
            <div class="total-price">
                💰 Gesamtpreis: ${total.toFixed(2)} EUR
            </div>
        `;
    } else {
        container.innerHTML = '';
    }
}
// renderer.js
// UI Rendering für WirKaufenFair

// Dummy-Variablen für Demo (werden im Main-Modul ersetzt)
let shoppingList = [];
let selectedStore = '';

export function setRenderContext(list, store) {
    shoppingList = list;
    selectedStore = store;
}

export function renderList() {
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
    const storeHint = !selectedStore
        ? '<div style="background:#fef3c7;padding:12px;border-radius:8px;margin-bottom:16px;"><strong>💡 Tipp:</strong> Wähle einen Laden für Preise & Verfügbarkeit oder führe eine allgemeine Liste.</div>'
        : '';
        container.innerHTML = storeHint + shoppingList.map((item, i) => {
            const label = item.text || item.query || item.name || 'undefined';
            return `<div>${label}</div>`;
        }).join('');
    renderTotalSummary();
}

export function renderTotalSummary() {
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
    totalContainer.innerHTML = `
        <div class="total-summary">
            <strong>Gesamtsumme:</strong> ca. ${totalPrice.toFixed(2)} €
            <span style="font-size:12px;color:#888;">(${confirmedCount} bestätigt${hasEstimates ? `, ${estimatedCount} geschätzt` : ''})</span>
        </div>
    `;
}

export function formatUnit(amount, unit) {
    if (!unit) return amount.toString();
    if (unit === 'g' && amount >= 1000) {
        return `${(amount / 1000).toFixed(2)} kg`;
    }
    if (unit === 'ml' && amount >= 1000) {
        return `${(amount / 1000).toFixed(2)} L`;
    }
    return `${amount} ${unit}`;
}
