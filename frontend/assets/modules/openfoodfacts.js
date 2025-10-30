// openfoodfacts.js
// OpenFoodFacts API Integration für WirKaufenFair

export async function fetchOffProducts(query, limit = 50, max_results = null, sort_by = 'fair') {
    try {
        let url = `/api/v1/openfoodfacts/search?query=${encodeURIComponent(query)}&page_size=${limit}&sort_by=${encodeURIComponent(sort_by)}`;
        if (max_results) url += `&max_results=${encodeURIComponent(max_results)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('OFF search failed');
        const data = await res.json();
        return data.products || [];
    } catch (e) {
        console.error('OFF fetch error:', e);
        return [];
    }
}

export async function fetchOffProductByBarcode(barcode) {
    try {
        const url = `/api/v1/openfoodfacts/product/${barcode}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.product || null;
    } catch (e) {
        console.error('OFF barcode lookup error:', e);
        return null;
    }
}

export async function enrichLocalProductsWithOFF(scoredLocal, useLiveOFF = true) {
    if (!useLiveOFF) return;
    const promises = scoredLocal.map(async (scored) => {
        const p = scored.product;
        if (p.ecoscore && p.nutriscore) return;
        if (!p.barcode) return;
        try {
            const offProduct = await fetchOffProductByBarcode(p.barcode);
            if (offProduct) {
                // Merge OFF data into local product
                Object.assign(p, offProduct);
            }
        } catch (e) {
            // ignore
        }
    });
    await Promise.all(promises);
}

export function parseQuantity(quantityStr) {
    if (!quantityStr) return null;
    let s = String(quantityStr).toLowerCase().trim();
    s = s.replace('\u00a0', ' ');
    // multiplicative patterns: '2x250g', '6 x 330 ml', '4er pack 250 g'
    let m = s.match(/(\d+)\s*(?:x|×|er|pack|stk|st)\s*([\d.,]+)\s*(g|kg|ml|l)?/i);
    if (m) {
        const count = parseInt(m[1], 10);
        let amt = parseFloat(m[2].replace(',', '.'));
        let unit = (m[3] || 'g').toLowerCase();
        if (unit === 'kg') { amt *= 1000; unit = 'g'; }
        if (unit === 'l') { amt *= 1000; unit = 'ml'; }
        return { amount: count * amt, unit };
    }
    m = s.match(/^([\d.,]+)\s*(g|kg|ml|l|cl|dl|stück|st)?$/i);
    if (!m) return null;
    let amount = parseFloat(m[1].replace(',', '.'));
    let unit = (m[2] || 'x').toLowerCase();
    if (unit === 'kg') { amount *= 1000; unit = 'g'; }
    if (unit === 'l') { amount *= 1000; unit = 'ml'; }
    if (unit === 'stück' || unit === 'st') unit = 'x';
    return { amount, unit };
}

export function extractProductQuantity(product) {
    if (!product) return null;
    if (product.size_amount && product.size_unit) {
        let amount = product.size_amount;
        let unit = product.size_unit.toLowerCase();
        if (unit === 'kg') { amount *= 1000; unit = 'g'; }
        if (unit === 'l') { amount *= 1000; unit = 'ml'; }
        if (unit === 'stück' || unit === 'st') { unit = 'x'; }
        return { amount, unit };
    }
    const quantity = product.quantity || '';
    const match = String(quantity).match(/([\d.,]+)\s*(g|kg|ml|l|cl|dl)/i);
    if (!match) return null;
    let amount = parseFloat(match[1].replace(',', '.'));
    let unit = match[2].toLowerCase();
    if (unit === 'kg') { amount *= 1000; unit = 'g'; }
    if (unit === 'l') { amount *= 1000; unit = 'ml'; }
    if (unit === 'cl') { amount *= 10; unit = 'ml'; }
    if (unit === 'dl') { amount *= 100; unit = 'ml'; }
    return { amount, unit };
}

export function calculateOptimalQuantity(needed, productQty) {
    if (!needed || !productQty) return null;
    if (needed.unit !== productQty.unit) return null;
    const count = Math.ceil(needed.amount / productQty.amount);
    const totalAmount = count * productQty.amount;
    return { count, totalAmount, unit: needed.unit };
}

export async function enrichSuggestionsWithRatingsAndPrices(suggestions, selectedStore = '') {
    if (!Array.isArray(suggestions) || suggestions.length === 0) return;
    const promises = suggestions.map(async (sug) => {
        const p = (sug && sug.product) ? sug.product : sug;
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
            // ignore
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
                        p.current_price = priceData.price;
                    }
                }
            } catch (e) {
                // ignore
            }
        }
    });
    await Promise.all(promises);
}
