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
})();
