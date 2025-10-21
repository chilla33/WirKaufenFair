// product_list_module.js
// Simple module to render paginated product suggestion list
export async function initProductList(opts) {
    const container = document.getElementById(opts.containerId || 'list');
    const filterInput = document.getElementById(opts.filterId || 'filter');
    const pageSize = opts.pageSize || 10;
    let page = 0;

    async function loadPage() {
        container.innerHTML = 'Lade...';
        const q = filterInput && filterInput.value ? `?product_identifier=${encodeURIComponent(filterInput.value)}` : '';
        const res = await fetch(`/api/v1/product_locations${q}`);
        if (!res.ok) { container.innerText = 'Fehler beim Laden'; return }
        const data = await res.json();
        const start = page * pageSize;
        const pageItems = data.slice(start, start + pageSize);
        container.innerHTML = pageItems.map(it => renderItem(it)).join('\n') + renderPager(data.length);
        wireButtons();
    }

    function renderItem(it) {
        return `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="flex:1">
          <strong>${escapeHtml(it.product_identifier)}</strong> — ${escapeHtml(it.store_name)}<br>
          <small class="muted">${escapeHtml(it.aisle || '')} ${escapeHtml(it.shelf_label || '')}</small>
        </div>
        <div style="text-align:right">
          <div>${it.upvotes}👍 / ${it.downvotes}👎</div>
          <div>${it.status === 'verified' ? '<span class="badge verified">Verified</span>' : '<span class="badge suggested">Suggested</span>'}</div>
        </div>
      </div>
    </div>`;
    }

    function renderPager(total) {
        const pages = Math.max(1, Math.ceil(total / pageSize));
        if (pages <= 1) return '';
        let html = '<div style="margin-top:8px;display:flex;gap:6px;align-items:center">';
        html += `<button id="prev" ${page === 0 ? 'disabled' : ''}>← Prev</button>`;
        html += `<div style="padding:0 8px">Seite ${page + 1} / ${pages}</div>`;
        html += `<button id="next" ${page + 1 >= pages ? 'disabled' : ''}>Next →</button>`;
        html += '</div>';
        return html;
    }

    function wireButtons() {
        const prev = document.getElementById('prev');
        const next = document.getElementById('next');
        if (prev) prev.addEventListener('click', () => { page = Math.max(0, page - 1); loadPage(); });
        if (next) next.addEventListener('click', () => { page = page + 1; loadPage(); });
    }

    function escapeHtml(s) { return (s || '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[c]) }

    if (filterInput) filterInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') { page = 0; loadPage(); } });
    await loadPage();
}
