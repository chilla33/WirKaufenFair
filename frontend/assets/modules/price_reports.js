// price_reports.js
// Extracted submitPrice function so price reporting logic is reusable and separated from the main shopping list file.

async function submitPrice(index) {
    // shoppingList is expected to be a global variable defined by shopping_list.js
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

// Keep backward compatibility for inline onclick handlers that call window.submitPrice
window.submitPrice = submitPrice;
