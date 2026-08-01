// admin.js — Admin Dashboard with detailed trip pairs (EXIT time + ENTRY time)

const API_BASE = '';
let socket = null;

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function adminLogout() {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.reload();
}

function formatTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDateShort(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getISTToday() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    return `${ist.getFullYear()}-${String(ist.getMonth()+1).padStart(2,'0')}-${String(ist.getDate()).padStart(2,'0')}`;
}

// Admin Login
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;
    try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
            sessionStorage.setItem('adminLoggedIn', 'true');
            document.getElementById('admin-overlay').style.display = 'none';
            document.getElementById('admin-page').style.display = 'block';
            showToast('Welcome, Admin!', 'success');
            initDashboard();
        } else {
            showToast('Invalid password', 'error');
            document.getElementById('admin-password').value = '';
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
});

// ==========================================
// GATE QR
// ==========================================

async function loadGateQR() {
    try {
        const res = await fetch(`${API_BASE}/api/gate/qr`);
        const data = await res.json();
        document.getElementById('gate-qr-container').innerHTML =
            `<img src="${data.qrDataUrl}" alt="Gate QR" id="gate-qr-img" style="width:220px; height:220px;">`;
        document.getElementById('gate-qr-url').textContent = data.gateUrl;
    } catch (err) {
        document.getElementById('gate-qr-container').innerHTML = '<p style="color:#ef4444;">Failed to load QR</p>';
    }
}

function printGateQR() {
    const img = document.getElementById('gate-qr-img');
    if (!img) { showToast('QR not loaded', 'error'); return; }

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>RentZoo Gate QR</title>
        <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;margin:0;}
        h1{font-size:36px;margin-bottom:8px;} p{font-size:20px;color:#666;margin-bottom:20px;}
        img{width:350px;height:350px;border:4px solid #000;padding:12px;} .foot{margin-top:20px;font-size:14px;color:#999;}</style>
        </head><body><h1>RentZoo — Main Gate</h1><p>Scan this QR code to record your trip</p>
        <img src="${img.src}" alt="Gate QR"><p class="foot">Vehicle Trip Counter System</p></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
}

// ==========================================
// PAIR SCANS INTO TRIPS
// ==========================================

function pairScansIntoTrips(scans) {
    // scans are sorted oldest→newest
    // Pair them: EXIT[0]+ENTRY[1] = Trip 1, EXIT[2]+ENTRY[3] = Trip 2, etc.
    const trips = [];
    let i = 0;
    while (i < scans.length) {
        if (scans[i].type === 'EXIT') {
            const exitScan = scans[i];
            let entryScan = null;
            if (i + 1 < scans.length && scans[i + 1].type === 'ENTRY') {
                entryScan = scans[i + 1];
                i += 2;
            } else {
                i += 1;
            }
            trips.push({ exitScan, entryScan });
        } else {
            // Orphan ENTRY without EXIT (shouldn't normally happen)
            trips.push({ exitScan: null, entryScan: scans[i] });
            i += 1;
        }
    }
    return trips;
}

// ==========================================
// LOAD TRIP DATA
// ==========================================

async function loadTrips(date) {
    try {
        const dateParam = date || getISTToday();
        const res = await fetch(`${API_BASE}/api/admin/trips?date=${dateParam}`);
        const data = await res.json();

        let totalTrips = 0;
        let activeCount = 0;

        const detailsContainer = document.getElementById('trip-details-container');
        const summaryBody = document.getElementById('summary-table-body');

        if (!data.trips || data.trips.length === 0) {
            detailsContainer.innerHTML = '<div class="card"><p class="card-desc" style="text-align:center;">No drivers registered yet</p></div>';
            summaryBody.innerHTML = '<tr><td colspan="6" style="text-align:center; opacity:0.6;">No data</td></tr>';
            document.getElementById('total-trips').textContent = '0';
            document.getElementById('active-drivers').textContent = '0';
            return;
        }

        let detailsHtml = '';
        let summaryHtml = '';

        data.trips.forEach((item, idx) => {
            const trips = pairScansIntoTrips(item.scans);
            totalTrips += item.tripCount;
            if (item.scans.length > 0) activeCount++;

            // Determine current status
            let statusBadge = '<span class="badge" style="font-size:11px;">No scans</span>';
            if (item.scans.length > 0) {
                const lastScan = item.scans[item.scans.length - 1];
                if (lastScan.type === 'EXIT') {
                    statusBadge = '<span class="badge badge-exit" style="font-size:11px;">🚛 OUT</span>';
                } else {
                    statusBadge = '<span class="badge badge-entry" style="font-size:11px;">✅ AT SITE</span>';
                }
            }

            // === DETAILED TRIP CARD ===
            if (item.scans.length > 0) {
                detailsHtml += `<div class="driver-trip-card">`;
                detailsHtml += `<div class="driver-trip-header">
                    <div>
                        <h4>${item.driver.name}</h4>
                        <span class="badge badge-trip" style="font-size:12px;">🚛 ${item.driver.vehicleNo}</span>
                        <span style="margin-left:8px; opacity:0.6; font-size:13px;">${item.driver.phone}</span>
                    </div>
                    <span class="trip-count-badge">${item.tripCount} Trip${item.tripCount !== 1 ? 's' : ''}</span>
                </div>`;

                if (trips.length > 0) {
                    trips.forEach((trip, ti) => {
                        const exitTime = trip.exitScan ? formatTime(trip.exitScan.timestamp) : '—';
                        const entryTime = trip.entryScan ? formatTime(trip.entryScan.timestamp) : null;

                        detailsHtml += `<div class="trip-pair">
                            <span class="trip-num">Trip ${ti + 1}</span>
                            <div class="trip-times">
                                <span class="exit-time">🚛 Exit: <strong>${exitTime}</strong></span>
                                &nbsp;→&nbsp;
                                ${entryTime
                                    ? `<span class="entry-time">✅ Entry: <strong>${entryTime}</strong></span>`
                                    : `<span class="in-progress">⏳ In Progress...</span>`
                                }
                            </div>
                        </div>`;
                    });
                }

                detailsHtml += `</div>`;
            }

            // === SUMMARY TABLE ROW ===
            summaryHtml += `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${item.driver.name}</strong></td>
                    <td><span class="badge badge-trip" style="font-size:11px;">${item.driver.vehicleNo}</span></td>
                    <td>${item.driver.phone}</td>
                    <td><strong style="color:var(--accent); font-size:18px;">${item.tripCount}</strong></td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });

        if (!detailsHtml) {
            detailsHtml = '<div class="card"><p class="card-desc" style="text-align:center;">No scans recorded for this date</p></div>';
        }

        detailsContainer.innerHTML = detailsHtml;
        summaryBody.innerHTML = summaryHtml;
        document.getElementById('total-trips').textContent = totalTrips;
        document.getElementById('active-drivers').textContent = activeCount;

    } catch (err) {
        console.error('Load trips error:', err);
        showToast('Failed to load trip data', 'error');
    }
}

// ==========================================
// LOAD DRIVERS
// ==========================================

async function loadDrivers() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/drivers`);
        const data = await res.json();
        document.getElementById('total-drivers').textContent = data.drivers.length;

        const tbody = document.getElementById('drivers-table-body');
        if (data.drivers && data.drivers.length > 0) {
            let html = '';
            data.drivers.forEach((d, i) => {
                html += `<tr>
                    <td>${i + 1}</td>
                    <td>${d.name}</td>
                    <td>${d.phone}</td>
                    <td>${d.vehicleNo}</td>
                    <td>${formatDateShort(d.createdAt)}</td>
                </tr>`;
            });
            tbody.innerHTML = html;
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.6;">No drivers yet</td></tr>';
        }
    } catch (err) {
        console.error('Load drivers error:', err);
    }
}

// ==========================================
// SOCKET.IO — Real-time
// ==========================================

function setupSocket() {
    socket = io();
    socket.on('scan-update', (data) => {
        const dateFilter = document.getElementById('date-filter').value;
        loadTrips(dateFilter);

        const icon = data.scanType === 'EXIT' ? '🚛' : '✅';
        showToast(`${icon} ${data.driverName} — ${data.scanType} (Trip ${data.tripCount})`, 'success');
    });
}

// ==========================================
// DATE FILTER
// ==========================================

function setupDateFilter() {
    const dateInput = document.getElementById('date-filter');
    const today = getISTToday();
    dateInput.value = today;
    dateInput.max = today;
    dateInput.addEventListener('change', (e) => loadTrips(e.target.value));
}

// ==========================================
// INIT
// ==========================================

function initDashboard() {
    setupDateFilter();
    loadGateQR();
    loadTrips();
    loadDrivers();
    setupSocket();
    setInterval(() => {
        const dateFilter = document.getElementById('date-filter').value;
        loadTrips(dateFilter);
    }, 30000);
}

window.addEventListener('load', () => {
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
        document.getElementById('admin-overlay').style.display = 'none';
        document.getElementById('admin-page').style.display = 'block';
        initDashboard();
    }
});
