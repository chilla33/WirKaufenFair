def compute_simple_score(product):
    """Example scoring: average of available numeric fields. Expects dict."""
    keys = ['recyclability', 'repairability', 'social', 'packaging', 'co2_inverse']
    vals = []
    for k in keys:
        v = product.get(k)
        if v is None:
            continue
        vals.append(float(v))
    if not vals:
        return 50.0
    return sum(vals) / len(vals)
