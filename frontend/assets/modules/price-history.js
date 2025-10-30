// price-history.js
// Preisverlauf-Chart für Produkte

export function showPriceHistory(productName, priceHistory, currentPrice) {
    const modal = document.getElementById('price-modal');
    const modalTitle = document.getElementById('modal-title');
    const canvas = document.getElementById('price-chart');
    if (!modal || !modalTitle || !canvas) return;
    modalTitle.textContent = `Preisverlauf: ${productName}`;
    modal.classList.add('active');
    const history = priceHistory || [];
    const allData = [...history, { date: new Date().toISOString().split('T')[0], price: currentPrice }];
    const labels = allData.map(h => h.date);
    const prices = allData.map(h => h.price);
    const ctx = canvas.getContext('2d');
    if (window.priceChart) {
        window.priceChart.destroy();
    }
    const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#0ea5e9').trim();
    window.priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Preis (EUR)',
                data: prices,
                borderColor: accent,
                backgroundColor: 'rgba(14,165,233,0.08)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.parsed.y.toFixed(2) + ' EUR';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function (value) {
                            return value.toFixed(2) + ' EUR';
                        }
                    }
                }
            }
        }
    });
}

export function closePriceModal() {
    const modal = document.getElementById('price-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}
