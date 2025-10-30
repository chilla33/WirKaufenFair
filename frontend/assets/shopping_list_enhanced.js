// Enhanced shopping list with prices and route visualization
// This file extends shopping_list_v2.js with price calculation, price history charts, and route visualization

// Add price calculation to renderList
function calculateTotalPrice() {
    let total = 0;
    shoppingList.forEach(item => {
        if (item.matched && item.matched.current_price && item.calculation) {
            total += item.matched.current_price * item.calculation.count;
        } else if (item.matched && item.matched.current_price) {
            total += item.matched.current_price;
        }
    });
    return total;
}

function renderTotalPrice() {
    const container = document.getElementById('total-price-container');
    if (!container) return;

    const total = calculateTotalPrice();
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

function renderRoute() {
    const routeMap = document.getElementById('route-map');
    if (!routeMap) return;

    const matchedItems = shoppingList.filter(item => item.matched);

    if (matchedItems.length === 0) {
        routeMap.innerHTML = `
            <div class="empty-state" style="padding:20px;">
                <p>Füge Artikel hinzu um deine optimale Route zu sehen!</p>
            </div>
        `;
        return;
    }

    routeMap.innerHTML = matchedItems.map((item, i) => {
        const product = item.matched;
        const location = [product.aisle, product.shelf_label].filter(Boolean).join(', ') || 'Standort unbekannt';
        return `
            <div class="route-step">
                <div class="step-number">${i + 1}</div>
                <div class="step-info">
                    <div class="step-product">${item.query}</div>
                    <div class="step-location">📍 ${location}</div>
                </div>
            </div>
        `;
    }).join('');
}

function showPriceHistory(productName, priceHistory, currentPrice) {
    const modal = document.getElementById('price-modal');
    const modalTitle = document.getElementById('modal-title');
    const canvas = document.getElementById('price-chart');

    if (!modal || !modalTitle || !canvas) return;

    modalTitle.textContent = `Preisverlauf: ${productName}`;
    modal.classList.add('active');

    // Prepare data for chart
    const history = priceHistory || [];
    const allData = [...history, { date: new Date().toISOString().split('T')[0], price: currentPrice }];

    const labels = allData.map(h => h.date);
    const prices = allData.map(h => h.price);

    // Create chart
    const ctx = canvas.getContext('2d');

    // Destroy previous chart if exists
    if (window.priceChart) {
        window.priceChart.destroy();
    }

    const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || 'rgb(14,165,233)').trim();
    window.priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Preis (EUR)',
                data: prices,
                borderColor: accent,
                backgroundColor: 'rgba(14, 165, 233, 0.08)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.parsed.y.toFixed(2) + ' EUR';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function (value) {
                            return value.toFixed(2) + ' EUR';
                        }
                    }
                }
            }
        }
    });
}

function closePriceModal() {
    const modal = document.getElementById('price-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Extend renderList to include prices
async function renderListWithPrices() {
    // Show a loading state while fetching live data
    const containerEl = document.getElementById('list-container');
    if (containerEl) {
        containerEl.innerHTML = '<div class="empty-state"><p>🔎 Suche passende Produkte…</p></div>';
    }

    await matchProducts();
    sortByStoreLayout();

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
        renderTotalPrice();
        renderRoute();
        return;
    }

    if (!selectedStore) {
        container.innerHTML = `
            <div class="empty-state">
                <p>🏪 Bitte wähle zuerst einen Laden aus.</p>
            </div>
        `;
        renderTotalPrice();
        renderRoute();
        return;
    }

    container.innerHTML = shoppingList.map((item, i) => {
        const matched = item.matched;
        const matchedClass = matched ? 'matched' : '';

        let queryDisplay = item.query;
        if (item.needed) {
            queryDisplay = `${formatUnit(item.needed.amount, item.needed.unit)} ${item.query}`;
        }

        let calcDisplay = '';
        if (item.calculation) {
            const calc = item.calculation;
            calcDisplay = `<div class="item-calc">💡 Kaufe ${calc.count}x → Gesamt: ${formatUnit(calc.totalAmount, calc.unit)}</div>`;
        }

        let priceDisplay = '';
        if (matched && matched.current_price) {
            const unitPrice = matched.current_price;
            const totalPrice = item.calculation ? (unitPrice * item.calculation.count) : unitPrice;

            // Calculate per-unit price (kg/L)
            const perUnit = calculateUnitPrice(matched);
            const perUnitStr = perUnit ? ` <span style="color:var(--text-muted);font-size:11px;">(${perUnit.display})</span>` : '';

            priceDisplay = `<div class="item-price">💰 ${totalPrice.toFixed(2)} EUR ${item.calculation ? `(${unitPrice.toFixed(2)} EUR/Stk)` : ''}${perUnitStr}</div>`;

            if (matched.price_history && matched.price_history.length > 0) {
                priceDisplay += `<div class="item-price-history" onclick="window.showPriceHistory('${matched.product_identifier.replace(/'/g, "\\'")}', ${JSON.stringify(matched.price_history)}, ${matched.current_price})">📊 Preisverlauf anzeigen</div>`;
            }
        } else if (matched && matched.estimated_price) {
            const unitPrice = matched.estimated_price;
            const totalPrice = item.calculation ? (unitPrice * item.calculation.count) : unitPrice;

            // Calculate per-unit price (kg/L)
            const perUnit = calculateUnitPrice(matched);
            const perUnitStr = perUnit ? ` <span style="color:var(--text-muted);font-size:11px;">(≈ ${perUnit.display})</span>` : '';

            priceDisplay = `<div class="item-price">💰 ≈ ${totalPrice.toFixed(2)} EUR ${item.calculation ? `(≈ ${unitPrice.toFixed(2)} EUR/Stk)` : ''}${perUnitStr}</div>`;
        }

        let details = '';
        if (matched) {
            const location = [matched.aisle, matched.shelf_label].filter(Boolean).join(', ');
            details = `
                <div class="item-details">
                    <span class="item-location">📍 ${location || 'Standort unbekannt'}</span>
                    ${matched.photo_url ? `<a href="${matched.photo_url}" target="_blank" style="margin-left:8px;color:var(--accent);">🖼️ Foto</a>` : ''}
                    <span style="margin-left:8px;color:var(--text-muted);">👍 ${matched.upvotes} | 👎 ${matched.downvotes}</span>
                    ${matched.status === 'verified' ? '<span style="margin-left:8px;color:var(--success);">✅ Verifiziert</span>' : ''}
                </div>
            `;
        } else {
            details = `<div class="item-details" style="color:var(--danger);">❌ Kein Produkt für "${item.query}" in diesem Laden gefunden.</div>`;
        }

    const sourceBadge = item.matchedSource === 'off' ? '<span class="badge" style="background:var(--text-muted);margin-left:8px;">OFF</span>' : '';
                return `
            <div class="list-item ${matchedClass}">
                <div class="item-text">
                    <div class="item-query">${queryDisplay} ${sourceBadge}</div>
                    ${matched ? `<div style="font-size:14px;color:var(--text-muted);margin-top:2px;">→ ${matched.product_identifier}</div>` : ''}
                    ${calcDisplay}
                    ${priceDisplay}
                    ${details}
                </div>
                <button onclick="window.removeShoppingItem(${i})">❌</button>
            </div>
        `;
    }).join('');

    renderTotalPrice();
    renderRoute();
}

// Export functions
window.showPriceHistory = showPriceHistory;
window.closePriceModal = closePriceModal;
window.renderListWithPrices = renderListWithPrices;
