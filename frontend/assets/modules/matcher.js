// matcher.js
// Fuzzy Matching, Kategorien, Synonyme für WirKaufenFair

export const SYNONYMS = {
    'milch': ['milch', 'vollmilch', 'frischmilch', 'h-milch'],
    'joghurt': ['joghurt', 'jogurt', 'yogurt', 'yoghurt'],
    'käse': ['käse', 'cheese', 'gouda', 'emmentaler'],
    'brot': ['brot', 'bread', 'vollkornbrot', 'toast']
};

export const CATEGORIES = {
    'obst': ['apfel', 'birne', 'banane', 'orange', 'erdbeere'],
    'gemüse': ['tomate', 'gurke', 'paprika', 'salat', 'möhre', 'kartoffel'],
    'milchprodukte': ['milch', 'joghurt', 'käse', 'quark', 'sahne'],
    'butter': ['butter', 'margarine'],
    'fleisch': ['rind', 'schwein', 'hähnchen', 'huhn', 'pute', 'wurst'],
    'getränke': ['wasser', 'saft', 'limonade', 'cola', 'tee', 'kaffee', 'bier']
};

export const CATEGORY_EXCLUSIONS = {
    'milch': ['butter'],
    'joghurt': ['butter'],
};

export function getProductCategory(productName) {
    const nameLower = (productName || '').toLowerCase();
    for (const [category, items] of Object.entries(CATEGORIES)) {
        if (items.some(item => nameLower.includes(item))) {
            return category;
        }
    }
    return null;
}

export function shouldExcludeProduct(queryTokens, productName) {
    const productCategory = getProductCategory(productName);
    if (!productCategory) return false;
    for (const token of queryTokens) {
        const exclusions = CATEGORY_EXCLUSIONS[token] || [];
        if (exclusions.includes(productCategory)) {
            console.log(`  ✗ Excluded (category filter): "${productName}" is in "${productCategory}", excluded by query token "${token}"`);
            return true;
        }
    }
    return false;
}

export const BRANDS = ['danone', 'müller', 'arla', 'weihenstephan', 'alpro', 'oatly', 'nestlé', 'coca-cola'];
export const STOP_WORDS = new Set(['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem', 'und', 'oder', 'mit', 'ohne', 'für', 'zum', 'zur', 'von', 'im', 'in', 'auf', 'an', 'am', 'zu', 'bei']);

export function expandQueryWithSynonyms(query) {
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);
    const expanded = new Set([q]);
    words.forEach(word => {
        for (const [key, synonyms] of Object.entries(SYNONYMS)) {
            if (word === key || synonyms.includes(word)) {
                expanded.add(key);
                synonyms.forEach(syn => expanded.add(syn));
            }
        }
    });
    return Array.from(expanded).filter(x => x !== q);
}

export function expandQueryWithCategories(query) {
    const q = query.toLowerCase().trim();
    const expanded = new Set();
    for (const [category, items] of Object.entries(CATEGORIES)) {
        if (items.includes(q) || q.includes(category)) {
            items.forEach(item => expanded.add(item));
        }
    }
    return Array.from(expanded);
}

export function brandBoost(query, targetProduct) {
    const q = query.toLowerCase();
    const t = targetProduct.toLowerCase();
    for (const brand of BRANDS) {
        if (q.includes(brand) && t.includes(brand)) {
            return 0.2;
        }
    }
    return 0;
}

export function fuzzyMatch(query, target, threshold = 0.6) {
    const q = query.toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (t.includes(q)) return 1.0;
    const qWords = q.split(/\s+/);
    const tWords = t.split(/\s+/);
    if (qWords.length === 1 && tWords.some(w => w === q)) {
        return 0.95;
    }
    const multiScore = multiTokenMatch(q, t);
    if (multiScore >= 0.7) return multiScore;
    const distance = levenshteinDistance(q, t);
    const maxLen = Math.max(q.length, t.length);
    const similarity = 1 - (distance / maxLen);
    return similarity >= Math.max(threshold, 0.7) ? similarity : 0;
}

// Dummy-Implementierungen für multiTokenMatch und levenshteinDistance
export function multiTokenMatch(q, t) {
    // TODO: Echte Implementierung übernehmen
    return 0;
}
export function levenshteinDistance(a, b) {
    // TODO: Echte Implementierung übernehmen
    return Math.abs(a.length - b.length);
}
