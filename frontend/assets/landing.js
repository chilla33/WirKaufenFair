document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('signup-form');
    const status = document.getElementById('status');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            role: form.role.value,
            notes: form.notes.value.trim(),
            created_at: new Date().toISOString()
        };

        // Try POST to backend if available
        try {
            const resp = await fetch('/api/v1/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (resp.ok) {
                status.innerText = 'Danke — du bist angemeldet. Wir melden uns per E‑Mail.';
                form.reset();
                return;
            }
        } catch (err) {
            // fallback to local storage
        }

        // fallback: save in local storage (so developer can extract later)
        const list = JSON.parse(localStorage.getItem('wf_signups') || '[]') || [];
        list.push(data);
        localStorage.setItem('wf_signups', JSON.stringify(list));
        status.innerText = 'Danke — (lokal gespeichert). Verbinde das Backend, um Signups zu sammeln.';
        form.reset();
    });
});
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('signup-form');
    const status = document.getElementById('status');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            role: form.role.value,
            notes: form.notes.value.trim(),
            created_at: new Date().toISOString()
        };

        // Try POST to backend if available
        try {
            const resp = await fetch('/api/v1/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (resp.ok) {
                status.innerText = 'Danke — du bist angemeldet. Wir melden uns per E‑Mail.';
                form.reset();
                return;
            }
        } catch (err) {
            // fallback to local storage
        }

        // fallback: save in local storage (so developer can extract later)
        const list = JSON.parse(localStorage.getItem('wf_signups' || '[]')) || [];
        list.push(data);
        localStorage.setItem('wf_signups', JSON.stringify(list));
        status.innerText = 'Danke — (lokal gespeichert). Verbinde das Backend, um Signups zu sammeln.';
        form.reset();
    });
});
