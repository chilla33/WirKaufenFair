// scoring.js
// Fairness & scoring helpers extracted from shopping_list_v2
import * as off from './openfoodfacts_api.js';

const GRADE_SCORE = { 'A': 1.0, 'B': 0.8, 'C': 0.6, 'D': 0.4, 'E': 0.2 };

export function computeFairScore(product, source) {
    return computeFairComponents(product, source).total;
}

export function computeFairComponents(product, source) {
    const eco = (product.ecoscore || product.ecoscore_grade || '').toString().toUpperCase();
    const nutri = (product.nutriscore || product.nutriscore_grade || '').toString().toUpperCase();
    const ecoScore = GRADE_SCORE[eco] || 0;
    const nutriScore = GRADE_SCORE[nutri] || 0;
    const ethicsScore = typeof product.ethics_score === 'number' ? product.ethics_score : (product.ethics_score || 0.6);
    const verifiedBoost = product.status === 'verified' ? 0.05 : 0;
    const localBoost = source === 'local' ? 0.03 : 0;

    const total = (ecoScore * 0.5) + (ethicsScore * 0.3) + (nutriScore * 0.1) + verifiedBoost + localBoost;
    // presence boost: prefer products that actually have an ecoscore value
    const presenceBoost = (product.ecoscore || product.ecoscore_grade) ? 0.08 : 0;
    const totalWithPresence = total + presenceBoost;
    return {
        ecoScore,
        nutriScore,
        ethicsScore,
        verifiedBoost,
        localBoost,
        total: totalWithPresence
    };
}

export function normalizeProductName(name) {
    if (!name) return '';
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '');
}

export function calculateUnitPrice(product) {
    const price = product.current_price || product.estimated_price;
    if (!price) return null;

    const amount = product.size_amount;
    const unit = (product.size_unit || '').toLowerCase();

    if (!amount || !unit) return null;

    if (unit === 'g' || unit === 'kg') {
        const kg = unit === 'g' ? amount / 1000 : amount;
        return { value: price / kg, unit: 'kg', display: `${(price / kg).toFixed(2)} €/kg` };
    } else if (unit === 'ml' || unit === 'l') {
        const l = unit === 'ml' ? amount / 1000 : amount;
        return { value: price / l, unit: 'l', display: `${(price / l).toFixed(2)} €/L` };
    }

    return null;
}

export function deduplicateCandidates(candidates) {
    const groups = new Map();

    for (const cand of candidates) {
        const p = cand.product || cand;
        const barcode = p.barcode || '';
        const normalizedName = normalizeProductName(p.product_identifier || p.product_name || p.name || '');
        const key = barcode || normalizedName;

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(cand);
    }

    const deduped = [];
    for (const items of groups.values()) {
        // choose best by score if available
        items.sort((a, b) => (b.score || 0) - (a.score || 0));
        const best = items[0];

        if (items.length > 1) {
            const local = items.find(i => i.source === 'local');
            const offItem = items.find(i => i.source === 'off' || (i.product && (i.product.ecoscore || i.product.nutriscore)));

            if (local && offItem) {
                // merge missing OFF fields into local
                const lp = local.product || local;
                const op = offItem.product || offItem;
                if (!lp.ecoscore && op.ecoscore) {
                    lp.ecoscore = op.ecoscore;
                    lp.ecoscore_grade = op.ecoscore_grade;
                }
                if (!lp.nutriscore && op.nutriscore) {
                    lp.nutriscore = op.nutriscore;
                    lp.nutriscore_grade = op.nutriscore_grade;
                }
                if (!lp.image_url && op.image_url) lp.image_url = op.image_url;
                if (!lp.ethics_score && op.ethics_score) {
                    lp.ethics_score = op.ethics_score;
                    lp.ethics_issues = op.ethics_issues;
                }
            }
        }

        deduped.push(best);
    }

    return deduped;
}

export async function enrichLocalProductsWithOFF(scoredLocal, options = { useLiveOFF: true }) {
    if (!options.useLiveOFF) return;
    const promises = scoredLocal.map(async (scored) => {
        const p = scored.product || scored;
        if (p.ecoscore && p.nutriscore) return;
        if (!p.barcode) return;
        try {
            const offProduct = await off.fetchOffProductByBarcode(p.barcode);
            if (offProduct) {
                if (!p.ecoscore && offProduct.ecoscore) {
                    p.ecoscore = offProduct.ecoscore;
                    p.ecoscore_grade = offProduct.ecoscore_grade;
                }
                if (!p.nutriscore && offProduct.nutriscore) {
                    p.nutriscore = offProduct.nutriscore;
                    p.nutriscore_grade = offProduct.nutriscore_grade;
                }
                if (!p.image_url && (offProduct.image_url || offProduct.image_small_url)) {
                    p.image_url = offProduct.image_url || offProduct.image_small_url;
                }
                if (!p.ethics_score && offProduct.ethics_score) {
                    p.ethics_score = offProduct.ethics_score;
                    p.ethics_issues = offProduct.ethics_issues;
                }
            }
        } catch (e) {
            console.warn(`Failed to enrich product ${p.barcode}:`, e);
        }
    });
    await Promise.all(promises);
}
