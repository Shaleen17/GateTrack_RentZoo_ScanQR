// gate-scan.js — Handles the gate QR scan action
// This page opens when a driver scans the QR code pasted at the main gate.
// If driver is logged in → auto-records the scan
// If not logged in → asks for phone number first

const API_BASE = '';

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

// Record the scan on the server
async function recordScan(driverId) {
    // Show processing
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('processing-section').style.display = 'block';
    document.getElementById('result-section').style.display = 'none';
    document.getElementById('actions-section').style.display = 'none';

    const driverName = localStorage.getItem('driverName') || '';
    document.getElementById('processing-driver-name').textContent = driverName ? `Driver: ${driverName}` : '';

    try {
        const res = await fetch(`${API_BASE}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverId })
        });

        const data = await res.json();

        if (res.ok) {
            // Vibrate for feedback
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            showScanResult(data);
        } else {
            showError(data.error || 'Scan failed');
        }
    } catch (err) {
        console.error('Scan error:', err);
        showError('Network error. Please check your connection and try again.');
    }
}

// Display scan result
function showScanResult(data) {
    document.getElementById('processing-section').style.display = 'none';
    document.getElementById('result-section').style.display = 'block';
    document.getElementById('actions-section').style.display = 'block';

    const isExit = data.scanType === 'EXIT';
    const icon = isExit ? '🚛➡️' : '✅⬅️';
    const statusText = isExit ? 'DEPARTED — Loaded Vehicle' : 'RETURNED — Empty Vehicle';
    const statusColor = isExit ? '#f59e0b' : '#22c55e';
    const tripText = isExit ? 'Trip started. Scan again when you return.' : `Trip #${data.tripCount} completed!`;
    const bgGlow = isExit ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)';

    document.getElementById('result-content').innerHTML = `
        <div style="text-align:center; animation: fadeIn 0.4s ease;">
            <div style="font-size:56px; margin-bottom:12px;">${icon}</div>
            <h2 style="color:${statusColor}; margin-bottom:8px;">${statusText}</h2>
            <h3 style="margin-bottom:4px;">${data.driver.name}</h3>
            <span class="badge badge-trip" style="font-size:14px;">🚛 ${data.driver.vehicleNo}</span>

            <div style="margin-top:20px; padding:16px; background:${bgGlow}; border-radius:12px;">
                <div class="trip-counter" style="font-size:48px; margin-bottom:4px;">${data.tripCount}</div>
                <p class="trip-label" style="margin:0;">${tripText}</p>
            </div>

            <div style="margin-top:16px; opacity:0.7; font-size:14px;">
                ⏱️ Scan recorded at <strong>${formatTime(data.scanTime)}</strong>
            </div>
        </div>
    `;

    document.getElementById('result-section').style.borderColor = statusColor;
}

// Display error
function showError(message) {
    document.getElementById('processing-section').style.display = 'none';
    document.getElementById('result-section').style.display = 'block';
    document.getElementById('actions-section').style.display = 'block';

    document.getElementById('result-content').innerHTML = `
        <div style="text-align:center; animation: fadeIn 0.4s ease;">
            <div style="font-size:56px; margin-bottom:12px;">❌</div>
            <h2 style="color:#ef4444; margin-bottom:8px;">Scan Failed</h2>
            <p style="color:var(--color-text-muted);">${message}</p>
        </div>
    `;
    document.getElementById('result-section').style.borderColor = '#ef4444';
    showToast(message, 'error');
}

// Login form handler (for drivers who aren't logged in yet)
document.getElementById('gate-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('gate-phone').value.trim();

    if (!phone || phone.length !== 10) {
        showToast('Enter a valid 10-digit phone number', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/drivers/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (res.ok) {
            // Save login info
            localStorage.setItem('driverId', data.driver._id);
            localStorage.setItem('driverName', data.driver.name);
            localStorage.setItem('driverPhone', data.driver.phone);

            // Now record the scan
            recordScan(data.driver._id);
        } else {
            showToast(data.error || 'Driver not found. Please register first.', 'error');
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
    }
});

// On page load — check if driver is already logged in
window.addEventListener('load', () => {
    const driverId = localStorage.getItem('driverId');

    if (driverId) {
        // Driver is logged in — auto-record the scan immediately
        recordScan(driverId);
    } else {
        // Not logged in — show login form
        document.getElementById('login-section').style.display = 'block';
    }
});
