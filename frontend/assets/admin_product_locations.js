// Admin product locations script
function getApiKey() {
    let k = localStorage.getItem('wf_admin_api_key');
    if (!k) {
        k = prompt('Admin API Key (wird im Browser gespeichert)');
        if (k) localStorage.setItem('wf_admin_api_key', k);
    }
    return k;
}

async function fetchPL() {
    const res = await fetch('/api/v1/product_locations');
    const data = await res.json();
    const tbody = document.querySelector('#pl-table tbody');
    tbody.innerHTML = '';
    data.forEach(it => {
        const tr = document.createElement('tr');
        const verifiedBadge = it.status === 'verified' ? `<span class="badge verified">Verified</span>` : `<span class="badge suggested">Suggested</span>`;
    const verifierInfo = it.verified_by ? `<div style="font-size:12px;color:var(--text-muted)">by ${it.verified_by} @ ${it.verified_at || it.created_at}</div>` : '';
        tr.innerHTML = `
            <td>${it.id}</td>
            <td>${it.product_identifier}</td>
            <td>${it.store_name}</td>
            <td>${it.aisle || ''}</td>
            <td>${it.shelf_label || ''}</td>
            <td>${it.photo_url ? `<a href="${it.photo_url}" target="_blank">Foto</a>` : ''}</td>
            <td>${it.contributor || ''}</td>
            <td>${it.upvotes} / ${it.downvotes}</td>
            <td>${verifiedBadge}${verifierInfo}</td>
            <td>
                <button data-id="${it.id}" class="up">Up</button>
                <button data-id="${it.id}" class="down">Down</button>
                <button data-id="${it.id}" class="verify" ${it.status === 'verified' ? 'disabled' : ''}>Verify</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('button.up').forEach(b => b.addEventListener('click', async (e) => {
        const apiKey = getApiKey();
        const id = e.target.dataset.id;
        await fetch(`/api/v1/product_locations/${id}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey }, body: JSON.stringify({ vote: 'up' }) });
        await fetchPL();
    }));

    document.querySelectorAll('button.down').forEach(b => b.addEventListener('click', async (e) => {
        const apiKey = getApiKey();
        const id = e.target.dataset.id;
        await fetch(`/api/v1/product_locations/${id}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey }, body: JSON.stringify({ vote: 'down' }) });
        await fetchPL();
    }));

    document.querySelectorAll('button.verify').forEach(b => b.addEventListener('click', async (e) => {
        const apiKey = getApiKey();
        const id = e.target.dataset.id;
        const verifier = prompt('Verifier name:');
        if (!verifier) return;
        await fetch(`/api/v1/product_locations/${id}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey }, body: JSON.stringify({ verifier }) });
        await fetchPL();
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    fetchPL();
    setInterval(fetchPL, 20000);
    const bcLookup = document.getElementById('bc-lookup');
    const bcCreate = document.getElementById('bc-create');
    if (bcLookup) {
        bcLookup.addEventListener('click', async () => {
            const barcode = document.getElementById('bc-barcode').value.trim();
            const resultEl = document.getElementById('bc-result');
            if (!barcode) { resultEl.textContent = 'Bitte Barcode eingeben.'; return; }
            resultEl.textContent = 'Suche…';
            try {
                const res = await fetch(`/api/v1/products/lookup/${encodeURIComponent(barcode)}`);
                if (!res.ok) { resultEl.textContent = 'Nicht gefunden.'; return; }
                const p = await res.json();
                resultEl.innerHTML = `Name: <b>${p.product_name || '—'}</b> • Marke(n): ${p.brands || '—'} • Kategorien: ${p.categories || '—'}`;
            } catch (e) {
                resultEl.textContent = 'Fehler bei der Suche.';
            }
        });
    }
    if (bcCreate) {
        bcCreate.addEventListener('click', async () => {
            const barcode = document.getElementById('bc-barcode').value.trim();
            const store = document.getElementById('bc-store').value.trim() || 'Unbekannt';
            const aisle = document.getElementById('bc-aisle').value.trim() || '';
            const shelf = document.getElementById('bc-shelf').value.trim() || '';
            const contrib = document.getElementById('bc-contrib').value.trim() || 'Admin';
            const resultEl = document.getElementById('bc-result');
            if (!barcode) { resultEl.textContent = 'Bitte Barcode eingeben.'; return; }
            try {
                const payload = { product_identifier: barcode, store_name: store, aisle, shelf_label: shelf, contributor: contrib };
                const res = await fetch('/api/v1/product_locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) { resultEl.textContent = 'Anlegen fehlgeschlagen.'; return; }
                resultEl.textContent = 'Vorschlag angelegt.';
                await fetchPL();
            } catch (e) {
                resultEl.textContent = 'Fehler beim Anlegen.';
            }
        });
    }
});
