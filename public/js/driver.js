// driver.js — Driver dashboard with QR scanner

const API_BASE = '';
let driverId = null;
let socket = null;
let html5QrCode = null;
let scannerRunning = false;
let lastScannedTime = 0;
const SCAN_COOLDOWN = 5000;

function getDriverId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || localStorage.getItem('driverId');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function logout() {
    localStorage.clear();
    window.location.href = '/';
}

function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ==========================================
// QR SCANNER — Built into driver page
// ==========================================

function toggleScanner() {
    const wrapper = document.getElementById('scanner-wrapper');
    const btn = document.getElementById('scan-qr-btn');

    if (scannerRunning) {
        stopScanner();
        btn.innerHTML = '📷 Scan Gate QR Code';
    } else {
        wrapper.style.display = 'block';
        btn.innerHTML = '⏹️ Close Scanner';
        startScanner();
    }
}

function startScanner() {
    html5QrCode = new Html5Qrcode('qr-reader');
    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

    html5QrCode.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        () => {}
    ).then(() => {
        scannerRunning = true;
    }).catch(err => {
        // Try front camera
        html5QrCode.start(
            { facingMode: 'user' },
            config,
            onScanSuccess,
            () => {}
        ).then(() => {
            scannerRunning = true;
        }).catch(err2 => {
            showToast('Cannot access camera. Please allow camera permission.', 'error');
            document.getElementById('scanner-wrapper').style.display = 'none';
            document.getElementById('scan-qr-btn').innerHTML = '📷 Scan Gate QR Code';
        });
    });
}

function stopScanner() {
    if (html5QrCode && scannerRunning) {
        html5QrCode.stop().then(() => {
            scannerRunning = false;
            document.getElementById('scanner-wrapper').style.display = 'none';
        }).catch(() => {
            scannerRunning = false;
            document.getElementById('scanner-wrapper').style.display = 'none';
        });
    }
}

async function onScanSuccess(decodedText) {
    // Prevent rapid scans
    const now = Date.now();
    if (now - lastScannedTime < SCAN_COOLDOWN) return;
    lastScannedTime = now;

    // Vibrate feedback
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // Stop scanner
    stopScanner();
    document.getElementById('scan-qr-btn').innerHTML = '📷 Scan Gate QR Code';

    // Record the scan directly (driver is already logged in)
    try {
        const res = await fetch(`${API_BASE}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverId })
        });
        const data = await res.json();

        if (res.ok) {
            showScanResult(data);
            loadTrips();
            showToast(data.message, 'success');
        } else {
            showToast(data.error || 'Scan failed', 'error');
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
    }
}

function showScanResult(data) {
    const box = document.getElementById('scan-result-box');
    const isExit = data.scanType === 'EXIT';
    const cls = isExit ? 'scan-result-exit' : 'scan-result-entry';
    const icon = isExit ? '🚛➡️' : '✅⬅️';
    const status = isExit ? 'DEPARTED — Loaded Vehicle' : `RETURNED — Trip #${data.tripCount} Completed!`;
    const color = isExit ? '#f59e0b' : '#22c55e';

    box.innerHTML = `
        <div class="scan-result-card ${cls}">
            <div style="font-size:40px;">${icon}</div>
            <h3 style="color:${color}; margin:8px 0 4px;">${status}</h3>
            <p style="margin:0; opacity:0.8;">Scan time: <strong>${formatTime(data.scanTime)}</strong></p>
            <p style="margin:4px 0 0; font-size:24px; font-weight:800; color:var(--accent);">Trips today: ${data.tripCount}</p>
        </div>
    `;

    // Auto-hide after 6 seconds
    setTimeout(() => { box.innerHTML = ''; }, 6000);
}

// ==========================================
// LOAD DATA
// ==========================================

async function loadDriverInfo() {
    try {
        const res = await fetch(`${API_BASE}/api/drivers/${driverId}`);
        if (!res.ok) {
            showToast('Driver not found. Please register.', 'error');
            setTimeout(() => { window.location.href = '/'; }, 2000);
            return;
        }
        const data = await res.json();
        document.getElementById('driver-name-header').textContent = data.driver.name;
        document.getElementById('vehicle-info').innerHTML = `🚛 ${data.driver.vehicleNo}`;
    } catch (err) {
        showToast('Failed to load driver info', 'error');
    }
}

async function loadTrips() {
    try {
        // Use real current IST date
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const ist = new Date(utc + (3600000 * 5.5));
        const today = `${ist.getFullYear()}-${String(ist.getMonth()+1).padStart(2,'0')}-${String(ist.getDate()).padStart(2,'0')}`;

        const res = await fetch(`${API_BASE}/api/trips/${driverId}?date=${today}`);
        const data = await res.json();

        // Animate trip count
        const el = document.getElementById('trip-count');
        const oldCount = parseInt(el.textContent) || 0;
        if (data.tripCount !== oldCount) {
            el.style.transform = 'scale(1.3)';
            setTimeout(() => { el.textContent = data.tripCount; el.style.transform = 'scale(1)'; }, 150);
        } else {
            el.textContent = data.tripCount;
        }

        // Scan log with real timestamps
        const scanLog = document.getElementById('scan-log');
        if (data.scans && data.scans.length > 0) {
            let html = '<div class="scan-log-list">';
            let tripNum = 0;
            data.scans.forEach((scan, i) => {
                if (scan.type === 'ENTRY') tripNum++;
                const badgeClass = scan.type === 'EXIT' ? 'badge-exit' : 'badge-entry';
                const icon = scan.type === 'EXIT' ? '🚛➡️' : '✅⬅️';
                const desc = scan.type === 'EXIT' ? 'Left with load' : `Returned empty — Trip #${tripNum}`;
                html += `
                    <div class="history-item">
                        <div>
                            <span class="badge ${badgeClass}">${scan.type}</span>
                            <span style="margin-left:8px; opacity:0.8;">${icon} ${desc}</span>
                        </div>
                        <span class="history-date">${formatTime(scan.timestamp)}</span>
                    </div>
                `;
            });
            html += '</div>';
            scanLog.innerHTML = html;
        } else {
            scanLog.innerHTML = '<p class="card-desc">No scans yet today. Tap the scan button above!</p>';
        }

        // Current status
        const statusEl = document.getElementById('current-status');
        if (data.scans && data.scans.length > 0) {
            const last = data.scans[data.scans.length - 1];
            if (last.type === 'EXIT') {
                statusEl.innerHTML = '<span class="badge badge-exit" style="font-size:14px;">🚛 Currently OUT — On dump trip</span>';
            } else {
                statusEl.innerHTML = '<span class="badge badge-entry" style="font-size:14px;">✅ At Site — Ready for next trip</span>';
            }
        } else {
            statusEl.innerHTML = '<span class="badge" style="font-size:14px;">⏳ Waiting for first scan</span>';
        }
    } catch (err) {
        console.error('Load trips error:', err);
    }
}

async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/trips/${driverId}/history`);
        const data = await res.json();
        const el = document.getElementById('history-list');

        if (data.history && data.history.length > 0) {
            let html = '';
            data.history.forEach((day) => {
                html += `
                    <div class="history-item">
                        <span class="history-date">${formatDate(day.date)}</span>
                        <span class="history-count">${day.trips} trip${day.trips !== 1 ? 's' : ''}</span>
                    </div>
                `;
            });
            el.innerHTML = html;
        } else {
            el.innerHTML = '<p class="card-desc">No history yet</p>';
        }
    } catch (err) {
        console.error('Load history error:', err);
    }
}

// ==========================================
// SOCKET.IO — Real-time updates
// ==========================================

function setupSocket() {
    socket = io();
    socket.on('scan-update', (data) => {
        if (data.driverId === driverId) {
            loadTrips();
            const msg = data.scanType === 'EXIT' ? '🚛 Departed!' : '✅ Trip #' + data.tripCount + ' Complete!';
            showToast(msg, 'success');
        }
    });
}

// ==========================================
// INIT
// ==========================================

window.addEventListener('load', () => {
    driverId = getDriverId();
    if (!driverId) {
        window.location.href = '/';
        return;
    }

    loadDriverInfo();
    loadTrips();
    loadHistory();
    setupSocket();

    setInterval(loadTrips, 30000);
});
