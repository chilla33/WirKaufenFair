document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('suggest-form');
    const status = document.getElementById('status');
    const photoInput = document.getElementById('photo_file');
    const captureBtn = document.getElementById('photo_capture_btn');
    const previewWrap = document.getElementById('photo_preview_wrap');
    const previewImg = document.getElementById('photo_preview');

    if (captureBtn && photoInput) {
        captureBtn.addEventListener('click', () => {
            // trigger file input (mobile shows camera due to capture attribute)
            photoInput.click();
        });
    }

    if (photoInput && previewWrap && previewImg) {
        photoInput.addEventListener('change', () => {
            const f = photoInput.files && photoInput.files[0];
            if (!f) { previewWrap.style.display = 'none'; return; }
            const url = URL.createObjectURL(f);
            previewImg.src = url;
            previewWrap.style.display = 'block';
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = photoInput;
        let photo_url = form.photo_url.value.trim();

        // If a file is selected, upload it first to get a URL
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const fd = new FormData();
            // Optional: compress on client (basic) – keep original for MVP
            fd.append('file', fileInput.files[0]);
            try {
                const up = await fetch('/api/v1/uploads', { method: 'POST', body: fd });
                if (!up.ok) {
                    const tj = await up.text();
                    status.innerText = 'Fehler beim Upload: ' + tj;
                    return;
                }
                const uj = await up.json();
                photo_url = uj.url || photo_url;
            } catch (uploadErr) {
                status.innerText = 'Fehler beim Upload: ' + uploadErr;
                return;
            }
        }

        const data = {
            product_identifier: form.product_identifier.value.trim(),
            store_name: form.store_name.value.trim(),
            aisle: form.aisle.value.trim(),
            shelf_label: form.shelf_label.value.trim(),
            photo_url,
            contributor: form.contributor.value.trim()
        };

        try {
            const resp = await fetch('/api/v1/product_locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const j = await resp.json();
            if (resp.ok) {
                status.innerText = `Vorschlag erhalten (id=${j.id}). Vielen Dank!`;
                form.reset();
                return;
            } else {
                status.innerText = 'Fehler: ' + JSON.stringify(j);
            }
        } catch (err) {
            status.innerText = 'Fehler beim Verbinden mit Server: ' + err;
        }
    });
});
