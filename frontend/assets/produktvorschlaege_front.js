document.addEventListener('DOMContentLoaded', () => {
    const listEl = document.getElementById('list');
    const filter = document.getElementById('filter');
    const btn = document.getElementById('btn-filter');

    async function load(q) {
        listEl.innerHTML = 'Lade...';
        const url = q ? `/api/v1/product_locations?product_identifier=${encodeURIComponent(q)}` : '/api/v1/product_locations';
        const res = await fetch(url);
        if (!res.ok) { listEl.innerText = 'Fehler beim Laden'; return }
        const data = await res.json();
        if (!data.length) { listEl.innerHTML = '<i>Keine Vorschläge gefunden</i>'; return }
        listEl.innerHTML = data.map(it => {
            return `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="flex:1">
            <strong>${it.product_identifier}</strong> — ${it.store_name}<br>
            <small class="muted">${it.aisle || ''} ${it.shelf_label || ''}</small>
          </div>
          <div style="text-align:right">
            <div>${it.upvotes}👍 / ${it.downvotes}👎</div>
            <div>${it.status === 'verified' ? '<span class="badge verified">Verified</span>' : '<span class="badge suggested">Suggested</span>'}</div>
          </div>
        </div>
      </div>`
        }).join('\n');
    }

    btn.addEventListener('click', () => load(filter.value.trim()));
    load();
});
