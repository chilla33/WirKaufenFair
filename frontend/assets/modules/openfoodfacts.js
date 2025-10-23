// openfoodfacts.js
// OpenFoodFacts API Integration für WirKaufenFair

export async function fetchOffProducts(query, limit = 20) {
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
    const match = quantityStr.trim().match(/^([\d.,]+)\s*(g|kg|ml|l|x|stück|st)?$/i);
    if (!match) return null;
    let amount = parseFloat(match[1].replace(',', '.'));
    let unit = (match[2] || 'x').toLowerCase();
    if (unit === 'kg') { amount *= 1000; unit = 'g'; }
    if (unit === 'l') { amount *= 1000; unit = 'ml'; }
    if (unit === 'stück' || unit === 'st') { unit = 'x'; }
    return { amount, unit };
}
