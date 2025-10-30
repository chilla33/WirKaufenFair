// Small wrapper to call the backend OFF search proxy. Exposes window.fetchOffProducts
(function () {
    async function fetchOffProducts(query, limit = 20, maxResults = null) {
        try {
            let url = `/api/v1/openfoodfacts/search?query=${encodeURIComponent(query)}&page_size=${limit}`;
            if (maxResults && Number(maxResults) > Number(limit)) {
                url += `&max_results=${encodeURIComponent(maxResults)}`;
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error('OFF search failed');
            const data = await res.json();
            return data.products || [];
        } catch (e) {
            console.error('OFF fetch error:', e);
            return [];
        }
    }
    // Expose globally (shopping_list_v2.js expects fetchOffProducts to be available)
    window.fetchOffProducts = fetchOffProducts;

    // Also provide barcode lookup helper
    async function fetchOffProductByBarcode(barcode) {
        try {
            if (!barcode) return null;
            const url = `/api/v1/openfoodfacts/product/${encodeURIComponent(barcode)}`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            return data.product || null;
        } catch (e) {
            console.error('OFF barcode lookup error:', e);
            return null;
        }
    }

    window.fetchOffProductByBarcode = fetchOffProductByBarcode;
    
    // Enrich local products with OFF data via barcode lookup
    async function enrichLocalProductsWithOFF(scoredLocal, useLiveOFF = true) {
        if (!useLiveOFF) return;
        if (!Array.isArray(scoredLocal) || scoredLocal.length === 0) return;
        const promises = scoredLocal.map(async (scored) => {
            const p = scored.product;
            if (!p) return;
            if (p.ecoscore && p.nutriscore) return;
            if (!p.barcode) return;
            try {
                const offProduct = await fetchOffProductByBarcode(p.barcode);
                if (offProduct) {
                    // merge useful fields if missing
                    if (!p.ecoscore && offProduct.ecoscore) {
                        p.ecoscore = offProduct.ecoscore;
                        p.ecoscore_grade = offProduct.ecoscore_grade;
                    }
                    if (!p.nutriscore && offProduct.nutriscore) {
                        p.nutriscore = offProduct.nutriscore;
                        p.nutriscore_grade = offProduct.nutriscore_grade;
                    }
                    if (!p.image_url && offProduct.image_url) p.image_url = offProduct.image_url;
                    if (!p.ethics_score && offProduct.ethics_score) {
                        p.ethics_score = offProduct.ethics_score;
                        p.ethics_issues = offProduct.ethics_issues;
                    }
                }
            } catch (e) {
                // ignore per-item failures
            }
        });
        await Promise.all(promises);
    }

    window.enrichLocalProductsWithOFF = enrichLocalProductsWithOFF;
})();