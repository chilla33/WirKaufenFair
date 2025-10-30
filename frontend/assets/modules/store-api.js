// store-api.js
// Laden- und Produkt-API für WirKaufenFair

let userLocation = null;
let allProducts = [];

export function setUserLocation(location) {
    userLocation = location;
}

export function getUserLocation() {
    return userLocation;
}

export function getAllProducts() {
    return allProducts;
}

export async function loadStores() {
    let storesUrl = '/api/v1/stores?limit=200';
    if (userLocation) {
        storesUrl += `&lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=50`;
    }
    let stores = [];
    try {
        const storesRes = await fetch(storesUrl);
        if (storesRes.ok) {
            stores = await storesRes.json();
        }
    } catch (e) {
        console.warn('Store API not available, falling back to ProductLocations');
    }
    // Fallback: Lade aus ProductLocations falls Store-API leer
    if (stores.length === 0) {
        try {
            const res = await fetch('/api/v1/product_locations');
            const data = await res.json();
            allProducts = Array.isArray(data) ? data : [];
            // Extrahiere Stores aus ProductLocations
            const storeNames = [...new Set(allProducts.map(p => p.store_name).filter(Boolean))];
            stores = storeNames.map(name => {
                const parts = name.split(' ');
                return {
                    full_name: name,
                    chain: parts[0],
                    location: parts.slice(1).join(' ') || null
                };
            });
        } catch (e) {
            console.error('Fehler beim Laden von /api/v1/product_locations:', e);
            allProducts = [];
            stores = [];
        }
    } else {
        try {
            const res = await fetch('/api/v1/product_locations');
            const data = await res.json();
            allProducts = Array.isArray(data) ? data : [];
        } catch (e) {
            console.error('Fehler beim Laden von /api/v1/product_locations (secondary):', e);
            allProducts = [];
        }
    }
    return stores;
}
