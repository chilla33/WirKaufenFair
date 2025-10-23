// route.js
// Visualisierung der optimalen Einkaufsroute

export function renderRoute(shoppingList) {
    const routeMap = document.getElementById('route-map');
    if (!routeMap) return;
    const matchedItems = shoppingList.filter(item => item.matched);
    if (matchedItems.length === 0) {
        routeMap.innerHTML = `<div class="empty-state" style="padding:20px;"><p>Füge Artikel hinzu um deine optimale Route zu sehen!</p></div>`;
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
