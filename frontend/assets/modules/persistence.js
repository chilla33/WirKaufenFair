// persistence.js
// LocalStorage Management für WirKaufenFair

const STORAGE_PREFIX = 'wkf-list-';

export function getStorageKey(storeName) {
    return storeName ? `${STORAGE_PREFIX}${storeName}` : `${STORAGE_PREFIX}general`;
}

export function loadFromLocalStorage(storeName) {
    const key = getStorageKey(storeName);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        console.warn('LocalStorage load error:', e);
        return [];
    }
}

export function saveToLocalStorage(storeName, list) {
    const key = getStorageKey(storeName);
    try {
        localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
        console.warn('LocalStorage save error:', e);
    }
}

export function loadLocationBannerState() {
    try {
        return localStorage.getItem('wkf-location-banner') === 'hidden';
    } catch {
        return false;
    }
}

export function saveLocationBannerState(hidden) {
    try {
        localStorage.setItem('wkf-location-banner', hidden ? 'hidden' : 'visible');
    } catch { }
}
