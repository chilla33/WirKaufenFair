// Compatibility shim: expose the functions from the non-module openfoodfacts_api.js
// openfoodfacts_api.js attaches helpers to window (fetchOffProducts, fetchOffProductByBarcode, enrichLocalProductsWithOFF)
// This shim provides named exports that proxy to those global functions so `import * as off from './openfoodfacts.js'` works.
export function fetchOffProducts(query, limit = 20, maxResults = null) {
	return window.fetchOffProducts ? window.fetchOffProducts(query, limit, maxResults) : Promise.resolve([]);
}

export function fetchOffProductByBarcode(barcode) {
	return window.fetchOffProductByBarcode ? window.fetchOffProductByBarcode(barcode) : Promise.resolve(null);
}

export function enrichLocalProductsWithOFF(scoredLocal, useLiveOFF = true) {
	return window.enrichLocalProductsWithOFF ? window.enrichLocalProductsWithOFF(scoredLocal, useLiveOFF) : Promise.resolve();
}

// Default export for older code that expects a default object
export default {
	fetchOffProducts,
	fetchOffProductByBarcode,
	enrichLocalProductsWithOFF
};
