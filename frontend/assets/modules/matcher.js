// matcher.js
// Fuzzy Matching, Kategorien, Synonyme für WirKaufenFair

export const SYNONYMS = {
    'milch': ['milch', 'vollmilch', 'frischmilch', 'h-milch', 'hafermilch', 'haferdrink', 'hafer', 'oat', 'oatmilk', 'oat-milk', 'mandelmilch', 'mandel', 'almond', 'almondmilk', 'sojamilch', 'sojadrink', 'soja', 'soy', 'soy-milk', 'kokosmilch', 'coconut', 'drink', 'pflanzenmilch', 'plant milk', 'plantmilk'],
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
export const UNIT_WORDS = ['g', 'kg', 'ml', 'l', 'liter', 'st', 'stk', 'stück', 'x', 'pack', 'packung'];

export function stripQuantities(text) {
    return (text || '')
        .toLowerCase()
        .replace(/\d+[\,\.]?\d*\s*(g|kg|ml|l|liter|st|stk|x)\b/g, ' ')
        .replace(/\b\d+x\b/g, ' ')
        .replace(/\b\d+[\,\.]?\d*\b/g, ' ')
        .replace(/[^a-zäöüß\s]/g, ' ');
}

export function getCoreQueryTokens(query) {
    const cleaned = stripQuantities(query);
    const tokens = cleaned.split(/\s+/).filter(t => t && t.length >= 3 && !STOP_WORDS.has(t));
    return tokens;
}

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

// Small, curated morphological expansions for common stems (German + English)
// Used only for single-token queries to generate productive variants like
// 'hafer' -> ['hafermilch','haferdrink','oat milk'] which OFF often indexes
export const MORPHOLOGY = {
    'hafer': ['hafermilch', 'haferdrink', 'oat milk', 'oatmilk', 'oat-milk', 'hafermilch barista'],
    'mandel': ['mandelmilch', 'mandeldrink', 'almond milk', 'almondmilk'],
    'soja': ['sojamilch', 'sojadrink', 'soy milk', 'soya milk'],
    'reis': ['reismilch', 'reisdink', 'rice milk', 'ricemilk']
};

export function morphologicalExpansions(token) {
    if (!token) return [];
    const t = token.toLowerCase().trim();
    const results = new Set();
    // curated map
    if (MORPHOLOGY[t]) MORPHOLOGY[t].forEach(x => results.add(x));
    // generic heuristic: token + common suffixes (safe fallback)
    const suffixes = ['milch', 'drink', 'drink barista', 'barista', 'milk'];
    suffixes.forEach(suf => results.add(`${t} ${suf}`));
    // prefixes like 'oat <token>' for english variants
    const prefixes = ['oat', 'almond', 'soy', 'rice'];
    prefixes.forEach(pre => results.add(`${pre} ${t}`));
    // return unique, prefer shorter normalized forms
    return Array.from(results).filter(x => x && x.length > 2);
}

// Boost when product fields match strong regex patterns derived from the token
// For single-token queries we prefer whole-word or compound matches like 'hafermilch'
export function boostedRegexBoost(token, product) {
    if (!token || !product) return 0;
    const t = token.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '');
    if (!t) return 0;
    // build a few strong regexes: whole word, token+suffix, prefix+token, compound
    const patterns = [
        new RegExp(`\\b${t}\\b`, 'i'),
        new RegExp(`\\b${t}(?:milch|drink|-?milk|milk|-?drink)\\b`, 'i'),
        new RegExp(`\\b(?:oat|almond|soy|rice)\\s+${t}\\b`, 'i'),
        new RegExp(`\\b${t}[- ]?(?:milch|drink|milk)\\b`, 'i')
    ];
    const hay = [product.product_name, product.product_name_de, product.generic_name, product.brands, product.stores, product.categories, Array.isArray(product.categories_tags) ? product.categories_tags.join(' ') : '']
        .filter(Boolean)
        .join(' ').toLowerCase();
    for (const p of patterns) {
        try {
            if (p.test(hay)) {
                // strong hit -> decent boost
                return 0.20;
            }
        } catch (e) {
            // regex error - ignore
        }
    }
    return 0;
}

// Strict anchor match helper: only consider strong text fields to avoid noisy matches
// Fields considered: product_name, product_name_de, generic_name, brands
export function strictAnchorMatch(product, anchorLower) {
    const fields = {
        product_name: product.product_name,
        product_name_de: product.product_name_de,
        generic_name: product.generic_name,
        brands: product.brands
    };
    for (const a of anchorLower) {
        if (!a) continue;
        for (const [fname, val] of Object.entries(fields)) {
            if (!val) continue;
            try {
                if (val.toLowerCase().includes(a)) {
                    return { matched: true, field: fname };
                }
            } catch (e) {
                // ignore malformed field
            }
        }
    }
    return { matched: false };
}

// Diagnostic helper: fetch OFF products and show how many are kept vs filtered by strict anchor
export async function runAnchorFilterTest(query, pageSize = 60, maxResults = 180) {
    console.log('runAnchorFilterTest: fetching OFF products for', query);
    const offProducts = await off.fetchOffProducts(query, pageSize, maxResults, '');
    console.log('runAnchorFilterTest: OFF returned', offProducts.length);
    const anchorLower = getCoreQueryTokens(query).map(a => a.toLowerCase()).concat(...getCoreQueryTokens(query).flatMap(t => expandQueryWithSynonyms(t))).map(x => x.toLowerCase());
    const kept = [];
    const filtered = [];
    for (const p of offProducts) {
        const r = strictAnchorMatch(p, anchorLower);
        if (r.matched) kept.push({ p, field: r.field }); else filtered.push(p);
    }
    console.log(`runAnchorFilterTest: kept ${kept.length}, filtered ${filtered.length}`);
    console.log('runAnchorFilterTest: examples kept:', kept.slice(0, 6).map(x => ({ name: x.p.product_name || x.p.product_name_de || x.p.generic_name, field: x.field })));
    console.log('runAnchorFilterTest: examples filtered:', filtered.slice(0, 6).map(p => p.product_name || p.product_name_de || p.generic_name));
    return { kept, filtered };
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
    // startsWith / prefix boost: if any target token starts with a query token, prefer it
    let prefixBoost = 0;
    for (const qw of qWords) {
        for (const tw of tWords) {
            if (tw.startsWith(qw) && qw.length >= 2) {
                prefixBoost = 0.18;
                break;
            }
        }
        if (prefixBoost) break;
    }
    const finalScore = Math.min(1.0, similarity + prefixBoost);
    return finalScore >= Math.max(threshold, 0.6) ? finalScore : 0;
}

// Dummy-Implementierungen für multiTokenMatch und levenshteinDistance
export function multiTokenMatch(query, target) {
    const qTokens = query.toLowerCase().trim().split(/\s+/);
    const tTokens = target.toLowerCase().trim().split(/\s+/);

    let matchCount = 0;
    for (const qt of qTokens) {
        if (tTokens.some(tt => tt.includes(qt) || qt.includes(tt))) {
            matchCount++;
        }
    }

    return matchCount / qTokens.length;
}

export function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}


import * as scoring from './scoring.js';
import * as off from './openfoodfacts_api.js';

/**
 * Find suggestions by combining local products and OFF results.
 * Returns an array of { product, score, source }
 */
export async function findSuggestions(query, { allProducts = [], selectedStore = '', useLiveOFF = true, needed = null } = {}) {
    const coreTokens = getCoreQueryTokens(query);
    const isSingleToken = (coreTokens.length === 1);
    const anchorTerms = new Set(coreTokens);
    coreTokens.forEach(t => expandQueryWithSynonyms(t).forEach(s => anchorTerms.add(s)));
    const anchorList = Array.from(anchorTerms);

    const expandedQueries = [
        ...coreTokens,
        ...coreTokens.flatMap(t => expandQueryWithSynonyms(t)),
        ...coreTokens.flatMap(t => expandQueryWithCategories(t))
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    // local products for the selected store
    const localProducts = allProducts.filter(p => !selectedStore || p.store_name === selectedStore);

    const scoredLocal = localProducts.map(p => {
        const identifier = p.product_identifier || p.product_name || '';
        const idLower = identifier.toLowerCase();

        // mark excluded products but continue (do not hard-filter here)
        const excluded = shouldExcludeProduct(coreTokens, identifier);
        if (excluded) p.__excluded = true;

        // mark matched anchor (or null) for diagnostics — don't drop the product
        const matchedAnchor = anchorList.length === 0 ? null : anchorList.find(t => idLower.includes(t)) || null;
        p.__matchedField = matchedAnchor;

        let maxScore = 0;
        expandedQueries.forEach(q => {
            const score = fuzzyMatch(q, identifier, 0.6);
            if (score > maxScore) maxScore = score;
        });
        const boost = brandBoost(query, identifier);
        maxScore = Math.min(1.0, maxScore + boost + 0.15);
        return { product: p, score: maxScore, source: 'local' };
    });

    // enrich local with OFF data
    await scoring.enrichLocalProductsWithOFF(scoredLocal, { useLiveOFF });

    let candidates = [...scoredLocal];
    const bestLocal = scoredLocal.length ? Math.max(...scoredLocal.map(s => s.score)) : 0;

    const needOff = useLiveOFF && (
        scoredLocal.length < 5 || bestLocal < 0.85 || scoredLocal.some(s => !s.product.ecoscore && !s.product.nutriscore)
    );

    if (needOff) {
        try {
            console.log('matcher.findSuggestions: fetching OFF for', query);
            // If query is a single token, try a broader OFF fetch and permutations
            const isSingleToken = (coreTokens.length === 1);
            // Request more results for single-token queries to maximize recall
            const pageSize = isSingleToken ? 100 : 50;
            const maxResults = isSingleToken ? 400 : 120; // backend will page up to this (server-capped)
            // Request server-side fair-sorted results to get good initial ordering from OFF
            let offProducts = await off.fetchOffProducts(query, pageSize, maxResults, '');
            // alternatives (permutations/morphology) are disabled — rely on the initial OFF fetch only
            console.log(`matcher.findSuggestions: OFF initial returned ${offProducts.length} products`);
            // Heuristic filter: keep only OFF products that contain one of the anchor terms in
            // product name, brands, categories or stores fields to reduce noise from broad text matches.
            const anchorLower = anchorList.map(a => a.toLowerCase());
            const rawBefore = offProducts.length;
            // Previously we filtered out OFF products that didn't contain strict anchor terms.
            // To increase recall, keep all OFF results but mark which ones matched the anchor fields.
            for (const p of offProducts) {
                const r = strictAnchorMatch(p, anchorLower);
                if (r.matched) {
                    p.__matchedField = r.field;
                } else {
                    p.__matchedField = null;
                }
            }
            // counted later after alternatives decision
            // We will NOT perform any alternative queries (permutations, morphological expansions,
            // synonym expansions or a fallback big fetch). Use only the initial OFF response and
            // local scoring to rank candidates. This keeps OFF query volume predictable.
            const desiredKept = Math.max(8, needed || 8);
            let anchoredCount = offProducts.filter(p => p.__matchedField).length;
            console.log(`matcher.findSuggestions: alternatives disabled; anchored=${anchoredCount}, total=${offProducts.length}, desired=${desiredKept}`);
            const scoredOff = offProducts.map(p => {
                const identifier = p.product_identifier || p.product_name || '';
                const idLower = identifier.toLowerCase();
                if (shouldExcludeProduct(coreTokens, identifier)) return { product: p, score: 0, source: 'off' };
                let maxScore = 0;
                // base scoring from expandedQueries
                expandedQueries.forEach(q => {
                    const score = fuzzyMatch(q, identifier, 0.5);
                    if (score > maxScore) maxScore = score;
                });
                // for single-token queries, also try morphological expansions (curated)
                if (isSingleToken) {
                    try {
                        const morphs = morphologicalExpansions(coreTokens[0]);
                        for (const m of morphs) {
                            const s = fuzzyMatch(m, identifier, 0.45);
                            if (s > maxScore) maxScore = s;
                        }
                    } catch (e) { /* ignore */ }
                }
                // brand boost
                const boost = brandBoost(query, identifier);
                maxScore = Math.min(1.0, maxScore + boost);
                // boosted regex for strong compound matches
                if (isSingleToken) {
                    try {
                        const regexBoost = boostedRegexBoost(coreTokens[0], p);
                        maxScore = Math.min(1.0, maxScore + regexBoost);
                    } catch (e) { /* ignore */ }
                }
                return { product: p, score: maxScore, source: 'off' };
            }).filter(m => m.score > (isSingleToken ? 0.50 : 0.60));
            // For single-token queries, be more permissive to gather candidates to rank later
            const scoredOffFiltered = isSingleToken ? scoredOff.filter(m => m.score > 0.40) : scoredOff.filter(m => m.score > 0.60);
            console.log(`matcher.findSuggestions: scoredOff kept ${scoredOffFiltered.length} OFF candidates after permissive filter`);
            candidates = candidates.concat(scoredOffFiltered);
            console.log(`matcher.findSuggestions: scoredOff kept ${scoredOff.length} OFF candidates`);
            candidates = candidates.concat(scoredOff);
        } catch (e) {
            console.error('OFF fetch failed in matcher.findSuggestions:', e);
        }
    }

    candidates.sort((a, b) => b.score - a.score);
    const qualityCandidates = candidates.filter(c => c.score >= (isSingleToken ? 0.50 : 0.60));
    const deduped = scoring.deduplicateCandidates(qualityCandidates);

    deduped.forEach(c => {
        c.fairScore = scoring.computeFairScore(c.product, c.source);
        c.combinedScore = (c.score * 0.6) + (c.fairScore * 0.4);
        const hasEco = c.product.ecoscore || c.product.ecoscore_grade;
        const hasNutri = c.product.nutriscore || c.product.nutriscore_grade;
        if (hasEco && hasNutri) c.combinedScore += 0.05;
    });

    const sorted = [...deduped].sort((a, b) => b.combinedScore - a.combinedScore);
    // debug: log top candidates
    try {
        console.log('matcher.findSuggestions: total candidates after scoring/dedupe:', sorted.length);
        console.log('matcher.findSuggestions: top 8 candidates:', sorted.slice(0, 8).map(c => ({ id: (c.product && (c.product.product_identifier || c.product.product_name || c.product.code)) || '', source: c.source, score: c.score.toFixed ? c.score.toFixed(2) : c.score, fairScore: c.fairScore ? c.fairScore.toFixed(2) : null, combined: c.combinedScore ? c.combinedScore.toFixed(2) : null })));
    } catch (e) {
        // ignore logging errors
    }
    return sorted;
}
