// Upvote-Dialog mit Korrektur-Option
// Aufruf: showPriceVerificationDialog(productName, currentPrice, reportId, storeNam, onSuccess)

window.showPriceVerificationDialog = function (productName, currentPrice, reportId, storeName, onSuccess) {
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 32px; border-radius: 16px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 22px;">
                ✓ Preis bestätigen
            </h2>
            
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <div style="font-weight: 600; color: #475569; margin-bottom: 4px;">${productName}</div>
                <div style="font-size: 12px; color: #94a3b8;">📍 ${storeName}</div>
                <div style="font-size: 32px; font-weight: 700; color: #0ea5e9; margin-top: 12px;">
                    ${currentPrice.toFixed(2)} €
                </div>
            </div>

            <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <strong style="color: #92400e;">📋 Bitte prüfen:</strong>
                <p style="color: #92400e; margin: 8px 0 0 0; font-size: 14px;">
                    Stimmt dieser Preis mit dem aktuellen Preis im Geschäft überein?
                </p>
            </div>

            <div id="correction-section" style="display: none; margin-bottom: 24px;">
                <label style="display: block; font-weight: 600; color: #475569; margin-bottom: 8px;">
                    Korrigierter Preis:
                </label>
                <input type="number" id="corrected-price" step="0.01" min="0" 
                       placeholder="z.B. 1.99"
                       style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px;">
            </div>

            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button id="confirm-btn" style="flex: 1; padding: 14px; background: #22c55e; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer;">
                    ✓ Stimmt, bestätigen
                </button>
                <button id="correct-btn" style="flex: 1; padding: 14px; background: #f59e0b; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer;">
                    ✏️ Preis korrigieren
                </button>
            </div>
            
            <button id="cancel-btn" style="width: 100%; padding: 12px; background: #f1f5f9; color: #64748b; border: none; border-radius: 8px; font-weight: 600; margin-top: 12px; cursor: pointer;">
                Abbrechen
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector('#confirm-btn');
    const correctBtn = modal.querySelector('#correct-btn');
    const cancelBtn = modal.querySelector('#cancel-btn');
    const correctionSection = modal.querySelector('#correction-section');
    const correctedPriceInput = modal.querySelector('#corrected-price');

    let correctionMode = false;

    // Bestätigen
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '⏳ Wird gesendet...';

        try {
            const res = await fetch(`/api/v1/price_reports/${reportId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vote: 'up' })
            });

            if (res.ok) {
                modal.remove();
                if (onSuccess) onSuccess('upvoted');
                showToast('✓ Preis bestätigt! Danke für deinen Beitrag.', 'success');
            } else {
                throw new Error('Server error');
            }
        } catch (e) {
            alert('Fehler beim Bestätigen: ' + e.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = '✓ Stimmt, bestätigen';
        }
    });

    // Korrigieren
    correctBtn.addEventListener('click', () => {
        if (!correctionMode) {
            // Zeige Eingabefeld
            correctionMode = true;
            correctionSection.style.display = 'block';
            correctedPriceInput.value = currentPrice.toFixed(2);
            correctedPriceInput.focus();
            correctedPriceInput.select();
            correctBtn.textContent = '💾 Korrektur speichern';
            confirmBtn.style.display = 'none';
        } else {
            // Speichere Korrektur
            const newPrice = parseFloat(correctedPriceInput.value);
            if (!newPrice || newPrice <= 0) {
                alert('Bitte gib einen gültigen Preis ein!');
                return;
            }

            correctBtn.disabled = true;
            correctBtn.textContent = '⏳ Wird gespeichert...';

            // Erst Downvote für alten Preis
            fetch(`/api/v1/price_reports/${reportId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vote: 'down' })
            }).then(() => {
                // Dann neue Preismeldung
                return fetch('/api/v1/price_reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_identifier: productName,
                        store_name: storeName,
                        reported_price: newPrice
                    })
                });
            }).then(res => {
                if (res.ok) {
                    modal.remove();
                    if (onSuccess) onSuccess('corrected', newPrice);
                    showToast(`✓ Preis korrigiert auf ${newPrice.toFixed(2)} €. Danke!`, 'success');
                } else {
                    throw new Error('Server error');
                }
            }).catch(e => {
                alert('Fehler beim Speichern: ' + e.message);
                correctBtn.disabled = false;
                correctBtn.textContent = '💾 Korrektur speichern';
            });
        }
    });

    // Abbrechen
    cancelBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
};

// Toast notification helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#0ea5e9';

    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: ${bgColor};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10001;
        font-weight: 600;
        animation: slideIn 0.3s;
    `;

    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// CSS Animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideIn {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(100px); opacity: 0; }
    }
`;
document.head.appendChild(style);
