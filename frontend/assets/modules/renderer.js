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

function normalizeLabels(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(s => String(s));
    if (typeof val === 'string') return val.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    return [];
}

// Alternative Listen-Renderfunktion mit Preisen und Route
import { renderRoute } from './route.js';
import * as scoring from './scoring.js';
// Chart.js is optional; only used when available on the page

export function showPriceHistory(productName, priceHistory, currentPrice) {
    const modal = document.getElementById('price-modal');
    const modalTitle = document.getElementById('modal-title');
    const canvas = document.getElementById('price-chart');
    if (!modal || !modalTitle || !canvas) return;
    modalTitle.textContent = `Preisverlauf: ${productName}`;
    modal.classList.add('active');
    const history = priceHistory || [];
    const allData = [...history, { date: new Date().toISOString().split('T')[0], price: currentPrice }];
    const labels = allData.map(h => h.date);
    const prices = allData.map(h => h.price);
    try {
        const ctx = canvas.getContext('2d');
        if (window.priceChart) window.priceChart.destroy();
        if (window.Chart) {
            window.priceChart = new window.Chart(ctx, {
                type: 'line',
                data: { labels, datasets: [{ label: 'Preis (EUR)', data: prices, borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.1)', tension: 0.3, fill: true }] },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        } else {
            // Fallback: render simple text
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#000';
            ctx.fillText('Chart.js nicht geladen', 10, 20);
        }
    } catch (e) {
        console.warn('Failed to render price chart', e);
    }
}

export function closePriceModal() {
    const modal = document.getElementById('price-modal');
    if (modal) modal.classList.remove('active');
}
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
        const title = item.text || (item.off && (item.off.product_name || item.off.display_name)) || item.query || 'Unbenannt';
        const qty = item.quantity ? `<span style="color:#64748b;margin-left:8px;font-weight:600;">${item.quantity}</span>` : '';
        const img = (item.off && (item.off.image_small_url || item.off.image_url)) ? `<img src="${item.off.image_small_url || item.off.image_url}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;">` : `<div style="width:56px;height:56px;border-radius:6px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;">📦</div>`;
        const nutri = item.off && (item.off.nutriscore_grade || item.off.nutriscore) ? (item.off.nutriscore_grade || item.off.nutriscore) : '-';
        const eco = item.off && (item.off.ecoscore_grade || item.off.ecoscore) ? (item.off.ecoscore_grade || item.off.ecoscore) : '-';
        const fairScoreObj = item.off ? (item.off.__fairScore != null ? { total: Number(item.off.__fairScore) } : scoring.computeFairComponents(item.off, 'off')) : null;
        const fairScore = fairScoreObj ? (fairScoreObj.total || 0) : null;
        let fairBadge = '';
        if (fairScore != null) {
            let bg = '#ecfdf5';
            let color = '#065f46';
            if (fairScore >= 0.75) { bg = '#ecfdf5'; color = '#065f46'; }
            else if (fairScore >= 0.5) { bg = '#fffbeb'; color = '#854d0e'; }
            else { bg = '#fff7f2'; color = '#9a3412'; }
            const tooltip = fairScoreObj ? `Eco:${fairScoreObj.ecoScore.toFixed(2)} Nutri:${fairScoreObj.nutriScore.toFixed(2)} Ethics:${(fairScoreObj.ethicsScore || 0).toFixed(2)}` : '';
            fairBadge = `<div title="${tooltip}" style="font-size:13px;color:${color};font-weight:700;background:${bg};padding:6px 8px;border-radius:6px;">${fairScore.toFixed(2)}</div>`;
        }
        const labelsArr = item.off ? normalizeLabels(item.off.labels || item.off.labels_tags) : [];
        const labels = labelsArr.slice(0, 4).map(l => `<span style="background:#eef2ff;padding:4px 8px;border-radius:6px;margin-right:6px;font-size:12px;">${l}</span>`).join('');
        const meta = item.off ? `<details style="margin-top:8px"><summary style="cursor:pointer">OFF Meta</summary><pre style="max-height:240px;overflow:auto">${JSON.stringify(item.off, null, 2)}</pre></details>` : '';
        return `
                    <div class="list-item" style="padding:12px;border-bottom:1px solid #eef2f6;display:flex;">
                        <div style="margin-right:12px">${img}</div>
                        <div style="flex:1">
                            <div style="display:flex;align-items:center;justify-content:space-between;">
                                <div style="font-weight:700;font-size:16px">${title}${qty}</div>
                                <div style="text-align:right"><div style="color:#64748b;font-size:13px">Nutri: ${nutri} • Eco: ${eco}</div><div style="margin-top:6px">${fairBadge}</div></div>
                            </div>
                            <div style="margin-top:6px;color:#475569;font-size:13px">${labels}</div>
                            ${meta}
                        </div>
                    </div>
                `;
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
        const title = item.text || (item.off && (item.off.product_name || item.off.display_name)) || item.query || 'Unbenannt';
        const qty = item.quantity ? `<span style="color:#64748b;margin-left:8px;font-weight:600;">${item.quantity}</span>` : '';
        const img = (item.off && (item.off.image_small_url || item.off.image_url || item.off.image_front_small_url)) ? `<img src="${item.off.image_small_url || item.off.image_url || item.off.image_front_small_url}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;">` : `<div style="width:56px;height:56px;border-radius:6px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;">📦</div>`;
        const nutri = item.off && (item.off.nutriscore_grade || item.off.nutriscore) ? (item.off.nutriscore_grade || item.off.nutriscore) : '-';
        const eco = item.off && (item.off.ecoscore_grade || item.off.ecoscore) ? (item.off.ecoscore_grade || item.off.ecoscore) : '-';
        const labelsArr = item.off ? normalizeLabels(item.off.labels || item.off.labels_tags) : [];
        const labels = labelsArr.slice(0, 4).map(l => `<span style="background:#eef2ff;padding:4px 8px;border-radius:6px;margin-right:6px;font-size:12px;">${l}</span>`).join('');
        const meta = item.off ? `<details style="margin-top:8px"><summary style="cursor:pointer">OFF Meta</summary><pre style="max-height:240px;overflow:auto">${JSON.stringify(item.off, null, 2)}</pre></details>` : '';
        return `
                    <div class="list-item" style="padding:12px;border-bottom:1px solid #eef2f6;display:flex;">
                        <div style="margin-right:12px">${img}</div>
                        <div style="flex:1">
                            <div style="display:flex;align-items:center;justify-content:space-between;">
                                <div style="font-weight:700;font-size:16px">${title}${qty}</div>
                                <div style="color:#64748b;font-size:13px">Nutri: ${nutri} • Eco: ${eco}</div>
                            </div>
                            <div style="margin-top:6px;color:#475569;font-size:13px">${labels}</div>
                            ${meta}
                        </div>
                    </div>
                `;
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
